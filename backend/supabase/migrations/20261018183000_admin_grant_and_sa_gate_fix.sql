-- 2026-10-18 access fix (owner report, Roofline + SA gate):
-- 1) Admin-granted custom setups (stripe_customer_id='admin-granted', no Stripe
--    linkage) can never satisfy the row<->snapshot identity match in
--    company_effective_plan_code / qcp_usage_context, collapsing them to 'free'
--    and QCP01 -> every legacy feature gate off (invoices, message centre,
--    drawings/flashings, attachments, material orders).
-- 2) smart_assistant_enabled only read assistant_feature_flags (COALESCE false):
--    the subscription-based gate model (override > demo > custom paid period
--    with Assistant product, owner 2026-10-17) existed only in TS. Every sa_v2
--    RPC gates on this SQL fn, so SA was denied DB-side for ALL companies
--    without a flag row - including real paying customers with Assistant.
-- Minimal diffs from live definitions (dumped 2026-10-18, never rewritten from memory).

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
            AND (
              ( cb.stripe_mode = c.stripe_mode
                AND cb.stripe_subscription_id = c.stripe_subscription_id
                AND cb.stripe_customer_id = c.stripe_customer_id )
              -- Admin grants carry no Stripe linkage on the companies row:
              -- the snapshot alone decides (mirrors customAccess() admin
              -- branch in app/lib/billing/custom/contracts.ts).
              OR cb.stripe_customer_id = 'admin-granted'
            )
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

CREATE OR REPLACE FUNCTION public.qcp_usage_context(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
  -- Admin-granted setups have no Stripe linkage: the snapshot alone decides
  -- (mirrors customAccess() admin-grant branch; no grants-row or sub_ id).
  IF FOUND AND b.stripe_customer_id = 'admin-granted' THEN
    IF COALESCE(b.provider_status,'') NOT IN ('active','trialing','past_due','unpaid','disputed')
       OR b.period_start IS NULL OR b.period_end IS NULL OR b.period_start > n OR b.period_end <= n THEN
      RAISE EXCEPTION 'custom_paid_period_unavailable' USING ERRCODE='QCP01';
    END IF;
    l := b.purchased_entitlements;
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
      'subscriptionId',COALESCE(b.stripe_subscription_id,'admin-granted'),'periodStart',b.period_start,
      'periodEnd',b.period_end,'limits',l,'storageTopupBytes',COALESCE(c.storage_topup_bytes,0),
      'paymentGrace',false);
  END IF;
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
END $function$;

-- SQL mirror of smartAssistantFeatureAvailable (app/lib/smart-assistant/access.server.ts):
-- override flag wins both directions > demo company > custom paid period with
-- Assistant product. Legacy tiers get no Smart Assistant (owner 2026-10-17).
CREATE OR REPLACE FUNCTION public.smart_assistant_enabled(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.assistant_feature_flags f WHERE f.company_id = p_company_id)
      THEN (SELECT f.enabled FROM public.assistant_feature_flags f WHERE f.company_id = p_company_id)
    WHEN EXISTS (SELECT 1 FROM public.demo_sessions d WHERE d.company_id = p_company_id)
      THEN true
    WHEN EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id AND c.plan_code = 'demo')
      THEN true
    WHEN EXISTS (
      SELECT 1
      FROM public.companies c
      JOIN public.company_custom_billing cb ON cb.company_id = c.id
      WHERE c.id = p_company_id
        AND c.billing_model = 'custom_setup'
        AND c.subscription_status IN ('active','trialing','past_due','disputed')
        AND cb.provider_status IN ('active','trialing','past_due','unpaid','disputed')
        AND cb.period_start <= now() AND cb.period_end > now()
        AND (cb.purchased_entitlements->>'assistantTasks')::bigint > 0
    ) THEN true
    ELSE false
  END;
$function$;
