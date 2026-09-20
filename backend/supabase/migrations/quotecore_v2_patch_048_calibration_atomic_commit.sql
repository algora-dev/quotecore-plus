-- patch_048: calibration hardening Phase B (audit 2026-09-20, P0-3 + 6.4)
--
-- Atomic recalibration persistence. Today the AI recalibration flow commits
-- recomputed measurements through save_takeoff_atomic and then persists
-- scale_calibration / calibration_metadata / image_revision to takeoff_pages
-- in a SEPARATE statement from the server action. If the second write fails,
-- the measurements are already recalibrated in the DB while the UI rolls
-- back claiming nothing changed: an internally inconsistent state.
--
-- Fix: new additive RPC save_takeoff_atomic_v2 that accepts the calibration
-- block INSIDE the payload and writes everything in ONE database transaction.
-- Either the recalculated measurements + calibration data commit, or nothing.
--
-- Payload: identical to save_takeoff_atomic PLUS one optional key:
--   "calibration": {
--     "page_id":             uuid  (required when the block is present),
--     "scale_calibration":   jsonb (legacy array, required),
--     "calibration_metadata": jsonb (versioned envelope, optional),
--     "image_revision":      text  (server-established digest, optional)
--   }
--
-- Design notes:
--   - The existing save_takeoff_atomic is NOT modified (other callers keep
--     using it). v2 delegates the measurement/component work to the existing
--     function and then performs the page-calibration update in the same
--     transaction. A nested SECURITY DEFINER call inside our own open
--     transaction is transaction-scoped: any exception raised here rolls
--     back the nested writes too.
--   - 6.4: after the nested save, the durable source_geometry_id native
--     column is stamped from the entry_inputs jsonb passthrough for this
--     page's rows, so future recalibrations need not re-infer provenance.
--   - Additive only. No table changes, no dropped/renamed functions.

CREATE OR REPLACE FUNCTION public.save_takeoff_atomic_v2(p_quote_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cal            jsonb := p_payload->'calibration';
  v_cal_page_id    uuid;
  v_page_exists    boolean;
BEGIN
  IF v_cal IS NULL THEN
    -- No calibration block: behave exactly like save_takeoff_atomic.
    PERFORM public.save_takeoff_atomic(p_quote_id, p_payload);
    RETURN;
  END IF;

  v_cal_page_id := nullif(v_cal->>'page_id', '')::uuid;

  IF v_cal_page_id IS NULL THEN
    RAISE EXCEPTION 'CALIBRATION_PAGE_REQUIRED: calibration block present without page_id';
  END IF;

  IF v_cal->'scale_calibration' IS NULL THEN
    RAISE EXCEPTION 'CALIBRATION_PAYLOAD_INVALID: scale_calibration is required';
  END IF;

  -- The page must belong to this quote. Raise BEFORE any write so nothing
  -- commits when the calibration target is invalid.
  SELECT EXISTS (
    SELECT 1 FROM public.takeoff_pages tp
     WHERE tp.id = v_cal_page_id
       AND tp.quote_id = p_quote_id
  ) INTO v_page_exists;

  IF NOT v_page_exists THEN
    RAISE EXCEPTION 'Page % does not belong to quote %', v_cal_page_id, p_quote_id;
  END IF;

  -- 1. Measurements / roof areas / components (nested, same transaction).
  --    Includes the advisory lock, ownership check and STALE_TAKEOFF_VERSION
  --    guard; a raise here leaves the database untouched.
  PERFORM public.save_takeoff_atomic(p_quote_id, p_payload - 'calibration');

  -- 2. Page calibration update in the SAME transaction. Any failure here
  --    rolls back the measurement writes from step 1.
  UPDATE public.takeoff_pages
     SET scale_calibration  = v_cal->'scale_calibration',
         calibration_metadata = COALESCE(v_cal->'calibration_metadata', calibration_metadata),
         image_revision      = COALESCE(nullif(v_cal->>'image_revision', ''), image_revision)
   WHERE id = v_cal_page_id
     AND quote_id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page % not found for quote %', v_cal_page_id, p_quote_id;
  END IF;

  -- 3. 6.4 provenance stamping: copy the durable source-geometry link from
  --    the entry_inputs jsonb passthrough into the native column for this
  --    page's rows. Idempotent; rows without the link are untouched.
  UPDATE public.quote_takeoff_measurements
     SET source_geometry_id = nullif(entry_inputs->>'source_geometry_id', '')
   WHERE quote_id = p_quote_id
     AND page_id = v_cal_page_id
     AND entry_inputs IS NOT NULL
     AND entry_inputs ? 'source_geometry_id';
END;
$function$;

COMMENT ON FUNCTION public.save_takeoff_atomic_v2(uuid, jsonb) IS
  'Atomic recalibration commit (patch_048): save_takeoff_atomic semantics plus '
  'an optional payload.calibration block persisted to takeoff_pages in the SAME '
  'transaction (scale_calibration + calibration_metadata + image_revision), and '
  'source_geometry_id stamped natively from entry_inputs. Either everything '
  'commits or nothing does.';

REVOKE EXECUTE ON FUNCTION public.save_takeoff_atomic_v2(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_takeoff_atomic_v2(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_takeoff_atomic_v2(uuid, jsonb) TO service_role;
