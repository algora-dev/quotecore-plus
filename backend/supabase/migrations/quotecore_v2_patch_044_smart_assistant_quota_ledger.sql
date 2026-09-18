-- patch_044: Smart Assistant quota reservation + usage ledger
-- 1) assistant_usage_events: one row per finished run (unit economics for
--    Phase 4 pricing). Service-write-only (no client policies).
-- 2) Turn quota: monthly cap per company, tunable via assistant_feature_flags
--    (admin-controlled), enforced inside sa_admit_run BEFORE a run is created.
-- 3) sa_finish_run now also writes the usage event atomically.

-- 1) Usage ledger
CREATE TABLE IF NOT EXISTS public.assistant_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  run_id uuid NOT NULL UNIQUE REFERENCES public.smart_assistant_runs(id) ON DELETE CASCADE,
  status text NOT NULL,
  tokens_in bigint NOT NULL DEFAULT 0,
  tokens_out bigint NOT NULL DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_usage_company_month
  ON public.assistant_usage_events(company_id, created_at DESC);

ALTER TABLE public.assistant_usage_events ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies: service-role only.
-- (Admin reads happen via the admin client; members never query this.)

-- 2) Tunable monthly turn cap on the rollout flag row (admin-controlled)
ALTER TABLE public.assistant_feature_flags
  ADD COLUMN IF NOT EXISTS quota_monthly_turns integer NOT NULL DEFAULT 500;

COMMENT ON COLUMN public.assistant_feature_flags.quota_monthly_turns IS
  'Max Smart Assistant turns per company per calendar month. Default 500 during dark launch.';

