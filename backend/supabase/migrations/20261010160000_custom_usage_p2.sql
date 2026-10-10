-- QuoteCore+ P2: paid-period usage. Additive to the integrated P1 schema.
-- Run on a disposable database first. Does not alter legacy catalogue values.
-- Mutation callers lock the company, then validate the paid grant. Read gates do not lock.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$ BEGIN
  IF to_regclass('public.custom_billing_period_grants') IS NULL
     OR to_regclass('public.company_custom_billing') IS NULL THEN
    RAISE EXCEPTION 'P1 billing migrations are required';
  END IF;
  IF EXISTS(SELECT 1 FROM public.companies WHERE billing_model='custom_setup') THEN
    RAISE EXCEPTION 'Existing custom companies require an explicit usage cutover/backfill before P2. Do not start them at zero.';
  END IF;
END $$;

CREATE TABLE public.qcp_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  subscription_id text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK (period_end > period_start),
  resource text NOT NULL CHECK (resource IN ('quote','scan','assistant')),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 200),
  payload_hash text NOT NULL CHECK (length(payload_hash) BETWEEN 1 AND 128),
  units bigint NOT NULL CHECK (units >= 0),
  state text NOT NULL CHECK (state IN ('reserved','consumed','refunded')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  response jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  -- Stable across renewals: replay cannot become a fresh paid operation.
  UNIQUE (company_id, resource, request_key)
);
CREATE INDEX qcp_usage_period_idx ON public.qcp_usage_ledger
  (company_id, stripe_mode, subscription_id, period_start, resource);
ALTER TABLE public.qcp_usage_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qcp_usage_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qcp_usage_ledger TO service_role;
COMMENT ON TABLE public.qcp_usage_ledger IS
  'Purchased usage. No FK to quotes or assistant runs: deleting content must not restore quota. Raw image and conversation content must not be stored in metadata.';

