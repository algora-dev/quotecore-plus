-- qcp_usage_context: honour a reconciled mid-period setup change (2026-10-11).
-- After kind='change' reconciliation the snapshot (company_custom_billing)
-- legitimately differs from the immutable period grant that originally paid
-- for the period. The guard used to fail closed (custom_paid_grant_mismatch),
-- pausing usage for every custom subscriber who changed setup mid-period.
-- Rule: when grant limits differ from the snapshot AND a kind='change'
-- receipt (result ok:custom_change) was applied for this company inside the
-- CURRENT grant period, quotas come from the current snapshot. The paid
-- window, invoice anchor, grant row and usage ledger stay untouched.
BEGIN;

CREATE OR REPLACE FUNCTION public.qcp_usage_context(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public, pg_temp AS $$
DECLARE c public.companies%ROWTYPE; b public.company_custom_billing%ROWTYPE;
  g public.custom_billing_period_grants%ROWTYPE; l jsonb; n timestamptz := clock_timestamp(); k text;
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
     OR b.period_start IS NULL OR b.period_end IS NULL OR b.period_start > n OR b.period_end <= n THEN
    RAISE EXCEPTION 'custom_paid_period_unavailable' USING ERRCODE='QCP01';
  END IF;
  SELECT * INTO g FROM public.custom_billing_period_grants
   WHERE company_id=c.id AND stripe_mode=b.stripe_mode
     AND subscription_id=b.stripe_subscription_id AND period_start=b.period_start;
  IF NOT FOUND OR g.period_end IS DISTINCT FROM b.period_end
    OR g.invoice_id IS DISTINCT FROM b.last_paid_invoice_id THEN
    RAISE EXCEPTION 'custom_paid_grant_mismatch' USING ERRCODE='QCP01';
  END IF;
  IF g.granted_limits IS DISTINCT FROM b.purchased_entitlements THEN
    -- Reconciled mid-period setup change: the kind='change' receipt must exist
    -- for THIS company inside the CURRENT grant period. Anything else is still
    -- a fail-closed grant mismatch.
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
  IF jsonb_typeof(l) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'custom_limits_invalid' USING ERRCODE='QCP01';
  END IF;
  FOREACH k IN ARRAY ARRAY['quotes','storageBytes','scanTokens','assistantTasks'] LOOP
    IF jsonb_typeof(l->k) IS DISTINCT FROM 'number'
       OR (l->>k) !~ '^[0-9]+$' OR (l->>k)::numeric > 9007199254740991 THEN
      RAISE EXCEPTION 'custom_limits_invalid:%',k USING ERRCODE='QCP01';
    END IF;
  END LOOP;
  IF jsonb_typeof(l->'digitalTakeoff') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(l->'offcuts') IS DISTINCT FROM 'boolean'
     OR COALESCE(l->>'capacity','') NOT IN ('low','medium','high')
     OR (NOT (l->>'digitalTakeoff')::boolean AND
        ((l->>'scanTokens')::bigint > 0 OR (l->>'offcuts')::boolean)) THEN
    RAISE EXCEPTION 'custom_limits_invalid' USING ERRCODE='QCP01';
  END IF;
  IF COALESCE(c.storage_topup_bytes,0)<0 THEN
    RAISE EXCEPTION 'storage_topup_invalid' USING ERRCODE='QCP01';
  END IF;
  RETURN jsonb_build_object('accountId',b.stripe_account_id,'mode',b.stripe_mode,
    'subscriptionId',b.stripe_subscription_id,'periodStart',g.period_start,
    'periodEnd',g.period_end,'limits',l,'storageTopupBytes',COALESCE(c.storage_topup_bytes,0));
END $$;
REVOKE ALL ON FUNCTION public.qcp_usage_context(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_usage_context(uuid) TO service_role;
COMMIT;
