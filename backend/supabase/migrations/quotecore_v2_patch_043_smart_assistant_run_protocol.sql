-- patch_043: Smart Assistant turn admission + run protocol
-- Atomic, race-free turn admission via SECURITY DEFINER RPCs.
-- All fns run as postgres (bypass RLS) and MUST re-verify auth.uid() themselves.
-- Guarantees:
--   * one active run per conversation (busy = 409)
--   * idempotent submits (client_request_id unique per conversation)
--   * flag-off users refused at admission
--   * stale runs (>5 min without finishing) auto-interrupted so a crashed
--     worker can never permanently lock a conversation
--   * finish is atomic: assistant message + run terminal state + active slot cleared together

-- ---------------------------------------------------------------------------
-- sa_admit_run: the ONLY entry point for starting a turn.
-- Returns: (ok, status, run_id, message_id, error_code)
--   ok=true, status='duplicate' -> idempotent replay, run_id of existing run
--   ok=true, status='accepted'  -> new run admitted, ready to execute
--   ok=false                    -> refused (flag_off / not_owner / busy / stale_lock)
-- ---------------------------------------------------------------------------
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

  -- Private transcripts: owner only, always.
  IF v_conversation.user_id <> v_user THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'not_owner';
    RETURN;
  END IF;

  -- Dark-launch flag: refuse admission before touching anything else.
  SELECT public.smart_assistant_enabled(v_conversation.company_id) INTO v_flag;
  IF NOT COALESCE(v_flag, false) THEN
    RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'flag_off';
    RETURN;
  END IF;

  -- Stale-run recovery: a run that never finished (crashed worker) is
  -- interrupted and the slot freed. Users are never permanently locked out.
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

  -- Idempotency: same client_request_id replays the original outcome.
  SELECT * INTO v_existing_run
  FROM public.smart_assistant_runs r
  WHERE r.conversation_id = p_conversation_id
    AND r.client_request_id = p_client_request_id;

  IF FOUND THEN
    RETURN QUERY SELECT true, 'duplicate', v_existing_run.id, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Busy: one active run per conversation.
  IF v_conversation.active_run_id IS NOT NULL THEN
    RETURN QUERY SELECT false, 'busy', NULL::uuid, NULL::uuid, 'run_in_progress';
    RETURN;
  END IF;

  -- Persist the user message.
  INSERT INTO public.smart_assistant_messages (conversation_id, role, content)
  VALUES (p_conversation_id, 'user', p_user_message)
  RETURNING id INTO v_msg_id;

  -- Create the run.
  INSERT INTO public.smart_assistant_runs (
    conversation_id, user_id, company_id, client_request_id,
    payload_hash, status
  ) VALUES (
    p_conversation_id, v_user, v_conversation.company_id, p_client_request_id,
    encode(digest(p_user_message, 'sha256'), 'hex'), 'accepted'
  )
  RETURNING id INTO v_run_id;

  -- Claim the active slot.
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

-- ---------------------------------------------------------------------------
-- sa_finish_run: atomically write the assistant message, terminalize the run,
-- and free the active slot. p_assistant_content may be NULL for failures.
-- ---------------------------------------------------------------------------
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

  -- Terminal runs are immutable; late finishers are no-ops (idempotency guard).
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

-- ---------------------------------------------------------------------------
-- sa_get_state: reconnect fetch. Owner-scoped snapshot of a conversation:
-- messages + active run status, for UI resume after refresh/reconnect.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sa_get_state(
  p_conversation_id uuid
)
RETURNS TABLE (
  conversation_id uuid,
  active_run_id uuid,
  run_status text,
  messages jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_conversation RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_conversation
  FROM public.smart_assistant_conversations c
  WHERE c.id = p_conversation_id AND c.user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_conversation.id,
    v_conversation.active_run_id,
    (SELECT r.status FROM public.smart_assistant_runs r
      WHERE r.id = v_conversation.active_run_id),
    (SELECT COALESCE(jsonb_agg(m ORDER BY m.created_at, m.id), '[]'::jsonb)
       FROM public.smart_assistant_messages m
      WHERE m.conversation_id = v_conversation.id);
END;
$$;

REVOKE ALL ON FUNCTION public.sa_get_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_get_state(uuid) TO authenticated;

-- digest() comes from pgcrypto; enable defensively (idempotent).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
