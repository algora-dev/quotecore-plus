-- QuoteCore+ P3 completion: payment attention, refund observation, custom voice
-- provider safety budget, and a bounded failed-renewal grace window.
--
-- Invariants:
--   * additive/nullable only; legacy billing behavior is not changed;
--   * failed renewal never creates a new paid-period grant;
--   * custom grace can spend only the LAST PAID grant, for at most 7 days;
--   * Stripe refunds are observed/audited only and never restore usage;
--   * voice transcription is internal provider spend, not a second Assistant Task;
--   * no voice policy is enabled by this migration.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE TABLE IF NOT EXISTS public.qcp_payment_attention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  subscription_id text NOT NULL,
  invoice_id text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','recovered','subscription_deleted')),
  first_failed_at timestamptz NOT NULL,
  last_failed_at timestamptz NOT NULL,
  failure_count integer NOT NULL DEFAULT 1 CHECK (failure_count >= 1),
  notice_due_at timestamptz NOT NULL,
  notice_sent_at timestamptz,
  resolved_at timestamptz,
  last_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (stripe_account_id, stripe_mode, invoice_id)
);
CREATE INDEX IF NOT EXISTS qcp_payment_attention_open_idx
  ON public.qcp_payment_attention(status, notice_due_at, company_id);
CREATE INDEX IF NOT EXISTS qcp_payment_attention_subscription_idx
  ON public.qcp_payment_attention(company_id, stripe_mode, subscription_id, status);
ALTER TABLE public.qcp_payment_attention ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qcp_payment_attention FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.qcp_payment_attention TO service_role;
COMMENT ON TABLE public.qcp_payment_attention IS
  'Operational dunning/attention records. Does not grant quota and is not a payment ledger.';

CREATE TABLE IF NOT EXISTS public.qcp_refund_observations (
  refund_id text NOT NULL,
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  charge_id text NOT NULL,
  payment_intent_id text,
  invoice_id text,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL CHECK (currency ~ '^[a-zA-Z]{3}$'),
  status text NOT NULL,
  reason text,
  provider_created_at timestamptz NOT NULL,
  last_event_id text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (stripe_account_id, stripe_mode, refund_id)
);
CREATE INDEX IF NOT EXISTS qcp_refund_company_idx
  ON public.qcp_refund_observations(company_id, provider_created_at DESC);
ALTER TABLE public.qcp_refund_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qcp_refund_observations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.qcp_refund_observations TO service_role;
COMMENT ON TABLE public.qcp_refund_observations IS
  'Observed Stripe refunds. Money movement is performed in Stripe; this table never restores QuoteCore+ usage.';

CREATE TABLE IF NOT EXISTS public.qcp_voice_budget_policies (
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  enabled boolean NOT NULL DEFAULT false,
  max_upload_bytes bigint NOT NULL CHECK (max_upload_bytes BETWEEN 1 AND 16777216),
  max_reserve_micro_usd bigint NOT NULL CHECK (max_reserve_micro_usd > 0),
  daily_user_micro_usd bigint NOT NULL CHECK (daily_user_micro_usd > 0),
  daily_company_micro_usd bigint NOT NULL CHECK (daily_company_micro_usd > 0),
  period_company_micro_usd bigint NOT NULL CHECK (period_company_micro_usd > 0),
  reviewed_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (stripe_account_id, stripe_mode)
);

CREATE TABLE IF NOT EXISTS public.qcp_voice_provider_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  subscription_id text NOT NULL,
  period_start timestamptz NOT NULL,
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 200),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  audio_bytes bigint NOT NULL CHECK (audio_bytes > 0),
  reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd > 0),
  charged_micro_usd bigint NOT NULL CHECK (charged_micro_usd >= 0),
  state text NOT NULL CHECK (state IN ('reserved','settled','uncertain')),
  overrun boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  UNIQUE (company_id, request_key)
);
CREATE INDEX IF NOT EXISTS qcp_voice_company_day_idx
  ON public.qcp_voice_provider_calls(company_id, created_at);
