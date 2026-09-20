-- patch_050: calibration hardening Phase E (audit 2026-09-20, P1-9)
--
-- Targeted refine support: round-0 candidates now carry a server-signed
-- refine token (HMAC, CALIBRATION_TOKEN_SECRET) binding the ORIGINAL
-- server-validated source geometry to the calibration_runs ledger run id.
-- Before admitting a targeted refine, the route verifies each token's
-- signature + page/revision binding in application code, then calls this
-- small RPC to confirm the parent ledger run EXISTS, belongs to the
-- caller's company, and SUCCEEDED. This keeps the token bound to real
-- ledger state (no cross-company or failed-run token replay).
--
-- Additive ONLY: one new SECURITY DEFINER RPC. No table or column changes,
-- no policy changes, no data changes.

CREATE OR REPLACE FUNCTION public.cal_verify_refine_parent(
  p_run_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_run RECORD;
  v_company uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_run FROM public.calibration_runs r
   WHERE r.id = p_run_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Company membership from the caller's profile (never client-supplied).
  SELECT u.company_id INTO v_company FROM public.users u WHERE u.id = v_user;
  IF v_company IS NULL OR v_run.company_id <> v_company THEN
    RETURN false;
  END IF;

  -- Only a SUCCEEDED run can parent a targeted refine: its response payload
  -- was persisted and its candidates were actually shown to the user.
  RETURN v_run.status = 'succeeded';
END;
$$;

REVOKE ALL ON FUNCTION public.cal_verify_refine_parent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cal_verify_refine_parent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cal_verify_refine_parent(uuid) TO service_role;

COMMENT ON FUNCTION public.cal_verify_refine_parent(uuid) IS
  'Phase E P1-9: verify a targeted-refine parent run exists, belongs to the caller company, and succeeded (calibration run ledger, patch_050).';
