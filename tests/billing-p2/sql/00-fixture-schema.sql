-- TEST ONLY. Synthetic schema with relevant bodies extracted from supplied source.
-- Does not include missing live quote-status trigger, latest scan queue/calibration
-- functions, bucket policies or active Assistant orchestrator. Not a full-schema proof.
-- ============================================================
-- Billing Hardening P1 - disposable acceptance harness (schema + BEFORE fixtures)
-- Faithful column subsets pulled from the live shared DB (information_schema 2026-10-10).
-- Destroyed after the run. No real customer data.
-- ============================================================

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  plan_code text NOT NULL,
  subscription_status text NOT NULL,
  billing_model text NOT NULL DEFAULT 'legacy',
  stripe_mode text,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancel_at timestamptz,
  comp_until timestamptz,
  admin_override_plan_code text,
  admin_override_until timestamptz,
  admin_paused boolean NOT NULL DEFAULT false,
  first_payment_failure_at timestamptz,
  dunning_stage_entered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_custom_billing (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id),
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  catalog_id text NOT NULL,
  catalog_revision text NOT NULL,
  component_codes jsonb NOT NULL,
  purchased_entitlements jsonb NOT NULL,
  provider_status text NOT NULL,
  currency text NOT NULL,
  monthly_cents bigint NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  last_paid_invoice_id text,
  legacy_plan_code_snapshot text,
  reconciled_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.custom_billing_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  stripe_mode text NOT NULL,
  operation_key text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  subscription_id text,
  catalog_revision text NOT NULL,
  proposed_component_codes jsonb NOT NULL,
  provider_invoice_id text,
  provider_checkout_id text,
  provider_schedule_id text,
  requested_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.custom_billing_period_grants (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  stripe_mode text NOT NULL,
  subscription_id text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  invoice_id text NOT NULL,
  granted_limits jsonb NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, stripe_mode, subscription_id, period_start)
);


ALTER TABLE public.companies ADD COLUMN storage_used_bytes bigint NOT NULL DEFAULT 0,
 ADD COLUMN storage_topup_bytes bigint NOT NULL DEFAULT 0,
 ADD COLUMN ai_assist_points_used integer NOT NULL DEFAULT 0,
 ADD COLUMN ai_assist_points_reset_at timestamptz;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('test.role',true),''),'service_role') $$;
CREATE TABLE public.users(id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id));
CREATE TYPE public.measurement_system AS ENUM('metric','imperial_ft','imperial_rs');
CREATE TYPE public.trade AS ENUM('roofing','cladding','generic','flooring');
CREATE TABLE public.quotes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES companies(id),
 template_id uuid,customer_name text NOT NULL,customer_email text,customer_phone text,job_name text,site_address text,
 tax_rate numeric,notes_internal text,created_by_user_id uuid,global_pitch_degrees numeric,
 measurement_system measurement_system,cq_company_name text,cq_company_address text,cq_company_phone text,
 cq_company_email text,cq_company_logo_url text,cq_footer_text text,currency text,entry_mode text,
 material_margin_percent numeric,labor_margin_percent numeric,material_margin_enabled boolean,
 labor_margin_enabled boolean,trade trade,component_collection_id uuid,status text NOT NULL DEFAULT 'draft');
CREATE TABLE public.quote_files(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES companies(id),
 quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,storage_path text NOT NULL UNIQUE,file_size bigint NOT NULL CHECK(file_size>=0),
 file_type text NOT NULL DEFAULT 'plan');
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL,name text NOT NULL,metadata jsonb,
 UNIQUE(bucket_id,name));
CREATE TABLE public.company_quote_usage(company_id uuid REFERENCES companies(id),period_start date,quotes_created integer NOT NULL DEFAULT 0,
 PRIMARY KEY(company_id,period_start),CHECK(quotes_created>=0));
CREATE TABLE public.subscription_plans(code text PRIMARY KEY,monthly_quote_limit integer,ai_assist_points_limit integer,
 feat_digital_takeoff boolean DEFAULT false,feat_flashings boolean DEFAULT false,feat_material_orders boolean DEFAULT false,
 feat_followups boolean DEFAULT false,feat_email_send boolean DEFAULT false,feat_activity_card boolean DEFAULT false,
 feat_catalogs boolean DEFAULT false,feat_attachment_library boolean DEFAULT false,feat_invoices boolean DEFAULT false,feat_message_center boolean DEFAULT false);
CREATE TABLE public.assistant_feature_flags(company_id uuid PRIMARY KEY REFERENCES companies(id),enabled boolean DEFAULT false,
 quota_monthly_turns integer DEFAULT 500);
