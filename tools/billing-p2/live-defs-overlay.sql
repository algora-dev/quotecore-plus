-- LIVE definitions captured read-only from the shared DB (sanitized: schema only).

-- Used ONLY in the disposable overlay harness to validate P2 migration 4 against actual bodies.

CREATE OR REPLACE FUNCTION public.create_quote_atomic(p_company_id uuid, p_user_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period date := date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
  v_used   integer;
  v_limit  integer;
  v_active boolean;
  v_effective_code text;
  v_quote_id uuid;
  v_company_exists boolean;
BEGIN
  -- Validate the company exists at all (defends against a stale UI passing
  -- a deleted company id).
  SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = p_company_id) INTO v_company_exists;
  IF NOT v_company_exists THEN
    RAISE EXCEPTION 'unknown_company' USING ERRCODE = 'P0003';
  END IF;

  -- Advisory lock: serialise quote creation per company. 64-bit lock key
  -- derived from the company uuid. Released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text)::bigint);

  -- Active-subscription check.
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- Monthly limit check (always; clones included).
  -- NOTE (2026-07-05): the counter is now incremented by the status-change
  -- trigger, NOT here. We still check the limit so a user can't stockpile
  -- unlimited drafts and then mass-confirm them. But the check counts
  -- non-draft quotes, not total creates.
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.monthly_quote_limit
    INTO v_limit
    FROM public.subscription_plans sp
    WHERE sp.code = v_effective_code;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'plan_not_found:%', v_effective_code USING ERRCODE = 'P0003';
  END IF;

  -- Count non-draft quotes this month (trigger-maintained counter).
  SELECT COALESCE(quotes_created, 0)
    INTO v_used
    FROM public.company_quote_usage
    WHERE company_id = p_company_id AND period_start = v_period;

  IF v_used IS NULL THEN v_used := 0; END IF;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'quote_limit_reached'
      USING ERRCODE = 'P0002',
            DETAIL = format('used=%s limit=%s period_start=%s plan=%s',
                            v_used, v_limit, v_period, v_effective_code);
  END IF;

  -- Insert the quote. We explicitly project columns from p_payload so callers
  -- can't sneak in (for example) company_id overrides or quote_number values.
  -- Any field the caller doesn't supply uses the column default.
  INSERT INTO public.quotes (
    company_id,
    template_id,
    customer_name,
    customer_email,
    customer_phone,
    job_name,
    site_address,
    tax_rate,
    notes_internal,
    created_by_user_id,
    global_pitch_degrees,
    measurement_system,
    cq_company_name,
    cq_company_address,
    cq_company_phone,
    cq_company_email,
    cq_company_logo_url,
    cq_footer_text,
    currency,
    entry_mode,
    material_margin_percent,
    labor_margin_percent,
    material_margin_enabled,
    labor_margin_enabled,
    trade,
    component_collection_id
  )
  VALUES (
    p_company_id,
    NULLIF(p_payload->>'template_id', '')::uuid,
    p_payload->>'customer_name',
    NULLIF(p_payload->>'customer_email', ''),
    NULLIF(p_payload->>'customer_phone', ''),
    NULLIF(p_payload->>'job_name', ''),
    NULLIF(p_payload->>'site_address', ''),
    COALESCE((p_payload->>'tax_rate')::numeric, 0),
    NULLIF(p_payload->>'notes_internal', ''),
    p_user_id,
    NULLIF(p_payload->>'global_pitch_degrees', '')::numeric,
    COALESCE((p_payload->>'measurement_system')::measurement_system, 'metric'::measurement_system),
    NULLIF(p_payload->>'cq_company_name', ''),
    NULLIF(p_payload->>'cq_company_address', ''),
    NULLIF(p_payload->>'cq_company_phone', ''),
    NULLIF(p_payload->>'cq_company_email', ''),
    NULLIF(p_payload->>'cq_company_logo_url', ''),
    NULLIF(p_payload->>'cq_footer_text', ''),
    COALESCE(NULLIF(p_payload->>'currency', ''), 'NZD'),
    COALESCE(NULLIF(p_payload->>'entry_mode', ''), 'manual'),
    NULLIF(p_payload->>'material_margin_percent', '')::numeric,
    NULLIF(p_payload->>'labor_margin_percent', '')::numeric,
    COALESCE((p_payload->>'material_margin_enabled')::boolean, false),
    COALESCE((p_payload->>'labor_margin_enabled')::boolean, false),
    COALESCE((p_payload->>'trade')::trade, 'roofing'::trade),
    NULLIF(p_payload->>'component_collection_id', '')::uuid
  )
  RETURNING id INTO v_quote_id;

  -- NO increment here. The trg_quote_status_change trigger fires when
  -- status moves from 'draft' to a real status.

  RETURN v_quote_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.company_has_feature(p_company_id uuid, p_feature text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_effective_code text;
  v_allowed boolean;
BEGIN
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT CASE p_feature
    WHEN 'digital_takeoff'    THEN sp.feat_digital_takeoff
    WHEN 'flashings'          THEN sp.feat_flashings
    WHEN 'material_orders'    THEN sp.feat_material_orders
    WHEN 'followups'          THEN sp.feat_followups
    WHEN 'email_send'         THEN sp.feat_email_send
    WHEN 'activity_card'      THEN sp.feat_activity_card
    WHEN 'catalogs'           THEN sp.feat_catalogs
    WHEN 'attachment_library' THEN sp.feat_attachment_library
    WHEN 'invoices'           THEN sp.feat_invoices            -- ? new
    WHEN 'message_center'     THEN sp.feat_message_center      -- ? new
    ELSE false
  END
  INTO v_allowed
  FROM public.subscription_plans sp
  WHERE sp.code = v_effective_code;

  RETURN COALESCE(v_allowed, false);
END $function$;

CREATE OR REPLACE FUNCTION public.get_ai_assist_points_status(p_company_id uuid)
 RETURNS TABLE(used integer, point_limit integer, remaining integer, is_blocked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_effective_plan text;
  v_point_limit integer;
  v_points_used integer;
BEGIN
  SELECT public.company_effective_plan_code(p_company_id) INTO v_effective_plan;
  IF v_effective_plan IS NULL THEN
    RETURN QUERY SELECT 0, NULL, 0, true;
    RETURN;
  END IF;

  SELECT sp.ai_assist_points_limit INTO v_point_limit
  FROM subscription_plans sp
  WHERE sp.code = v_effective_plan;

  SELECT c.ai_assist_points_used INTO v_points_used
  FROM companies c
  WHERE c.id = p_company_id;

  IF v_point_limit IS NULL THEN
    RETURN QUERY SELECT 0, NULL, 0, true;
  ELSE
    RETURN QUERY SELECT v_points_used, v_point_limit, GREATEST(v_point_limit - v_points_used, 0), false;
  END IF;
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sa_check_turn_quota(p_company_id uuid)
 RETURNS TABLE(allowed boolean, used integer, cap integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_quote_status_usage_delta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period date := date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
  v_company_exists boolean;
BEGIN
  -- Only fire on status changes where OLD was 'draft' and NEW is not 'draft'.
  -- This is the "first real save" - draft becomes confirmed/sent/etc.
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.status = 'draft' AND NEW.status <> 'draft' THEN
      INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
      VALUES (NEW.company_id, v_period, 1)
      ON CONFLICT (company_id, period_start)
        DO UPDATE SET quotes_created = company_quote_usage.quotes_created + 1;
    ELSIF OLD.status <> 'draft' AND NEW.status = 'draft' THEN
      -- Reverting back to draft: refund the slot.
      INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
      VALUES (NEW.company_id, v_period, 0)
      ON CONFLICT (company_id, period_start)
        DO UPDATE SET quotes_created = GREATEST(company_quote_usage.quotes_created - 1, 0);
    END IF;
    RETURN NEW;
  END IF;

  -- On hard delete of a non-draft quote: refund the slot.
  -- BUT skip if the company is being deleted (cascade) - the company row
  -- is already gone, so the FK insert would fail and there's no point
  -- maintaining a usage counter for a deleted company.
  IF (TG_OP = 'DELETE') THEN
    IF OLD.status <> 'draft' THEN
      SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = OLD.company_id)
        INTO v_company_exists;
      IF v_company_exists THEN
        INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
        VALUES (OLD.company_id, v_period, 0)
        ON CONFLICT (company_id, period_start)
          DO UPDATE SET quotes_created = GREATEST(company_quote_usage.quotes_created - 1, 0);
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sa_admit_run(p_conversation_id uuid, p_user_message text, p_client_request_id text)
 RETURNS TABLE(ok boolean, status text, run_id uuid, message_id uuid, error_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.update_company_storage_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.companies
    SET storage_used_bytes = storage_used_bytes + NEW.file_size
    WHERE id = NEW.company_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.companies
    SET storage_used_bytes = storage_used_bytes - OLD.file_size
    WHERE id = OLD.company_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.file_size != OLD.file_size THEN
      UPDATE public.companies
      SET storage_used_bytes = storage_used_bytes - OLD.file_size + NEW.file_size
      WHERE id = NEW.company_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $function$;