-- Required context is the PAID period grant, not a pro_plus fallback. No external
-- service is contacted in a transaction. A status alone cannot mint a period.
CREATE FUNCTION public.qcp_usage_context(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
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
    OR g.invoice_id IS DISTINCT FROM b.last_paid_invoice_id
    OR g.granted_limits IS DISTINCT FROM b.purchased_entitlements THEN
    RAISE EXCEPTION 'custom_paid_grant_mismatch' USING ERRCODE='QCP01';
  END IF;
  l := g.granted_limits;
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
REVOKE ALL ON FUNCTION public.qcp_usage_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_usage_context(uuid) TO service_role;

CREATE FUNCTION public.qcp_usage_total(p_company_id uuid,p_context jsonb,p_resource text)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(sum(units),0)::bigint FROM public.qcp_usage_ledger
   WHERE company_id=p_company_id AND stripe_account_id=p_context->>'accountId'
    AND stripe_mode=p_context->>'mode' AND subscription_id=p_context->>'subscriptionId'
    AND period_start=(p_context->>'periodStart')::timestamptz
    AND resource=p_resource AND state <> 'refunded'
$$;
REVOKE ALL ON FUNCTION public.qcp_usage_total(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_usage_total(uuid,jsonb,text) TO service_role;

-- Internal insert helper. Caller must hold the company lock and supply the
-- context obtained IN THIS transaction. No user/client EXECUTE privilege.
CREATE FUNCTION public.qcp_usage_insert(p_company_id uuid,p_context jsonb,p_resource text,
  p_key text,p_hash text,p_units bigint,p_state text,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid; v_old public.qcp_usage_ledger%ROWTYPE; v_used bigint; v_limit bigint; k text;
BEGIN
  IF p_context IS NULL OR p_units IS NULL OR p_units<0 OR p_resource IS NULL OR p_resource NOT IN ('quote','scan','assistant') THEN
    RAISE EXCEPTION 'invalid_usage_request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_old FROM public.qcp_usage_ledger
    WHERE company_id=p_company_id AND resource=p_resource AND request_key=p_key;
  IF FOUND THEN
    IF v_old.payload_hash IS DISTINCT FROM p_hash OR v_old.units <> p_units THEN
      RAISE EXCEPTION 'usage_request_conflict' USING ERRCODE='QCP03';
    END IF;
    RETURN v_old.id;
  END IF;
  k := CASE p_resource WHEN 'quote' THEN 'quotes' WHEN 'scan' THEN 'scanTokens' ELSE 'assistantTasks' END;
  v_limit := (p_context->'limits'->>k)::bigint;
  v_used := public.qcp_usage_total(p_company_id,p_context,p_resource);
  IF v_used+p_units > v_limit THEN
    RAISE EXCEPTION 'custom_usage_limit_reached'
      USING ERRCODE='QCP02',DETAIL=jsonb_build_object('resource',p_resource,'used',v_used,
        'limit',v_limit,'requested',p_units,'periodStart',p_context->>'periodStart',
        'periodEnd',p_context->>'periodEnd')::text;
  END IF;
  INSERT INTO public.qcp_usage_ledger(company_id,stripe_account_id,stripe_mode,
    subscription_id,period_start,period_end,resource,request_key,payload_hash,units,state,metadata)
  VALUES(p_company_id,p_context->>'accountId',p_context->>'mode',p_context->>'subscriptionId',
    (p_context->>'periodStart')::timestamptz,(p_context->>'periodEnd')::timestamptz,
    p_resource,p_key,p_hash,p_units,p_state,p_metadata) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.qcp_usage_insert(uuid,jsonb,text,text,text,bigint,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- AFTER INSERT means failed inserts and ON CONFLICT retries do not charge.
-- The charge and new quote are part of the same transaction.
CREATE FUNCTION public.qcp_meter_quote_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; used_n bigint; limit_n bigint;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND billing_model='custom_setup') THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.companies WHERE id=NEW.company_id FOR NO KEY UPDATE;
 c := public.qcp_usage_context(NEW.company_id);
  IF c IS NULL THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.qcp_usage_ledger WHERE company_id=NEW.company_id
    AND resource='quote' AND request_key=NEW.id::text) THEN
    RAISE EXCEPTION 'deleted_quote_identity_cannot_be_reused' USING ERRCODE='QCP03';
  END IF;
  used_n := public.qcp_usage_total(NEW.company_id,c,'quote');
  limit_n := (c->'limits'->>'quotes')::bigint;
  IF used_n >= limit_n THEN
    RAISE EXCEPTION 'quote_limit_reached' USING ERRCODE='P0002',
      DETAIL=format('used=%s limit=%s period_start=%s plan=custom_setup',used_n,limit_n,c->>'periodStart');
  END IF;
  PERFORM public.qcp_usage_insert(NEW.company_id,c,'quote',NEW.id::text,NEW.id::text,1,'consumed');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qcp_meter_quote_insert() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER qcp_meter_quote_insert AFTER INSERT ON public.quotes
 FOR EACH ROW EXECUTE FUNCTION public.qcp_meter_quote_insert();

CREATE FUNCTION public.qcp_quote_identity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF (NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id)
 AND EXISTS(SELECT 1 FROM public.companies WHERE id IN (NEW.company_id,OLD.company_id) AND billing_model='custom_setup') THEN
  RAISE EXCEPTION 'custom_quote_identity_immutable' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qcp_quote_identity_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER qcp_quote_identity_guard BEFORE UPDATE ON public.quotes
 FOR EACH ROW EXECUTE FUNCTION public.qcp_quote_identity_guard();

-- Keep the existing admission/dedupe/authorization function. Charge at its
-- durable reservation INSERT so all callers share the same atomic barrier.
CREATE FUNCTION public.qcp_meter_assistant_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; r record; old_event public.qcp_usage_ledger%ROWTYPE; k text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND billing_model='custom_setup') THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.companies WHERE id=NEW.company_id FOR NO KEY UPDATE;
 c := public.qcp_usage_context(NEW.company_id);
 IF c IS NULL THEN RETURN NEW; END IF;
 SELECT conversation_id,client_request_id,payload_hash,company_id,user_id INTO r
  FROM public.smart_assistant_runs WHERE id=NEW.run_id;
 IF NOT FOUND OR r.company_id <> NEW.company_id OR r.user_id <> NEW.user_id THEN
   RAISE EXCEPTION 'assistant_reservation_identity_invalid' USING ERRCODE='42501';
 END IF;
 k := r.conversation_id::text||':'||r.client_request_id;
 SELECT * INTO old_event FROM public.qcp_usage_ledger
  WHERE company_id=NEW.company_id AND resource='assistant' AND request_key=k;
 IF FOUND AND old_event.metadata->>'runId' IS DISTINCT FROM NEW.run_id::text THEN
   RAISE EXCEPTION 'assistant_request_already_used' USING ERRCODE='QCP03';
 END IF;
 PERFORM public.qcp_usage_insert(NEW.company_id,c,'assistant',k,r.payload_hash,1,'consumed',
   jsonb_build_object('runId',NEW.run_id,'userId',NEW.user_id));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qcp_meter_assistant_reservation() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER qcp_meter_assistant_reservation AFTER INSERT ON public.assistant_turn_reservations
 FOR EACH ROW EXECUTE FUNCTION public.qcp_meter_assistant_reservation();

-- Never permit an older scan/calibration endpoint to spend the legacy counter
-- for a custom customer. Dedicated P2 scan reservations do not touch it.
CREATE FUNCTION public.qcp_legacy_scan_counter_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.billing_model='custom_setup'
    AND NEW.ai_assist_points_used IS DISTINCT FROM OLD.ai_assist_points_used THEN
   RAISE EXCEPTION 'custom_scan_protocol_required' USING ERRCODE='QCP04';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qcp_legacy_scan_counter_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER qcp_legacy_scan_counter_guard BEFORE UPDATE ON public.companies
 FOR EACH ROW EXECUTE FUNCTION public.qcp_legacy_scan_counter_guard();

-- A browser can currently insert its own queue jobs through existing RLS.
-- Route-only guards are insufficient: block old worker protocols in the DB too.
CREATE FUNCTION public.qcp_guard_unadapted_scan_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND billing_model='custom_setup') THEN
  RAISE EXCEPTION 'custom_scan_protocol_required' USING ERRCODE='QCP04';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.qcp_guard_unadapted_scan_run() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER qcp_guard_unadapted_scan_run BEFORE INSERT OR UPDATE ON public.ai_scan_jobs
 FOR EACH ROW EXECUTE FUNCTION public.qcp_guard_unadapted_scan_run();
CREATE TRIGGER qcp_guard_unadapted_calibration_run BEFORE INSERT OR UPDATE ON public.calibration_runs
 FOR EACH ROW EXECUTE FUNCTION public.qcp_guard_unadapted_scan_run();
COMMIT;
