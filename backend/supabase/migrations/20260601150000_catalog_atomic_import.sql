-- =====================================================================
-- Catalog import — atomic, per-catalog-serialised, honestly-charged
-- =====================================================================
-- Gerald Round 9 re-audit blockers H-01-R + H-02-R + M-01-R.
--
-- Problem with the prior app-layer approach:
--   * Storage was only charged on the FINAL batch, so a client that never
--     sent the last batch left rows persisted but uncharged (free storage).
--   * Read-modify-write of row_count/data_bytes in app code was raceable;
--     two concurrent batches could undercount the charged total.
--   * No unique (catalog_id,row_index) -> duplicate/replayed rows accepted.
--   * A stale finalizeCatalog() server action was a 2nd path to 'ready'.
--
-- Fix (this migration):
--   A single SECURITY DEFINER RPC does EVERYTHING for one batch inside one
--   transaction, serialised per catalog via pg_advisory_xact_lock:
--     1. Verify catalog ownership + importable status.
--     2. On first batch: clear existing rows; if the catalog was previously
--        'ready' (its bytes were charged), reverse that charge; reset totals.
--     3. Compute batch byte size SERVER-SIDE from the JSONB payload.
--     4. Enforce the HARD per-catalog ceiling (10MB / 250k rows) -> reject.
--        This is an abuse guard, independent of the plan storage quota.
--     5. Insert the rows (search_text built in SQL).
--     6. Charge storage_used_bytes by the batch delta IMMEDIATELY (so an
--        abandoned/interrupted import is still charged -> no free storage).
--     7. Update row_count / data_bytes.
--   The PLAN storage quota is NOT enforced here: per Shaun's product call
--   (option 3), an import is allowed to COMPLETE and push the company over
--   their plan storage limit (max overspill = the 10MB ceiling). Going over
--   simply flips the company "red": assertCanUseStorage() (app layer) then
--   blocks all FUTURE file uploads until they free space or upgrade. Quote/
--   component/drawing creation is governed by separate quotas and unaffected.
--
-- Idempotent.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Fix adjust_company_storage to bigint (storage columns are bigint;
--    the old integer signature would overflow / mistype large deltas).
--    Drop the int variant if present, recreate as bigint.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.adjust_company_storage(uuid, integer);

CREATE OR REPLACE FUNCTION public.adjust_company_storage(
  p_company_id  uuid,
  p_delta_bytes bigint
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE public.companies
     SET storage_used_bytes = GREATEST(0, storage_used_bytes + p_delta_bytes)
   WHERE id = p_company_id;
$$;

COMMENT ON FUNCTION public.adjust_company_storage(uuid, bigint) IS
  'Atomically adjusts storage_used_bytes by p_delta_bytes (bigint). Clamps to 0 on underflow. service_role only.';

GRANT EXECUTE ON FUNCTION public.adjust_company_storage(uuid, bigint) TO service_role;

-- ---------------------------------------------------------------------
-- 2. Dedupe + unique constraint on (catalog_id, row_index).
--    Remove any pre-existing duplicates first (keep lowest ctid), then
--    add the constraint so replayed/duplicate batches are rejected.
-- ---------------------------------------------------------------------
DELETE FROM public.catalog_rows a
 USING public.catalog_rows b
 WHERE a.catalog_id = b.catalog_id
   AND a.row_index  = b.row_index
   AND a.ctid       > b.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_catalog_rows_catalog_row_index'
  ) THEN
    ALTER TABLE public.catalog_rows
      ADD CONSTRAINT uq_catalog_rows_catalog_row_index
      UNIQUE (catalog_id, row_index);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Hard per-catalog ceilings (abuse guards; NOT the plan quota).
--    Exposed as constants inside the function below.
-- ---------------------------------------------------------------------
-- MAX_BYTES_PER_CATALOG = 10 MB (matches MAX_SINGLE_FILE_BYTES app-wide)
-- MAX_ROWS_PER_CATALOG  = 250000

-- ---------------------------------------------------------------------
-- 4. import_catalog_rows_atomic()
-- ---------------------------------------------------------------------
-- p_rows is a JSONB array of { "row_index": int, "raw": { col: val, ... } }.
-- Returns the new authoritative row_count + data_bytes + over_quota flag.
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

    -- Only a 'ready' catalog had its bytes charged to storage. Reverse it.
    IF v_status = 'ready' AND v_prior_bytes > 0 THEN
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
  -- Effective limit = effective-plan storage_limit_bytes + company topup.
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
  'Atomic, per-catalog-serialised catalog row import. Inserts a batch, charges storage by the real byte delta immediately, enforces the 10MB/250k hard ceiling, and updates totals in one transaction. Plan storage quota is intentionally NOT enforced here (import may complete + push the company over -> red). service_role only.';

GRANT EXECUTE ON FUNCTION public.import_catalog_rows_atomic(uuid, uuid, jsonb, boolean, boolean) TO service_role;

COMMIT;
