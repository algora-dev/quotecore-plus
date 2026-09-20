-- patch_049: calibration hardening Phase D (audit 2026-09-20, P1-1/P1-2/P1-3)
--
-- Idempotent calibration run ledger + stateful single-use round budget +
-- atomic refunds. Fixes three audit findings on the calibration vision route:
--   P1-1: a lost HTTP response after a successful provider call let a client
--         retry double-charge and double-run (requestId was logged, not stored).
--   P1-2: the HMAC rescan token was stateless and replayable for 24h; the
--         round budget now lives in server state (the token remains an extra
--         binding layer, but the ledger is the authority).
--   P1-3: refunds were read-then-write decrements of companies
--         .ai_assist_points_used (concurrency unsafe). All refunds are now
--         single-statement GREATEST(x - n, 0) UPDATEs inside RPCs.
--
-- Follows the sa_admit_run patterns (patch_043/044/045):
--   * flag-row (takeoff_pages) FOR UPDATE serializes admission per page,
--   * dedup BEFORE quota reservation,
--   * same client_request_id + different payload hash = request_id_conflict,
--   * replay of a completed run returns the original terminal response with
--     no new charge,
--   * stale in-flight runs (> 10 min, route maxDuration is 5 min) are
--     auto-recovered: refunded + terminalized so a crashed worker can never
--     wedge a request id or the round-1 budget.
--
-- Migration hygiene (P1-6): infrastructure only. This patch contains NO
-- per-account grants. patch_046 section 7 (email-specific flag grant for a
-- test account) is applied history and is NOT rewritten here. The operational
-- way to revoke any such grant is the existing admin surface:
--   SELECT public.set_calibration_flag('<company-uuid>'::uuid, false);
-- (service-role only, quotecore_v2_patch_046 section 4) or, for a full
-- teardown, DELETE FROM public.calibration_feature_flags WHERE company_id = ...
-- via the service-role client.
--
-- Additive/nullable ONLY: one new table, two new RPCs. Nothing dropped.

