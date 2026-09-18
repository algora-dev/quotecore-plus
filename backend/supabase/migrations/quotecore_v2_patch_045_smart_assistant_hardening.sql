-- patch_045: Smart Assistant hardening (external review 2026-09-18)
-- Additive; supersedes vulnerable definitions from 041-044. Do NOT edit old patches.
-- Key changes:
--  1. Durable quota reservations (survive transcript deletion; no FK to runs)
--  2. Usage events survive run deletion (ON DELETE SET NULL)
--  3. Duplicate replay checked BEFORE flag/quota refusal; payload conflict detection
--  4. Company-wide quota serialization (feature-flag row lock)
--  5. sa_finish_run: service_role ONLY (browser can never certify runs)
--  6. Authenticated write privileges narrowed to conversation insert(title)/update(title)
--  7. members_can_manage config toggle (owner/admin gate for config changes)
--  8. Admitted user message stamped with run_id (history identity)

-- 1) Durable reservations ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assistant_turn_reservations (
  run_id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_res_company_month
  ON public.assistant_turn_reservations(company_id, created_at DESC);
ALTER TABLE public.assistant_turn_reservations ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role only. (Invisible data, no privacy leak.)

-- Backfill existing runs as reservations (idempotent).
INSERT INTO public.assistant_turn_reservations (run_id, company_id, user_id, created_at)
SELECT r.id, r.company_id, r.user_id, r.started_at
FROM public.smart_assistant_runs r
ON CONFLICT (run_id) DO NOTHING;

-- 2) Usage events survive run deletion ---------------------------------------
ALTER TABLE public.assistant_usage_events ALTER COLUMN run_id DROP NOT NULL;
ALTER TABLE public.assistant_usage_events DROP CONSTRAINT IF EXISTS assistant_usage_events_run_id_fkey;
ALTER TABLE public.assistant_usage_events
  ADD CONSTRAINT assistant_usage_events_run_id_fkey
  FOREIGN KEY (run_id) REFERENCES public.smart_assistant_runs(id) ON DELETE SET NULL;

-- 3) members_can_manage toggle -----------------------------------------------
ALTER TABLE public.assistant_configs
  ADD COLUMN IF NOT EXISTS members_can_manage boolean NOT NULL DEFAULT false;

-- 4) Quota now counts reservations -------------------------------------------
CREATE OR REPLACE FUNCTION public.sa_check_turn_quota(p_company_id uuid)
RETURNS TABLE (allowed boolean, used integer, cap integer)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT q.used < q.cap AS allowed, q.used, q.cap
  FROM (
    SELECT
      (SELECT COALESCE(
         (SELECT f.quota_monthly_turns FROM public.assistant_feature_flags f
           WHERE f.company_id = p_company_id AND f.enabled), 500)) AS cap,
      (SELECT COUNT(*)::int FROM public.assistant_turn_reservations x
        WHERE x.company_id = p_company_id
          AND x.created_at >= date_trunc('month', now())) AS used
  ) q
$$;
REVOKE ALL ON FUNCTION public.sa_check_turn_quota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_check_turn_quota(uuid) TO authenticated;