CREATE TABLE public.smart_assistant_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES companies(id),
 user_id uuid NOT NULL REFERENCES users(id),active_run_id uuid,last_active_at timestamptz,updated_at timestamptz DEFAULT now());
CREATE TABLE public.smart_assistant_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES smart_assistant_conversations(id),
 company_id uuid NOT NULL REFERENCES companies(id),user_id uuid NOT NULL REFERENCES users(id),client_request_id text,payload_hash text,status text,
 started_at timestamptz DEFAULT now(),finished_at timestamptz,error_code text,UNIQUE(conversation_id,client_request_id));
CREATE TABLE public.smart_assistant_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid REFERENCES smart_assistant_conversations(id),
 run_id uuid,role text,content text,created_at timestamptz DEFAULT now());
CREATE TABLE public.assistant_turn_reservations(run_id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id),user_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz DEFAULT now());
CREATE TABLE public.assistant_usage_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid,user_id uuid,
 run_id uuid UNIQUE,status text,tokens_in bigint,tokens_out bigint,created_at timestamptz DEFAULT now());
CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- Admin comp override beats everything until admin_override_until.
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN c.admin_override_plan_code
    -- Admin comp override beats everything until comp_until.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    -- Custom-setup (V5) billing: healthy custom subscriptions ride the most
    -- permissive legacy basis so legacy slot/feature gates never undercut a
    -- paid custom setup; the custom snapshot must still own purchased caps.
    -- Invalid/expired custom access returns free explicitly, never the old plan.
    WHEN c.billing_model = 'custom_setup' THEN
      CASE WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
        AND EXISTS (
          SELECT 1 FROM public.company_custom_billing cb
          WHERE cb.company_id = c.id
            AND cb.stripe_mode = c.stripe_mode
            AND cb.stripe_subscription_id = c.stripe_subscription_id
            AND cb.stripe_customer_id = c.stripe_customer_id
            AND cb.provider_status IN ('active','trialing','past_due','unpaid','disputed')
            AND cb.period_start <= now() AND cb.period_end > now()
        ) THEN 'pro_plus' ELSE 'free' END
    -- Trial expired with no Stripe subscription: collapses to free.
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN 'free'
    -- Healthy states (active / trialing / past_due, plus disputed-with-
    -- ticket-open per section 9.6) keep their purchased plan.
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN c.plan_code
    -- Grace / pending_data_purge / cancellation_pending: collapse to free
    -- (read-only on gated features; existing data still viewable).
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN 'free'
    -- Suspended / canceled: fully locked elsewhere via _active = false.
    ELSE 'free'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;
CREATE OR REPLACE FUNCTION public.company_effective_plan_active(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN c.admin_paused = true
      THEN false
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN true
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN true
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN true
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN true
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN true
    ELSE false
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
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
CREATE OR REPLACE FUNCTION public.reset_ai_assist_points(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE companies
  SET ai_assist_points_used = 0,
      ai_assist_points_reset_at = now()
  WHERE id = p_company_id;
END;
$function$;
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
CREATE OR REPLACE FUNCTION public.sa_finish_run(p_run_id uuid, p_status text, p_error_code text DEFAULT NULL::text, p_assistant_content text DEFAULT NULL::text, p_tokens_in bigint DEFAULT 0, p_tokens_out bigint DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.smart_assistant_enabled(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT f.enabled FROM public.assistant_feature_flags f
      WHERE f.company_id = p_company_id),
    false
  );
$$;
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
CREATE OR REPLACE FUNCTION public.update_company_storage_usage()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
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
END $$;
CREATE TRIGGER trg_update_company_storage AFTER INSERT OR UPDATE OR DELETE ON public.quote_files
 FOR EACH ROW EXECUTE FUNCTION public.update_company_storage_usage();
CREATE SCHEMA qcp_test;
CREATE TABLE qcp_test.results(label text PRIMARY KEY);
CREATE FUNCTION qcp_test.check(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',label; END IF;
 INSERT INTO qcp_test.results VALUES(label); END $$;
CREATE FUNCTION qcp_test.throws(command text,expected_state text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean:=false; BEGIN
 BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>expected_state THEN RAISE EXCEPTION 'FAILED: % expected %, got %: %',label,expected_state,SQLSTATE,SQLERRM; END IF;
  caught:=true;
 END;
 PERFORM qcp_test.check(caught,label);
END $$;
-- Snapshot original prosrc and OID. RLS dependencies must keep the public OID.
CREATE TABLE qcp_test.original_functions AS SELECT oid,proname,prosrc FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname IN('create_quote_atomic','sa_check_turn_quota','get_ai_assist_points_status','company_has_feature');

CREATE TABLE public.ai_scan_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid REFERENCES companies(id));
CREATE TABLE public.calibration_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid REFERENCES companies(id));