ALTER TABLE public.qcp_voice_budget_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qcp_voice_provider_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qcp_voice_budget_policies,public.qcp_voice_provider_calls FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.qcp_voice_budget_policies,public.qcp_voice_provider_calls TO service_role;
COMMENT ON TABLE public.qcp_voice_provider_calls IS
  'Internal transcription spend guard. A voice call is not a customer Assistant Task; the later accepted Assistant request is metered normally.';

CREATE OR REPLACE FUNCTION public.qcp_begin_voice_call(
  p_company_id uuid,
  p_user_id uuid,
  p_account_id text,
  p_mode text,
  p_request_key text,
  p_payload_hash text,
  p_audio_bytes bigint,
  p_reserved_micro_usd bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  c jsonb;
  policy public.qcp_voice_budget_policies%ROWTYPE;
  old_call public.qcp_voice_provider_calls%ROWTYPE;
  n bigint;
  id_n uuid;
  day_start timestamptz := date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
  c:=public.qcp_usage_context(p_company_id);
  IF c IS NULL OR c->>'accountId' IS DISTINCT FROM p_account_id OR c->>'mode' IS DISTINCT FROM p_mode THEN
    RAISE EXCEPTION 'custom_voice_guard_only' USING ERRCODE='QCP08';
  END IF;
  IF COALESCE((c->'limits'->>'assistantTasks')::bigint,0) <= 0 THEN
    RAISE EXCEPTION 'custom_voice_requires_assistant' USING ERRCODE='QCP08';
  END IF;
  SELECT * INTO old_call FROM public.qcp_voice_provider_calls
    WHERE company_id=p_company_id AND request_key=p_request_key;
  IF FOUND THEN
    IF old_call.payload_hash IS DISTINCT FROM p_payload_hash OR old_call.audio_bytes IS DISTINCT FROM p_audio_bytes THEN
      RAISE EXCEPTION 'voice_request_conflict' USING ERRCODE='QCP03';
    END IF;
    RAISE EXCEPTION 'voice_request_already_attempted' USING ERRCODE='QCP03';
  END IF;
  SELECT * INTO policy FROM public.qcp_voice_budget_policies
    WHERE stripe_account_id=p_account_id AND stripe_mode=p_mode AND enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'custom_voice_provider_not_ready' USING ERRCODE='QCP08'; END IF;
  IF EXISTS(SELECT 1 FROM public.qcp_voice_provider_calls
    WHERE company_id=p_company_id AND overrun AND reviewed_at IS NULL) THEN
    RAISE EXCEPTION 'provider_budget_review_required' USING ERRCODE='QCP08';
  END IF;
  IF p_audio_bytes IS NULL OR p_audio_bytes<1 OR p_audio_bytes>policy.max_upload_bytes
     OR p_reserved_micro_usd IS NULL OR p_reserved_micro_usd<1 OR p_reserved_micro_usd>policy.max_reserve_micro_usd
     OR p_payload_hash IS NULL OR p_payload_hash !~ '^[a-f0-9]{64}$'
     OR p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'voice_request_outside_budget' USING ERRCODE='QCP08';
  END IF;
  SELECT COALESCE(sum(charged_micro_usd),0) INTO n FROM public.qcp_voice_provider_calls
    WHERE company_id=p_company_id AND user_id=p_user_id AND created_at>=day_start;
  IF n+p_reserved_micro_usd>policy.daily_user_micro_usd THEN
    RAISE EXCEPTION 'assistant_safety_limit' USING ERRCODE='QCP08';
  END IF;
  SELECT COALESCE(sum(charged_micro_usd),0) INTO n FROM public.qcp_voice_provider_calls
    WHERE company_id=p_company_id AND created_at>=day_start;
  IF n+p_reserved_micro_usd>policy.daily_company_micro_usd THEN
    RAISE EXCEPTION 'assistant_safety_limit' USING ERRCODE='QCP08';
  END IF;
  SELECT COALESCE(sum(charged_micro_usd),0) INTO n FROM public.qcp_voice_provider_calls
    WHERE company_id=p_company_id AND stripe_account_id=p_account_id AND stripe_mode=p_mode
      AND subscription_id=c->>'subscriptionId' AND period_start=(c->>'periodStart')::timestamptz;
  IF n+p_reserved_micro_usd>policy.period_company_micro_usd THEN
    RAISE EXCEPTION 'assistant_safety_limit' USING ERRCODE='QCP08';
  END IF;
  INSERT INTO public.qcp_voice_provider_calls(company_id,user_id,stripe_account_id,stripe_mode,
    subscription_id,period_start,request_key,payload_hash,audio_bytes,reserved_micro_usd,charged_micro_usd,state)
  VALUES(p_company_id,p_user_id,p_account_id,p_mode,c->>'subscriptionId',(c->>'periodStart')::timestamptz,
    p_request_key,p_payload_hash,p_audio_bytes,p_reserved_micro_usd,p_reserved_micro_usd,'reserved')
  RETURNING id INTO id_n;
  RETURN jsonb_build_object('id',id_n,'reservedMicroUsd',p_reserved_micro_usd);
END $$;
REVOKE ALL ON FUNCTION public.qcp_begin_voice_call(uuid,uuid,text,text,text,text,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_begin_voice_call(uuid,uuid,text,text,text,text,bigint,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.qcp_finish_voice_call(
  p_company_id uuid,
  p_call_id uuid,
  p_actual_micro_usd bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.qcp_voice_provider_calls%ROWTYPE; breach boolean;
BEGIN
  PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
  SELECT * INTO r FROM public.qcp_voice_provider_calls
    WHERE id=p_call_id AND company_id=p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'voice_call_missing' USING ERRCODE='QCP03'; END IF;
  IF r.state IN ('settled','uncertain') THEN
    RETURN jsonb_build_object('accounted',true,'overrun',r.overrun,'uncertain',r.state='uncertain');
  END IF;
  IF p_actual_micro_usd IS NOT NULL AND p_actual_micro_usd<0 THEN
    RAISE EXCEPTION 'invalid_provider_usage' USING ERRCODE='22023';
  END IF;
  breach:=p_actual_micro_usd IS NOT NULL AND p_actual_micro_usd>r.reserved_micro_usd;
  UPDATE public.qcp_voice_provider_calls SET
    charged_micro_usd=COALESCE(p_actual_micro_usd,reserved_micro_usd),
    state=CASE WHEN p_actual_micro_usd IS NULL THEN 'uncertain' ELSE 'settled' END,
    overrun=breach,completed_at=clock_timestamp()
    WHERE id=r.id;
  RETURN jsonb_build_object('accounted',true,'overrun',breach,'uncertain',p_actual_micro_usd IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.qcp_finish_voice_call(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_finish_voice_call(uuid,uuid,bigint) TO service_role;

-- Preserve the P2/P3 mid-period change semantics, but permit a custom account
-- with an OPEN failed-renewal record to consume only the prior paid grant for
-- seven days after the first failed attempt. This does NOT change periodStart,
-- periodEnd, invoice_id or limits and therefore cannot mint a new allowance.
CREATE OR REPLACE FUNCTION public.qcp_usage_context(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c public.companies%ROWTYPE; b public.company_custom_billing%ROWTYPE;
  g public.custom_billing_period_grants%ROWTYPE; l jsonb; n timestamptz := clock_timestamp(); k text;
  v_failed_grace boolean := false;
BEGIN
  SELECT * INTO c FROM public.companies WHERE id=p_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_company' USING ERRCODE='P0003'; END IF;
  IF c.billing_model = 'legacy' THEN RETURN NULL; END IF;
  IF c.billing_model IS DISTINCT FROM 'custom_setup' THEN RAISE EXCEPTION 'billing_model_unverified' USING ERRCODE='QCP01'; END IF;
  IF COALESCE(c.admin_paused,true) OR COALESCE(c.subscription_status,'') NOT IN ('active','trialing','past_due','disputed') THEN
    RAISE EXCEPTION 'custom_usage_inactive' USING ERRCODE='QCP01';
  END IF;
  SELECT * INTO b FROM public.company_custom_billing WHERE company_id=c.id;
  IF NOT FOUND OR b.stripe_mode IS DISTINCT FROM c.stripe_mode
     OR b.stripe_subscription_id IS DISTINCT FROM c.stripe_subscription_id
     OR b.stripe_customer_id IS DISTINCT FROM c.stripe_customer_id
     OR COALESCE(b.provider_status,'') NOT IN ('active','trialing','past_due','unpaid','disputed')
     OR COALESCE(b.stripe_account_id,'') !~ '^acct_[A-Za-z0-9]+$'
     OR COALESCE(b.stripe_subscription_id,'') !~ '^sub_[A-Za-z0-9]+$'
     OR b.period_start IS NULL OR b.period_end IS NULL OR b.period_start > n THEN
    RAISE EXCEPTION 'custom_paid_period_unavailable' USING ERRCODE='QCP01';
  END IF;
  IF b.period_end <= n THEN
    SELECT EXISTS(
      SELECT 1 FROM public.qcp_payment_attention a
      WHERE a.company_id=c.id AND a.stripe_account_id=b.stripe_account_id
        AND a.stripe_mode=b.stripe_mode AND a.subscription_id=b.stripe_subscription_id
        AND a.status='open' AND n < a.first_failed_at + interval '7 days'
    ) INTO v_failed_grace;
    IF NOT v_failed_grace THEN
      RAISE EXCEPTION 'custom_paid_period_unavailable' USING ERRCODE='QCP01';
    END IF;
  END IF;
  SELECT * INTO g FROM public.custom_billing_period_grants
   WHERE company_id=c.id AND stripe_mode=b.stripe_mode
     AND subscription_id=b.stripe_subscription_id AND period_start=b.period_start;
  IF NOT FOUND OR g.period_end IS DISTINCT FROM b.period_end
    OR g.invoice_id IS DISTINCT FROM b.last_paid_invoice_id THEN
    RAISE EXCEPTION 'custom_paid_grant_mismatch' USING ERRCODE='QCP01';
  END IF;
  IF g.granted_limits IS DISTINCT FROM b.purchased_entitlements THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.custom_billing_event_receipts r
      WHERE r.company_id=c.id AND r.stripe_account_id=b.stripe_account_id
        AND r.stripe_mode=b.stripe_mode AND r.result='ok:custom_change'
        AND r.applied_at >= g.period_start
    ) THEN
      RAISE EXCEPTION 'custom_paid_grant_mismatch' USING ERRCODE='QCP01';
    END IF;
    l := b.purchased_entitlements;
  ELSE
    l := g.granted_limits;
  END IF;
  IF jsonb_typeof(l) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'custom_limits_invalid' USING ERRCODE='QCP01'; END IF;
  FOREACH k IN ARRAY ARRAY['quotes','storageBytes','scanTokens','assistantTasks'] LOOP
    IF jsonb_typeof(l->k) IS DISTINCT FROM 'number' OR (l->>k) !~ '^[0-9]+$'
       OR (l->>k)::numeric > 9007199254740991 THEN
      RAISE EXCEPTION 'custom_limits_invalid:%',k USING ERRCODE='QCP01';
    END IF;
  END LOOP;
  IF jsonb_typeof(l->'digitalTakeoff') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(l->'offcuts') IS DISTINCT FROM 'boolean'
     OR COALESCE(l->>'capacity','') NOT IN ('low','medium','high')
     OR (NOT (l->>'digitalTakeoff')::boolean AND ((l->>'scanTokens')::bigint > 0 OR (l->>'offcuts')::boolean)) THEN
    RAISE EXCEPTION 'custom_limits_invalid' USING ERRCODE='QCP01';
  END IF;
  IF COALESCE(c.storage_topup_bytes,0)<0 THEN RAISE EXCEPTION 'storage_topup_invalid' USING ERRCODE='QCP01'; END IF;
  RETURN jsonb_build_object('accountId',b.stripe_account_id,'mode',b.stripe_mode,
    'subscriptionId',b.stripe_subscription_id,'periodStart',g.period_start,
    'periodEnd',g.period_end,'limits',l,'storageTopupBytes',COALESCE(c.storage_topup_bytes,0),
    'paymentGrace',v_failed_grace);
END $$;
REVOKE ALL ON FUNCTION public.qcp_usage_context(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_usage_context(uuid) TO service_role;

-- Keep the application read model in lock-step with qcp_usage_context. The
-- public function OID is preserved. paymentGrace is true only when the DB has
-- positively admitted the previous paid grant through the bounded recovery
-- window; absence/older deployments are treated as false by the app parser.
CREATE OR REPLACE FUNCTION public.qcp_usage_snapshot(p_company_id uuid,p_account_id text,p_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE co public.companies%ROWTYPE; b public.company_custom_billing%ROWTYPE;
 c jsonb; v_available boolean:=true; reason text:='available'; v_payment_grace boolean:=false;
BEGIN
 SELECT * INTO co FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown_company' USING ERRCODE='P0003'; END IF;
 IF co.billing_model<>'custom_setup' THEN RETURN jsonb_build_object('kind','legacy'); END IF;
 SELECT * INTO b FROM public.company_custom_billing WHERE company_id=p_company_id;
 IF NOT FOUND OR b.stripe_account_id IS DISTINCT FROM p_account_id
  OR b.stripe_mode IS DISTINCT FROM p_mode OR b.stripe_mode IS DISTINCT FROM co.stripe_mode
  OR b.stripe_subscription_id IS DISTINCT FROM co.stripe_subscription_id
  OR b.stripe_customer_id IS DISTINCT FROM co.stripe_customer_id THEN
   RAISE EXCEPTION 'custom_snapshot_identity_unverified' USING ERRCODE='QCP01';
 END IF;
 BEGIN
   c:=public.qcp_usage_context(p_company_id);
   v_payment_grace:=COALESCE((c->>'paymentGrace')::boolean,false);
   IF v_payment_grace THEN reason:='payment_grace'; END IF;
 EXCEPTION WHEN SQLSTATE 'QCP01' THEN
   v_available:=false; reason:=SQLERRM; v_payment_grace:=false;
   c:=jsonb_build_object('accountId',b.stripe_account_id,'mode',b.stripe_mode,
     'subscriptionId',b.stripe_subscription_id,'periodStart',b.period_start,'periodEnd',b.period_end,
     'limits',b.purchased_entitlements);
 END;
 RETURN jsonb_build_object('kind','custom','available',v_available,'reason',reason,
   'accountId',p_account_id,'mode',p_mode,'subscriptionId',b.stripe_subscription_id,
   'periodStart',b.period_start,'periodEnd',b.period_end,'limits',b.purchased_entitlements,
   'paymentGrace',v_payment_grace,
   'quotesUsed',public.qcp_usage_total(p_company_id,c,'quote'),
   'scanTokensUsed',public.qcp_usage_total(p_company_id,c,'scan'),
   'assistantTasksUsed',public.qcp_usage_total(p_company_id,c,'assistant'),
   'storageUsedBytes',co.storage_used_bytes+public.qcp_storage_pending_bytes(p_company_id),
   'storagePendingBytes',public.qcp_storage_pending_bytes(p_company_id));
END $$;
REVOKE ALL ON FUNCTION public.qcp_usage_snapshot(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_usage_snapshot(uuid,text,text) TO service_role;

-- The effective-plan helper is still used by legacy slot/feature reads in the
-- app. Keep the existing custom snapshot expiry guard, but recognize the same
-- bounded payment-attention window so those reads do not contradict the
-- authoritative qcp_usage_context decision. Legacy branches are unchanged.
CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN c.admin_override_plan_code
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    WHEN c.billing_model = 'custom_setup' THEN
      CASE WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
        AND EXISTS (
          SELECT 1 FROM public.company_custom_billing cb
          WHERE cb.company_id = c.id
            AND cb.stripe_mode = c.stripe_mode
            AND cb.stripe_subscription_id = c.stripe_subscription_id
            AND cb.stripe_customer_id = c.stripe_customer_id
            AND cb.provider_status IN ('active','trialing','past_due','unpaid','disputed')
            AND cb.period_start <= now()
            AND (
              cb.period_end > now()
              OR EXISTS (
                SELECT 1 FROM public.qcp_payment_attention a
                WHERE a.company_id=c.id
                  AND a.stripe_account_id=cb.stripe_account_id
                  AND a.stripe_mode=cb.stripe_mode
                  AND a.subscription_id=cb.stripe_subscription_id
                  AND a.status='open'
                  AND now() < a.first_failed_at + interval '7 days'
              )
            )
        ) THEN 'pro_plus' ELSE 'free' END
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN 'free'
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN c.plan_code
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN 'free'
    ELSE 'free'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;

COMMIT;
