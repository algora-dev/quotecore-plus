-- patch_047: Smart Assistant harness bug fixes (2026-09-20)
-- 1. sa_admit_run: idempotency block fell through after RETURN QUERY (missing
--    bare RETURN;) -> duplicate replay / request_id_conflict hit the runs
--    INSERT -> 23505 -> HTTP 500. Same bug existed in patch_045.
-- 2. sa_get_state: no feature-flag gate -> flag-off companies could still
--    fetch conversation state. Now returns zero rows when the company flag
--    is off (flag off = invisible everywhere).

CREATE OR REPLACE FUNCTION public.sa_admit_run(p_conversation_id uuid, p_user_message text, p_client_request_id text)
 RETURNS TABLE(ok boolean, status text, run_id uuid, message_id uuid, error_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
    IF v_existing_run.payload_hash IS DISTINCT FROM v_payload THEN
      RETURN QUERY SELECT false, 'refused', NULL::uuid, NULL::uuid, 'request_id_conflict';
      RETURN;
    END IF;
    RETURN QUERY SELECT true, 'duplicate', v_existing_run.id, NULL::uuid, NULL::text;
    RETURN;
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
$function$;

CREATE OR REPLACE FUNCTION public.sa_get_state(p_conversation_id uuid)
 RETURNS TABLE(conversation_id uuid, active_run_id uuid, run_status text, messages jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_conversation RECORD;
  v_flag boolean;
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

  -- Flag off = invisible everywhere: same zero-row answer as not-found.
  SELECT public.smart_assistant_enabled(v_conversation.company_id) INTO v_flag;
  IF NOT COALESCE(v_flag, false) THEN
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
$function$;
