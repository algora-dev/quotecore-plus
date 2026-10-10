-- Additive custom-billing hardening. Apply on testing first, after the two supplied migrations.
-- Does not edit subscription_plans, prices, legacy plan_code or existing subscriptions.
BEGIN;
ALTER TABLE public.custom_billing_operations
  ADD COLUMN IF NOT EXISTS selection_key text,
  ADD COLUMN IF NOT EXISTS checkout_request jsonb,
  ADD COLUMN IF NOT EXISTS previous_subscription_id text,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz;

CREATE TABLE IF NOT EXISTS public.custom_billing_reconcile_cursors (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  fence bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(company_id, stripe_mode)
);
CREATE TABLE IF NOT EXISTS public.custom_billing_event_receipts (
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  event_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  result text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(stripe_account_id, stripe_mode, event_id)
);
ALTER TABLE public.custom_billing_reconcile_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_billing_event_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.custom_billing_reconcile_cursors, public.custom_billing_event_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_billing_reconcile_cursors, public.custom_billing_event_receipts TO service_role;

-- One operation and one provider session per company at a time. Selection changes
-- must recover/expire the old provider session before its operation is canceled.
CREATE OR REPLACE FUNCTION public.qcp_claim_custom_checkout(
  p_company_id uuid, p_mode text, p_selection_key text, p_request jsonb,
  p_codes jsonb, p_revision text, p_user_id uuid, p_lease uuid,
  p_previous_subscription_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c public.companies%ROWTYPE; op public.custom_billing_operations%ROWTYPE;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('test','live') OR jsonb_typeof(p_request) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_codes) IS DISTINCT FROM 'array' OR p_lease IS NULL OR p_selection_key IS NULL OR p_revision IS NULL THEN
    RAISE EXCEPTION 'invalid checkout claim';
  END IF;
  SELECT * INTO c FROM public.companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND OR c.admin_paused THEN RETURN jsonb_build_object('code','company_unavailable'); END IF;
  IF c.stripe_mode IS NOT NULL AND c.stripe_mode <> p_mode THEN RETURN jsonb_build_object('code','company_mode_mismatch'); END IF;
  IF c.stripe_subscription_id IS DISTINCT FROM p_previous_subscription_id THEN
    RETURN jsonb_build_object('code','subscription_exists');
  END IF;
  IF EXISTS (SELECT 1 FROM public.custom_billing_operations
    WHERE company_id=p_company_id AND stripe_mode <> p_mode
      AND kind IN ('checkout','change','legacy_switch') AND status IN ('confirmed','pending')) THEN
    RETURN jsonb_build_object('code','company_mode_mismatch');
  END IF;
  SELECT * INTO op FROM public.custom_billing_operations
    WHERE company_id = p_company_id AND stripe_mode = p_mode
      AND kind IN ('checkout','change','legacy_switch') AND status IN ('confirmed','pending')
    FOR UPDATE;
  IF FOUND THEN
    IF op.kind <> 'checkout' OR op.checkout_request IS NULL THEN
      RETURN jsonb_build_object('code','checkout_recovery_required');
    END IF;
    IF op.lease_until > clock_timestamp() THEN RETURN jsonb_build_object('code','checkout_busy'); END IF;
    UPDATE public.custom_billing_operations SET lease_token = p_lease,
      lease_until = clock_timestamp() + interval '90 seconds', updated_at = clock_timestamp()
      WHERE id = op.id RETURNING * INTO op;
    RETURN to_jsonb(op);
  END IF;
  INSERT INTO public.custom_billing_operations (
    company_id, stripe_mode, operation_key, kind, status, catalog_revision,
    proposed_component_codes, requested_by, selection_key, checkout_request,
    previous_subscription_id, lease_token, lease_until
  ) VALUES (
    p_company_id, p_mode, 'checkout:' || gen_random_uuid()::text, 'checkout', 'pending', p_revision,
    p_codes, p_user_id, p_selection_key, p_request, p_previous_subscription_id,
    p_lease, clock_timestamp() + interval '90 seconds'
  ) RETURNING * INTO op;
  RETURN to_jsonb(op);
