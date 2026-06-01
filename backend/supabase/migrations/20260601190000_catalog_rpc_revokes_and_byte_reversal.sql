-- Gerald attachments-followup re-audit (2026-06-01) — catalog RPC hardening.
--
-- Fixes three findings carried over from Round 9 that were still open at
-- HEAD 9f72453 because the original migration (20260601150000) only GRANTed
-- service_role and never revoked the Postgres default PUBLIC execute:
--
--   [C-01-R3] SECURITY DEFINER RPCs adjust_company_storage + import_catalog_
--             rows_atomic lacked explicit REVOKE from anon/authenticated/PUBLIC.
--             Postgres grants EXECUTE to PUBLIC by default on function create,
--             and Supabase grants anon + authenticated separately, so
--             GRANT ... TO service_role alone does NOT remove client access.
--             (Same gotcha documented in MEMORY.md "SUPABASE RPC LOCKDOWN".)
--
--   [M-01-R3] import_catalog_rows_atomic: on p_is_first the prior-byte
--             reversal was guarded by `v_status = 'ready'`, but the status
--             guard above only permits ('importing','error'), making the
--             reversal branch unreachable. A reset/retry of a partially
--             charged 'importing' catalog stranded the already-charged bytes.
--             Fix: reverse any prior bytes that were charged (v_prior_bytes>0)
--             regardless of status, since batch bytes are charged immediately.
--
-- This migration is idempotent and additive: REVOKEs are safe to re-run, and
-- the function is CREATE OR REPLACE with an unchanged signature/return type.

-- ---------------------------------------------------------------------
-- C-01-R3: lock both SECURITY DEFINER RPCs to service_role only.
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.adjust_company_storage(uuid, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_company_storage(uuid, bigint)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.import_catalog_rows_atomic(uuid, uuid, jsonb, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_catalog_rows_atomic(uuid, uuid, jsonb, boolean, boolean)
  TO service_role;

-- ---------------------------------------------------------------------
-- M-01-R3: fix prior-byte reversal on first batch.
-- Body identical to 20260601150000 except the p_is_first reversal block.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_catalog_rows_atomic(
  p_company_id uuid,
  p_catalog_id uuid,
  p_rows       jsonb,
  p_is_first   boolean,
  p_is_last    boolean
)
  RETURNS TABLE (row_count integer, data_bytes bigint, over_quota boolean)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  c_max_bytes constant bigint   := 10 * 1024 * 1024;  -- 10 MB hard ceiling
  c_max_rows  constant integer  := 250000;
  v_status        text;
  v_prior_bytes   bigint;
  v_prior_rows    integer;
  v_batch_bytes   bigint;
  v_batch_rows    integer;
  v_new_bytes     bigint;
  v_new_rows      integer;
  v_limit         bigint;
  v_used          bigint;
  v_topup         bigint;
BEGIN
  -- Serialise all imports for this catalog. Released at txn end.
  PERFORM pg_advisory_xact_lock(hashtext('catalog_import:' || p_catalog_id::text));

  -- Ownership + status (locks the catalog row too).
  SELECT c.status, COALESCE(c.data_bytes, 0), COALESCE(c.row_count, 0)
    INTO v_status, v_prior_bytes, v_prior_rows
    FROM public.catalogs c
   WHERE c.id = p_catalog_id
     AND c.company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_not_found' USING ERRCODE = 'P0015';
  END IF;

  IF v_status NOT IN ('importing', 'error') THEN
    RAISE EXCEPTION 'catalog_not_importing:%', v_status USING ERRCODE = 'P0016';
  END IF;

  -- First batch: clear existing rows + reverse any prior CHARGE.
  IF p_is_first THEN
    DELETE FROM public.catalog_rows
     WHERE catalog_id = p_catalog_id AND company_id = p_company_id;

    -- M-01-R3 fix: batch bytes are charged to storage IMMEDIATELY (see the
    -- per-batch charge below), so any prior bytes on this catalog were already
    -- charged regardless of whether the catalog reached 'ready'. Reverse them
    -- whenever non-zero, otherwise a reset of a partially-imported catalog
    -- strands the previously charged bytes.
    IF v_prior_bytes > 0 THEN
      PERFORM public.adjust_company_storage(p_company_id, -v_prior_bytes);
    END IF;

    v_prior_bytes := 0;
    v_prior_rows  := 0;
  END IF;

  -- Compute this batch authoritatively from the JSONB payload.
  SELECT COUNT(*)::integer,
         COALESCE(SUM(octet_length((elem->'raw')::text)), 0)::bigint
    INTO v_batch_rows, v_batch_bytes
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem;

  v_new_rows  := v_prior_rows  + v_batch_rows;
  v_new_bytes := v_prior_bytes + v_batch_bytes;

  -- HARD ceilings (abuse guard) — reject, do not store.
  IF v_new_rows > c_max_rows THEN
    RAISE EXCEPTION 'catalog_too_large_rows:%', c_max_rows USING ERRCODE = 'P0017';
  END IF;
  IF v_new_bytes > c_max_bytes THEN
    RAISE EXCEPTION 'catalog_too_large_bytes:%', c_max_bytes USING ERRCODE = 'P0017';
  END IF;

  -- Insert the rows. search_text built server-side from raw values.
  INSERT INTO public.catalog_rows (catalog_id, company_id, row_index, raw_row, search_text)
  SELECT
    p_catalog_id,
    p_company_id,
    (elem->>'row_index')::integer,
    elem->'raw',
    lower((
      SELECT string_agg(val.value, ' ')
        FROM jsonb_each_text(elem->'raw') AS val
    ))
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem;

  -- Charge storage by the batch delta IMMEDIATELY (honest even if the
  -- import is abandoned before the final batch).
  IF v_batch_bytes > 0 THEN
    PERFORM public.adjust_company_storage(p_company_id, v_batch_bytes);
  END IF;

  -- Persist authoritative totals + status.
  UPDATE public.catalogs
     SET row_count  = v_new_rows,
         data_bytes = v_new_bytes,
         status     = CASE WHEN p_is_last THEN 'ready' ELSE 'importing' END,
         updated_at = now()
   WHERE id = p_catalog_id
     AND company_id = p_company_id;

  -- Compute whether the company is now OVER its plan storage quota (red).
  SELECT co.storage_used_bytes, co.storage_topup_bytes,
         sp.storage_limit_bytes
    INTO v_used, v_topup, v_limit
    FROM public.companies co
    JOIN public.subscription_plans sp
      ON sp.code = public.company_effective_plan_code(p_company_id)
   WHERE co.id = p_company_id;

  row_count  := v_new_rows;
  data_bytes := v_new_bytes;
  over_quota := (v_used > COALESCE(v_limit, 0) + COALESCE(v_topup, 0));
  RETURN NEXT;
END $$;

COMMENT ON FUNCTION public.import_catalog_rows_atomic IS
  'Atomic, per-catalog-serialised catalog row import. Inserts a batch, charges storage by the real byte delta immediately, enforces the 10MB/250k hard ceiling, updates totals in one transaction. First-batch reset reverses any prior charged bytes (M-01-R3). Plan storage quota intentionally NOT enforced here (import may complete + push the company over -> red). service_role only.';

-- Re-assert service_role-only after replace (CREATE OR REPLACE preserves ACL,
-- but be explicit so the lockdown is co-located with the definition).
REVOKE EXECUTE ON FUNCTION public.import_catalog_rows_atomic(uuid, uuid, jsonb, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_catalog_rows_atomic(uuid, uuid, jsonb, boolean, boolean)
  TO service_role;