CREATE OR REPLACE FUNCTION public.sa_check_turn_quota(p_company_id uuid)
RETURNS TABLE (allowed boolean, used integer, cap integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT q.used < q.cap AS allowed, q.used, q.cap
  FROM (
    SELECT
      (SELECT COALESCE(
         (SELECT f.quota_monthly_turns FROM public.assistant_feature_flags f
           WHERE f.company_id = p_company_id AND f.enabled), 500)) AS cap,
      (SELECT COUNT(*)::int FROM public.smart_assistant_runs r
        WHERE r.company_id = p_company_id
          AND r.started_at >= date_trunc('month', now())) AS used
  ) q
$$;

-- 3) sa_admit_run with quota gate (full replacement of patch_043 version)
CREATE OR REPLACE FUNCTION public.sa_admit_run(
  p_conversation_id uuid,
  p_user_message text,
  p_client_request_id text
)
RETURNS TABLE (ok boolean, status text, run_id uuid, message_id uuid, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_conversation RECORD;
  v_flag boolean;
  v_existing_run RECORD;
  v_msg_id uuid;
  v_run_id uuid;
  v_quota RECORD;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'unauthenticated';
    RETURN;
  END IF;

  IF p_client_request_id IS NULL OR length(trim(p_client_request_id)) < 8
     OR length(p_client_request_id) > 128 THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'bad_request_id';
    RETURN;
  END IF;

  IF p_user_message IS NULL OR length(trim(p_user_message)) = 0
     OR length(p_user_message) > 16000 THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'bad_message';
    RETURN;
  END IF;

  SELECT * INTO v_conversation
  FROM public.smart_assistant_conversations c
  WHERE c.id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'conversation_not_found';
    RETURN;
  END IF;

  IF v_conversation.user_id <> v_user THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'not_owner';
    RETURN;
  END IF;

  SELECT public.smart_assistant_enabled(v_conversation.company_id) INTO v_flag;
  IF NOT COALESCE(v_flag, false) THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'flag_off';
    RETURN;
  END IF;

  -- Quota reservation: checked before any run exists; the run itself is the
  -- reservation (counted from started_at in the current month).
  SELECT * INTO v_quota FROM public.sa_check_turn_quota(v_conversation.company_id);
  IF v_quota.used >= v_quota.cap THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'quota_exceeded';
    RETURN;
  END IF;

  IF v_conversation.active_run_id IS NOT NULL THEN
    UPDATE public.smart_assistant_runs r
       SET status = 'interrupted',
           error_code = 'stale',
           finished_at = now()
     WHERE r.id = v_conversation.active_run_id
       AND r.status IN ('accepted','running')
       AND r.started_at < now() - interval '5 minutes';

    IF FOUND THEN
      UPDATE public.smart_assistant_conversations c
          SET active_run_id = NULL
        WHERE c.id = v_conversation.id
          AND c.active_run_id = v_conversation.active_run_id;
      v_conversation.active_run_id := NULL;
    END IF;
  END IF;

  SELECT * INTO v_existing_run
  FROM public.smart_assistant_runs r
  WHERE r.conversation_id = p_conversation_id
    AND r.client_request_id = p_client_request_id;

  IF FOUND THEN
    RETURN QUERY SELECT true, 'duplicate', v_existing_run.id, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF v_conversation.active_run_id IS NOT NULL THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'run_in_progress';
    RETURN;
  END IF;

  INSERT INTO public.smart_assistant_messages (conversation_id, role, content)
  VALUES (p_conversation_id, 'user', p_user_message)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.smart_assistant_runs (
    conversation_id, user_id, company_id, client_request_id,
    payload_hash, status
  ) VALUES (
    p_conversation_id, v_user, v_conversation.company_id, p_client_request_id,
    md5(p_user_message), 'accepted'
  )
  RETURNING id INTO v_run_id;

  UPDATE public.smart_assistant_conversations c
     SET active_run_id = v_run_id,
         last_active_at = now(),
         updated_at = now()
   WHERE c.id = p_conversation_id;

  RETURN QUERY SELECT true, 'accepted', v_run_id, v_msg_id, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.sa_admit_run(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_admit_run(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.sa_check_turn_quota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_check_turn_quota(uuid) TO authenticated;

-- 4) sa_finish_run also writes the usage event (full replacement)
CREATE OR REPLACE FUNCTION public.sa_finish_run(
  p_run_id uuid,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_assistant_content text DEFAULT NULL,
  p_tokens_in bigint DEFAULT 0,
  p_tokens_out bigint DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_run FROM public.smart_assistant_runs r
  WHERE r.id = p_run_id AND r.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_run.status IN ('completed','failed','cancelled','interrupted') THEN
    RETURN true;
  END IF;

  IF p_status NOT IN ('completed','failed','cancelled') THEN
    RAISE EXCEPTION 'invalid terminal status: %', p_status;
  END IF;

  IF p_assistant_content IS NOT NULL AND length(trim(p_assistant_content)) > 0 THEN
    INSERT INTO public.smart_assistant_messages (conversation_id, run_id, role, content)
    VALUES (v_run.conversation_id, p_run_id, 'assistant', p_assistant_content);
  END IF;

  UPDATE public.smart_assistant_runs r
     SET status = p_status,
         error_code = p_error_code,
         tokens_in = GREATEST(COALESCE(p_tokens_in, 0), 0),
         tokens_out = GREATEST(COALESCE(p_tokens_out, 0), 0),
         finished_at = now()
   WHERE r.id = p_run_id;

  -- Usage ledger: one event per finished run, idempotent via run_id UNIQUE.
  INSERT INTO public.assistant_usage_events
    (company_id, user_id, run_id, status, tokens_in, tokens_out)
  VALUES
    (v_run.company_id, v_run.user_id, p_run_id, p_status,
     GREATEST(COALESCE(p_tokens_in, 0), 0), GREATEST(COALESCE(p_tokens_out, 0), 0))
  ON CONFLICT (run_id) DO NOTHING;

  UPDATE public.smart_assistant_conversations c
     SET active_run_id = NULL,
         last_active_at = now(),
         updated_at = now()
   WHERE c.id = v_run.conversation_id
     AND c.active_run_id = p_run_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sa_finish_run(uuid, text, text, text, bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_finish_run(uuid, text, text, text, bigint, bigint) TO authenticated;