-- 5) sa_admit_run v4 -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sa_admit_run(
  p_conversation_id uuid,
  p_user_message text,
  p_client_request_id text
)
RETURNS TABLE (ok boolean, status text, run_id uuid, message_id uuid, error_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_conversation RECORD;
  v_flag boolean;
  v_existing_run RECORD;
  v_msg_id uuid;
  v_run_id uuid;
  v_quota RECORD;
  v_payload text;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'unauthenticated'; RETURN;
  END IF;
  IF p_client_request_id IS NULL OR length(trim(p_client_request_id)) < 8
     OR length(p_client_request_id) > 128 THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'bad_request_id'; RETURN;
  END IF;
  IF p_user_message IS NULL OR length(trim(p_user_message)) = 0
     OR length(p_user_message) > 16000 THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'bad_message'; RETURN;
  END IF;

  SELECT * INTO v_conversation FROM public.smart_assistant_conversations c
  WHERE c.id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'conversation_not_found'; RETURN;
  END IF;
  IF v_conversation.user_id <> v_user THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'not_owner'; RETURN;
  END IF;

  -- DUPLICATE FIRST: a previously admitted request always resolves, even when
  -- the flag/quota would now refuse. Invariant 6.
  SELECT * INTO v_existing_run FROM public.smart_assistant_runs r
  WHERE r.conversation_id = p_conversation_id AND r.client_request_id = p_client_request_id;
  IF FOUND THEN
    -- Payload conflict: same id, different content (md5 legacy rows compatible).
    v_payload := md5(p_user_message);
    IF r.payload_hash IS DISTINCT FROM v_payload THEN
      RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'request_id_conflict';
    END IF;
    RETURN QUERY SELECT true, 'duplicate', v_existing_run.id, NULL::uuid, NULL::text;
  END IF;

  SELECT public.smart_assistant_enabled(v_conversation.company_id) INTO v_flag;
  IF NOT COALESCE(v_flag, false) THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'flag_off'; RETURN;
  END IF;

  -- COMPANY-WIDE QUOTA SERIALIZATION: lock the company's flag row so two
  -- conversations cannot oversubscribe the last slot. Invariant 5.
  PERFORM 1 FROM public.assistant_feature_flags f
  WHERE f.company_id = v_conversation.company_id FOR UPDATE;

  SELECT * INTO v_quota FROM public.sa_check_turn_quota(v_conversation.company_id);
  IF v_quota.used >= v_quota.cap THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'quota_exceeded'; RETURN;
  END IF;

  -- Stale-run recovery with pointer validation (never touch a foreign run).
  IF v_conversation.active_run_id IS NOT NULL THEN
    UPDATE public.smart_assistant_runs r
       SET status = 'interrupted', error_code = 'stale', finished_at = now()
     WHERE r.id = v_conversation.active_run_id
       AND r.conversation_id = v_conversation.id
       AND r.company_id = v_conversation.company_id
       AND r.user_id = v_user
       AND r.status IN ('accepted','running')
       AND r.started_at < now() - interval '5 minutes';
    IF FOUND THEN
      UPDATE public.smart_assistant_conversations c
          SET active_run_id = NULL
        WHERE c.id = v_conversation.id AND c.active_run_id = v_conversation.active_run_id;
      v_conversation.active_run_id := NULL;
    END IF;
  END IF;

  IF v_conversation.active_run_id IS NOT NULL THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'run_in_progress'; RETURN;
  END IF;

  INSERT INTO public.smart_assistant_messages (conversation_id, run_id, role, content)
  VALUES (p_conversation_id, NULL, 'user', p_user_message)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.smart_assistant_runs (
    conversation_id, user_id, company_id, client_request_id, payload_hash, status
  ) VALUES (
    p_conversation_id, v_user, v_conversation.company_id, p_client_request_id,
    md5(p_user_message), 'accepted'
  )
  RETURNING id INTO v_run_id;

  -- Stamp the admitted message with its run for history identity.
  UPDATE public.smart_assistant_messages SET run_id = v_run_id WHERE id = v_msg_id;

  -- Durable reservation: quota survives any later transcript deletion.
  INSERT INTO public.assistant_turn_reservations (run_id, company_id, user_id)
  VALUES (v_run_id, v_conversation.company_id, v_user);

  UPDATE public.smart_assistant_conversations c
     SET active_run_id = v_run_id, last_active_at = now(), updated_at = now()
   WHERE c.id = p_conversation_id;

  RETURN QUERY SELECT true, 'accepted', v_run_id, v_msg_id, NULL::text;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_admit_run(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_admit_run(uuid, text, text) TO authenticated;

-- 6) sa_finish_run: SERVICE ROLE ONLY ------------------------------------------
CREATE OR REPLACE FUNCTION public.sa_finish_run(
  p_run_id uuid,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_assistant_content text DEFAULT NULL,
  p_tokens_in bigint DEFAULT 0,
  p_tokens_out bigint DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_run RECORD;
BEGIN
  -- No auth.uid() check: this function is executable ONLY by service_role
  -- (the app's narrow trusted finalization path). Invariant 1.
  SELECT * INTO v_run FROM public.smart_assistant_runs r
  WHERE r.id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_run.status IN ('completed','failed','cancelled','interrupted') THEN RETURN true; END IF;
  IF p_status NOT IN ('completed','failed','cancelled') THEN
    RAISE EXCEPTION 'invalid terminal status: %', p_status;
  END IF;

  IF p_assistant_content IS NOT NULL AND length(trim(p_assistant_content)) > 0 THEN
    INSERT INTO public.smart_assistant_messages (conversation_id, run_id, role, content)
    VALUES (v_run.conversation_id, p_run_id, 'assistant', p_assistant_content);
  END IF;

  UPDATE public.smart_assistant_runs r
     SET status = p_status, error_code = p_error_code,
         tokens_in = GREATEST(COALESCE(p_tokens_in, 0), 0),
         tokens_out = GREATEST(COALESCE(p_tokens_out, 0), 0),
         finished_at = now()
   WHERE r.id = p_run_id;

  INSERT INTO public.assistant_usage_events
    (company_id, user_id, run_id, status, tokens_in, tokens_out)
  VALUES
    (v_run.company_id, v_run.user_id, p_run_id, p_status,
     GREATEST(COALESCE(p_tokens_in, 0), 0), GREATEST(COALESCE(p_tokens_out, 0), 0))
  ON CONFLICT (run_id) DO NOTHING;

  UPDATE public.smart_assistant_conversations c
     SET active_run_id = NULL, last_active_at = now(), updated_at = now()
   WHERE c.id = v_run.conversation_id AND c.active_run_id = p_run_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_finish_run(uuid, text, text, text, bigint, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sa_finish_run(uuid, text, text, text, bigint, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sa_finish_run(uuid, text, text, text, bigint, bigint) TO service_role;

-- 7) Narrow authenticated DML ---------------------------------------------------
-- Conversations: UI may create + rename its OWN conversations (RLS owner-only
-- still applies). Everything else loses direct client writes.
REVOKE INSERT, UPDATE, DELETE ON public.smart_assistant_conversations FROM authenticated;
GRANT INSERT (company_id, user_id, title, last_active_at, created_at, updated_at)
  ON public.smart_assistant_conversations TO authenticated;
GRANT UPDATE (title, updated_at) ON public.smart_assistant_conversations TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.smart_assistant_messages FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.smart_assistant_runs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.assistant_usage_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.assistant_turn_reservations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.assistant_configs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.assistant_knowledge_docs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.assistant_knowledge_chunks FROM authenticated;
REVOKE ALL ON public.assistant_usage_events FROM anon;
REVOKE ALL ON public.assistant_turn_reservations FROM anon;