END $$;
REVOKE ALL ON FUNCTION public.qcp_claim_custom_checkout(uuid,text,text,jsonb,jsonb,text,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_claim_custom_checkout(uuid,text,text,jsonb,jsonb,text,uuid,uuid,text) TO service_role;

-- Issue a monotonically increasing ticket BEFORE reading Stripe. A slower,
-- older reconciliation cannot commit after a newer fetch has started.
CREATE OR REPLACE FUNCTION public.qcp_begin_custom_reconcile(p_company_id uuid, p_mode text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE token bigint;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('test','live') THEN RAISE EXCEPTION 'invalid mode'; END IF;
  INSERT INTO public.custom_billing_reconcile_cursors(company_id,stripe_mode,fence)
    VALUES(p_company_id,p_mode,1)
    ON CONFLICT(company_id,stripe_mode) DO UPDATE SET fence = custom_billing_reconcile_cursors.fence + 1
    RETURNING fence INTO token;
  RETURN token;
END $$;
REVOKE ALL ON FUNCTION public.qcp_begin_custom_reconcile(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_begin_custom_reconcile(uuid,text) TO service_role;

-- The server has verified provider identity, COMPLETE item/price/period evidence
-- and the current paid invoice before calling kind='paid'. This transaction owns
-- snapshot, company, immutable period grant, operation completion and audit.
-- It NEVER resets any quote, scan or Assistant usage counter.
CREATE OR REPLACE FUNCTION public.qcp_apply_custom_reconcile(
  p_company_id uuid, p_fence bigint, p_payload jsonb, p_event jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  c public.companies%ROWTYPE;
  prior public.company_custom_billing%ROWTYPE;
  op public.custom_billing_operations%ROWTYPE;
  prior_grant public.custom_billing_period_grants%ROWTYPE;
  v_mode text := p_payload->>'stripe_mode';
  v_account text := p_payload->>'stripe_account_id';
  v_sub text := p_payload->>'stripe_subscription_id';
  v_customer text := p_payload->>'stripe_customer_id';
  v_status text := p_payload->>'provider_status';
  v_kind text := p_payload->>'kind';
  v_result text; v_internal text; v_current_fence bigint;
  v_start timestamptz; v_end timestamptz; v_legacy text;
BEGIN
  IF v_mode IS NULL OR v_kind IS NULL OR v_mode NOT IN ('test','live') OR v_kind NOT IN ('paid','state')
    OR v_account IS NULL OR v_sub IS NULL OR v_customer IS NULL OR p_event->>'id' IS NULL THEN
    RAISE EXCEPTION 'invalid reconciliation payload';
  END IF;
  -- Keep the same lock order: cursor, then company. Cursor row remains locked
  -- until commit so a new ticket cannot slip between comparison and writes.
  SELECT fence INTO v_current_fence FROM public.custom_billing_reconcile_cursors
    WHERE company_id=p_company_id AND stripe_mode=v_mode FOR UPDATE;
  IF v_current_fence IS DISTINCT FROM p_fence THEN RETURN 'ignored:superseded_reconcile'; END IF;
  SELECT * INTO c FROM public.companies WHERE id=p_company_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'quarantined:company_not_found'; END IF;
  IF c.admin_paused THEN RETURN 'ok:admin_paused'; END IF;
  IF c.stripe_mode IS NOT NULL AND c.stripe_mode <> v_mode THEN RETURN 'quarantined:company_mode_mismatch'; END IF;
  SELECT result INTO v_result FROM public.custom_billing_event_receipts
    WHERE stripe_account_id=v_account AND stripe_mode=v_mode AND event_id=p_event->>'id';
  IF FOUND THEN RETURN v_result; END IF;
  SELECT * INTO prior FROM public.company_custom_billing WHERE company_id=p_company_id FOR UPDATE;
  IF FOUND AND (prior.stripe_mode <> v_mode OR prior.stripe_account_id <> v_account) THEN
    RETURN 'quarantined:snapshot_scope_mismatch';
  END IF;

  IF p_payload->>'operation_id' IS NOT NULL THEN
    SELECT * INTO op FROM public.custom_billing_operations
      WHERE id=(p_payload->>'operation_id')::uuid AND company_id=p_company_id AND stripe_mode=v_mode FOR UPDATE;
    IF NOT FOUND OR op.kind <> 'checkout' OR op.status NOT IN ('pending','applied') THEN
      RETURN 'quarantined:untrusted_checkout_operation';
    END IF;
  END IF;

  -- First link/replacement requires our durable checkout operation. A canceled
  -- local status alone is not authority to replace an existing subscription.
  IF c.stripe_subscription_id IS DISTINCT FROM v_sub THEN
    IF op.id IS NULL OR op.status <> 'pending'
      OR c.stripe_subscription_id IS DISTINCT FROM op.previous_subscription_id THEN
      RETURN 'quarantined:subscription_identity_mismatch';
    END IF;
  END IF;
  IF c.stripe_customer_id IS NOT NULL AND c.stripe_customer_id <> v_customer THEN
    RETURN 'quarantined:customer_identity_mismatch';
  END IF;

  IF v_kind = 'state' THEN
    IF c.billing_model <> 'custom_setup' OR prior.company_id IS NULL
      OR prior.stripe_subscription_id <> v_sub OR c.stripe_subscription_id <> v_sub THEN
      RETURN 'deferred:awaiting_first_paid_invoice';
    END IF;
    v_internal := c.subscription_status;
    IF v_status IN ('canceled','incomplete_expired') THEN
      v_internal := 'canceled';
    ELSIF v_status IN ('past_due','unpaid') AND c.subscription_status NOT IN
      ('disputed','grace','pending_data_purge','suspended','canceled','cancellation_pending') THEN
      v_internal := 'past_due';
    END IF;
    UPDATE public.company_custom_billing SET provider_status=v_status, reconciled_at=clock_timestamp()
      WHERE company_id=p_company_id;
    UPDATE public.companies SET subscription_status=v_internal,
      cancel_at_period_end=CASE WHEN v_status IN ('canceled','incomplete_expired') THEN false ELSE COALESCE((p_payload->>'cancel_at_period_end')::boolean,false) END,
      cancel_at=CASE WHEN v_status IN ('canceled','incomplete_expired') THEN NULL ELSE (p_payload->>'cancel_at')::timestamptz END,
      first_payment_failure_at=CASE WHEN v_internal='past_due' THEN COALESCE(first_payment_failure_at,clock_timestamp()) ELSE first_payment_failure_at END,
      dunning_stage_entered_at=CASE WHEN v_internal='past_due' THEN COALESCE(dunning_stage_entered_at,clock_timestamp()) ELSE dunning_stage_entered_at END
      WHERE id=p_company_id;
    v_result := 'ok:custom_state';
  ELSE
    IF v_status NOT IN ('active','trialing') THEN RAISE EXCEPTION 'paid snapshot with nonpaying status'; END IF;
    IF jsonb_typeof(p_payload->'component_codes') IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_payload->'purchased_entitlements') IS DISTINCT FROM 'object'
      OR p_payload->>'last_paid_invoice_id' IS NULL THEN RAISE EXCEPTION 'paid snapshot incomplete'; END IF;
    v_start := (p_payload->>'period_start')::timestamptz;
    v_end := (p_payload->>'period_end')::timestamptz;
    IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start THEN RAISE EXCEPTION 'invalid paid period'; END IF;
    IF op.id IS NOT NULL AND NOT (op.proposed_component_codes @> (p_payload->'component_codes') AND op.proposed_component_codes <@ (p_payload->'component_codes')) THEN
      RETURN 'quarantined:checkout_selection_mismatch';
    END IF;
    IF prior.company_id IS NOT NULL AND prior.stripe_subscription_id=v_sub THEN
      IF v_start < prior.period_start THEN RETURN 'ignored:older_paid_period'; END IF;
      IF v_start = prior.period_start AND (v_end <> prior.period_end OR prior.purchased_entitlements IS DISTINCT FROM p_payload->'purchased_entitlements'
        OR NOT (prior.component_codes @> (p_payload->'component_codes') AND prior.component_codes <@ (p_payload->'component_codes'))) THEN
        RETURN 'quarantined:midperiod_change_needs_review';
      END IF;
    END IF;
    -- Grant dedupe is separate from event dedupe. invoice.paid and
    -- invoice.payment_succeeded are different events for the same allowance.
    SELECT * INTO prior_grant FROM public.custom_billing_period_grants
      WHERE company_id=p_company_id AND stripe_mode=v_mode AND subscription_id=v_sub AND period_start=v_start;
    IF FOUND AND (prior_grant.period_end <> v_end OR prior_grant.granted_limits IS DISTINCT FROM p_payload->'purchased_entitlements') THEN
      RETURN 'quarantined:existing_grant_conflicts';
    END IF;
    v_legacy := COALESCE(prior.legacy_plan_code_snapshot, CASE WHEN c.billing_model='legacy' THEN c.plan_code END);
    INSERT INTO public.company_custom_billing(company_id,stripe_account_id,stripe_mode,stripe_customer_id,stripe_subscription_id,
      catalog_id,catalog_revision,component_codes,purchased_entitlements,provider_status,currency,monthly_cents,period_start,period_end,
      last_paid_invoice_id,legacy_plan_code_snapshot,reconciled_at)
      VALUES(p_company_id,v_account,v_mode,v_customer,v_sub,p_payload->>'catalog_id',p_payload->>'catalog_revision',
        p_payload->'component_codes',p_payload->'purchased_entitlements',v_status,p_payload->>'currency',(p_payload->>'monthly_cents')::bigint,
        v_start,v_end,p_payload->>'last_paid_invoice_id',v_legacy,clock_timestamp())
      ON CONFLICT(company_id) DO UPDATE SET stripe_account_id=EXCLUDED.stripe_account_id,stripe_mode=EXCLUDED.stripe_mode,
        stripe_customer_id=EXCLUDED.stripe_customer_id,stripe_subscription_id=EXCLUDED.stripe_subscription_id,catalog_id=EXCLUDED.catalog_id,
        catalog_revision=EXCLUDED.catalog_revision,component_codes=EXCLUDED.component_codes,purchased_entitlements=EXCLUDED.purchased_entitlements,
        provider_status=EXCLUDED.provider_status,currency=EXCLUDED.currency,monthly_cents=EXCLUDED.monthly_cents,period_start=EXCLUDED.period_start,
        period_end=EXCLUDED.period_end,last_paid_invoice_id=EXCLUDED.last_paid_invoice_id,legacy_plan_code_snapshot=EXCLUDED.legacy_plan_code_snapshot,reconciled_at=EXCLUDED.reconciled_at;
    v_internal := CASE WHEN c.subscription_status='disputed' THEN 'disputed' WHEN v_status='trialing' THEN 'trialing' ELSE 'active' END;
    UPDATE public.companies SET billing_model='custom_setup',stripe_mode=v_mode,stripe_customer_id=v_customer,
      stripe_subscription_id=v_sub,subscription_status=v_internal,current_period_end=v_end,
      cancel_at_period_end=COALESCE((p_payload->>'cancel_at_period_end')::boolean,false),cancel_at=(p_payload->>'cancel_at')::timestamptz,
      first_payment_failure_at=NULL,dunning_stage_entered_at=NULL WHERE id=p_company_id;
    INSERT INTO public.custom_billing_period_grants(company_id,stripe_mode,subscription_id,period_start,period_end,invoice_id,granted_limits)
      VALUES(p_company_id,v_mode,v_sub,v_start,v_end,p_payload->>'last_paid_invoice_id',p_payload->'purchased_entitlements')
      ON CONFLICT(company_id,stripe_mode,subscription_id,period_start) DO NOTHING;
    IF op.id IS NOT NULL AND op.status='pending' THEN
      UPDATE public.custom_billing_operations SET status='applied',subscription_id=v_sub,
        provider_invoice_id=p_payload->>'last_paid_invoice_id',confirmed_at=clock_timestamp(),updated_at=clock_timestamp(),lease_token=NULL,lease_until=NULL
        WHERE id=op.id;
    END IF;
    v_result := 'ok:custom_paid_period';
  END IF;
  INSERT INTO public.subscription_events(company_id,event_type,from_plan_code,to_plan_code,from_status,to_status,
    stripe_event_id,stripe_event_type,stripe_event_created,notes,stripe_payload)
    VALUES(p_company_id,CASE WHEN v_status='canceled' THEN 'downgraded' ELSE 'updated' END,c.plan_code,c.plan_code,
      c.subscription_status,v_internal,p_event->>'id',p_event->>'type',to_timestamp((p_event->>'created')::double precision),v_result,p_event);
  INSERT INTO public.custom_billing_event_receipts(stripe_account_id,stripe_mode,event_id,company_id,result)
    VALUES(v_account,v_mode,p_event->>'id',p_company_id,v_result);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.qcp_apply_custom_reconcile(uuid,bigint,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_apply_custom_reconcile(uuid,bigint,jsonb,jsonb) TO service_role;
COMMIT;