-- 1) Run ledger table
CREATE TABLE IF NOT EXISTS public.calibration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.takeoff_pages(id) ON DELETE CASCADE,
  client_request_id text NOT NULL,
  image_revision text NOT NULL,
  action text NOT NULL CHECK (action IN ('search','refine')),
  round integer NOT NULL CHECK (round IN (0,1)),
  strategy text NOT NULL CHECK (strategy IN ('initial','different_references','refine_reference')),
  payload_hash text NOT NULL,
  round_token text,
  status text NOT NULL DEFAULT 'admitted'
    CHECK (status IN ('admitted','running','succeeded','failed_refunded')),
  error_code text,
  response_payload jsonb,
  points_charged integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  -- Client request ids are unique per COMPANY scope: two members of the same
  -- company retrying "the same" request must resolve to the same run, while
  -- different companies may freely reuse id strings.
  CONSTRAINT calibration_runs_company_request_id_key UNIQUE (company_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_calibration_runs_page_round
  ON public.calibration_runs(page_id, image_revision, round);

COMMENT ON TABLE public.calibration_runs IS
  'Calibration search/refine run ledger (patch_049): idempotency (unique company+client_request_id, payload-hash conflict detection, terminal response replay) + stateful single-use round-1 budget per page/image_revision. Service-role/RPC access only; no client policies.';

ALTER TABLE public.calibration_runs ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies: all access is via the SECURITY
-- DEFINER RPCs below (which re-verify auth.uid()) or the service-role client.

-- 2) cal_admit_run: the ONLY entry point for a calibration round.
--    Charge (check_and_deduct_ai_points) and ledger insert happen in ONE
--    transaction, serialized by the page row lock. Returns:
--      ok=true,  status='accepted'        -> proceed (run_id, points_remaining)
--      ok=true,  status='replay'          -> return response_payload verbatim, no charge
--      ok=true,  status='in_flight'       -> original attempt still running, no re-run
--      ok=true,  status='duplicate_failed'-> original attempt failed+refunded; error_code says why
--      ok=false                            -> refused (error_code)
CREATE OR REPLACE FUNCTION public.cal_admit_run(
  p_quote_id uuid,
  p_page_id uuid,
  p_client_request_id text,
  p_action text,
  p_round integer,
  p_strategy text,
  p_image_revision text,
  p_payload_hash text,
  p_round_token text DEFAULT NULL,
  p_points integer DEFAULT 1
)
RETURNS TABLE (ok boolean, status text, run_id uuid, error_code text, response_payload jsonb, points_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_company uuid;
  v_quote RECORD;
  v_page RECORD;
  v_flag boolean;
  v_existing RECORD;
  v_quota RECORD;
  v_run_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'unauthenticated', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  IF p_client_request_id IS NULL OR length(trim(p_client_request_id)) < 8
     OR length(p_client_request_id) > 128 THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'bad_request', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  IF p_payload_hash IS NULL OR length(p_payload_hash) < 8
     OR p_image_revision IS NULL OR length(p_image_revision) = 0 THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'bad_request', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  -- Round/strategy contract (server is the authority; route pre-validates
  -- the HMAC signature itself because the secret never reaches SQL).
  -- Round 0 permits ONLY the initial search; refine requires round 1.
  IF NOT (
       (p_round = 0 AND p_action = 'search' AND p_strategy = 'initial')
    OR (p_round = 1 AND p_action = 'search' AND p_strategy = 'different_references')
    OR (p_round = 1 AND p_action = 'refine' AND p_strategy = 'refine_reference')
  ) THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'invalid_round', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;
  IF p_round = 1 AND (p_round_token IS NULL OR length(trim(p_round_token)) = 0) THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'invalid_round', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  -- Company context from the caller's profile (never client-supplied).
  SELECT u.company_id INTO v_company FROM public.users u WHERE u.id = v_user;
  IF v_company IS NULL THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'no_company', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  -- Ownership chain, then LOCK THE PAGE ROW: admission for one page is
  -- serialized exactly like sa_admit_run serializes on the conversation row.
  SELECT * INTO v_quote FROM public.quotes q
   WHERE q.id = p_quote_id AND q.company_id = v_company;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'quote_not_found', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_page FROM public.takeoff_pages tp
   WHERE tp.id = p_page_id AND tp.quote_id = p_quote_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'page_not_found', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  -- Dark-launch flag.
  SELECT public.calibration_ai_enabled(v_company) INTO v_flag;
  IF NOT COALESCE(v_flag, false) THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'flag_off', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  -- Dedup BEFORE quota (MEMORY invariant): resolve prior attempts first.
  SELECT * INTO v_existing FROM public.calibration_runs r
   WHERE r.company_id = v_company AND r.client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_existing.payload_hash <> p_payload_hash THEN
      RETURN QUERY SELECT false, 'refused', NULL::uuid, 'request_id_conflict', NULL::jsonb, NULL::integer;
      RETURN;
    END IF;

    -- Stale-run recovery: an admitted/running row older than 10 minutes
    -- (route maxDuration is 5) means a crashed worker. Refund + terminalize
    -- so the client can retry cleanly with a NEW request id.
    IF v_existing.status IN ('admitted','running')
       AND v_existing.created_at < now() - interval '10 minutes' THEN
      UPDATE public.companies c
         SET ai_assist_points_used = GREATEST(c.ai_assist_points_used - v_existing.points_charged, 0)
       WHERE c.id = v_existing.company_id;
      UPDATE public.calibration_runs r
         SET status = 'failed_refunded', error_code = 'stale_run_recovered', finished_at = now()
       WHERE r.id = v_existing.id AND r.status IN ('admitted','running');
      RETURN QUERY SELECT true, 'duplicate_failed', v_existing.id, 'stale_run_recovered', NULL::jsonb, NULL::integer;
      RETURN;
    END IF;

    IF v_existing.status = 'succeeded' THEN
      RETURN QUERY SELECT true, 'replay', v_existing.id, NULL::text, v_existing.response_payload, NULL::integer;
      RETURN;
    END IF;
    IF v_existing.status = 'failed_refunded' THEN
      RETURN QUERY SELECT true, 'duplicate_failed', v_existing.id, v_existing.error_code, NULL::jsonb, NULL::integer;
      RETURN;
    END IF;
    RETURN QUERY SELECT true, 'in_flight', v_existing.id, NULL::text, NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  -- Stateful single-use round budget: at most ONE round-1 attempt (any
  -- outcome) per page + image revision. The HMAC token alone can no longer
  -- authorise a replayed second round.
  IF p_round = 1 AND EXISTS (
    SELECT 1 FROM public.calibration_runs r
     WHERE r.page_id = p_page_id
       AND r.image_revision = p_image_revision
       AND r.round = 1
  ) THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'round_budget_consumed', NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  -- Quota reservation + charge, INSIDE this transaction, AFTER all refusal
  -- paths above (dedup-before-quota). p_points defaults to the canonical
  -- CALIBRATION_SEARCH_POINT_COST (1) kept in app/lib/takeoff/pointCost.ts.
  -- Defensive subtransaction: check_and_deduct_ai_points has a LATENT type
  -- bug for NULL-limit plans (untyped NULL in its point_limit column makes
  -- the whole function raise 42804 instead of returning allowed=false).
  -- That RPC is shared billing infrastructure and is NOT modified here; a
  -- failure from it must refuse admission cleanly, never crash the ledger.
  BEGIN
    SELECT * INTO v_quota FROM public.check_and_deduct_ai_points(v_company, GREATEST(COALESCE(p_points, 1), 1));
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'insufficient_points', NULL::jsonb, 0;
    RETURN;
  END;
  IF NOT v_quota.allowed THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, 'insufficient_points', NULL::jsonb, COALESCE(v_quota.remaining, 0);
    RETURN;
  END IF;

  INSERT INTO public.calibration_runs (
    company_id, user_id, quote_id, page_id, client_request_id,
    image_revision, action, round, strategy, payload_hash, round_token,
    status, points_charged
  ) VALUES (
    v_company, v_user, p_quote_id, p_page_id, p_client_request_id,
    p_image_revision, p_action, p_round, p_strategy, p_payload_hash, p_round_token,
    'admitted', GREATEST(COALESCE(p_points, 1), 1)
  )
  RETURNING id INTO v_run_id;

  RETURN QUERY SELECT true, 'accepted', v_run_id, NULL::text, NULL::jsonb, v_quota.remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.cal_admit_run(uuid, uuid, text, text, integer, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cal_admit_run(uuid, uuid, text, text, integer, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cal_admit_run(uuid, uuid, text, text, integer, text, text, text, text, integer) TO service_role;

-- 3) cal_finish_run: atomic terminalization. 'succeeded' stores the terminal
--    response payload for idempotent replay; 'failed_refunded' releases the
--    reserved point with a single-statement GREATEST decrement (never a
--    read-then-write). Terminal rows are immutable; late finishers are no-ops.
CREATE OR REPLACE FUNCTION public.cal_finish_run(
  p_run_id uuid,
  p_status text,
  p_response jsonb DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
RETURNS TABLE (ok boolean, refunded boolean, points_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_status RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_run FROM public.calibration_runs r
   WHERE r.id = p_run_id AND r.user_id = auth.uid()
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::integer;
    RETURN;
  END IF;

  -- Idempotency guard: terminal runs are immutable.
  IF v_run.status IN ('succeeded','failed_refunded') THEN
    RETURN QUERY SELECT true, false, NULL::integer;
    RETURN;
  END IF;

  IF p_status NOT IN ('succeeded','failed_refunded') THEN
    RAISE EXCEPTION 'invalid terminal status: %', p_status;
  END IF;

  IF p_status = 'failed_refunded' THEN
    -- Atomic refund: one statement, concurrency-safe, never negative.
    UPDATE public.companies c
       SET ai_assist_points_used = GREATEST(c.ai_assist_points_used - v_run.points_charged, 0)
     WHERE c.id = v_run.company_id;
  END IF;

  UPDATE public.calibration_runs r
     SET status = p_status,
         response_payload = p_response,
         error_code = p_error_code,
         finished_at = now()
   WHERE r.id = p_run_id;

  SELECT * INTO v_status FROM public.get_ai_assist_points_status(v_run.company_id);

  RETURN QUERY SELECT true, (p_status = 'failed_refunded'), v_status.remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.cal_finish_run(uuid, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cal_finish_run(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cal_finish_run(uuid, text, jsonb, text) TO service_role;
