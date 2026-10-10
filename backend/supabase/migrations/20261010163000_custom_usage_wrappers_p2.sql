-- QuoteCore+ P2 wrappers retain installed legacy bodies AND public function OIDs.
-- Preserve OIDs so existing RLS policies and dependent functions use the new guard.
-- Do not rerun manually. Presence of qcp_p2_legacy_* means this was applied.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $copy_legacy$ DECLARE definition text; replacement text; BEGIN
 IF to_regprocedure('public.qcp_p2_legacy_create_quote_atomic(uuid,uuid,jsonb)') IS NOT NULL THEN
  RAISE EXCEPTION 'P2 wrapper already exists: qcp_p2_legacy_create_quote_atomic';
 END IF;
 definition:=pg_get_functiondef('public.create_quote_atomic(uuid,uuid,jsonb)'::regprocedure);
 replacement:=replace(definition,'CREATE OR REPLACE FUNCTION public.create_quote_atomic(',
   'CREATE OR REPLACE FUNCTION public.qcp_p2_legacy_create_quote_atomic(');
 IF replacement=definition THEN RAISE EXCEPTION 'Unrecognised function definition header: create_quote_atomic'; END IF;
 EXECUTE replacement;
END $copy_legacy$;
REVOKE ALL ON FUNCTION public.qcp_p2_legacy_create_quote_atomic(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.create_quote_atomic(p_company_id uuid,p_user_id uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_quote_id uuid; c jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND billing_model='custom_setup') THEN
  RETURN public.qcp_p2_legacy_create_quote_atomic(p_company_id,p_user_id,p_payload);
 END IF;
 PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
 c:=public.qcp_usage_context(p_company_id);
 -- The metadata projection is copied from the supplied live function. The
 -- AFTER INSERT trigger enforces the purchased limit in this transaction.
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

  RETURN v_quote_id;
END $$;
REVOKE ALL ON FUNCTION public.create_quote_atomic(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_quote_atomic(uuid,uuid,jsonb) TO service_role;

DO $copy_legacy$ DECLARE definition text; replacement text; BEGIN
 IF to_regprocedure('public.qcp_p2_legacy_sa_check_turn_quota(uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'P2 wrapper already exists: qcp_p2_legacy_sa_check_turn_quota';
 END IF;
 definition:=pg_get_functiondef('public.sa_check_turn_quota(uuid)'::regprocedure);
 replacement:=replace(definition,'CREATE OR REPLACE FUNCTION public.sa_check_turn_quota(',
   'CREATE OR REPLACE FUNCTION public.qcp_p2_legacy_sa_check_turn_quota(');
 IF replacement=definition THEN RAISE EXCEPTION 'Unrecognised function definition header: sa_check_turn_quota'; END IF;
 EXECUTE replacement;
END $copy_legacy$;
REVOKE ALL ON FUNCTION public.qcp_p2_legacy_sa_check_turn_quota(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.sa_check_turn_quota(p_company_id uuid)
RETURNS TABLE(allowed boolean,used integer,cap integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; u bigint; lim bigint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS(
  SELECT 1 FROM public.users WHERE id=auth.uid() AND company_id=p_company_id) THEN
   RAISE EXCEPTION 'not_company_member' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND billing_model='custom_setup') THEN
  RETURN QUERY SELECT * FROM public.qcp_p2_legacy_sa_check_turn_quota(p_company_id); RETURN;
 END IF;
 BEGIN c:=public.qcp_usage_context(p_company_id);
 EXCEPTION WHEN SQLSTATE 'QCP01' THEN RETURN QUERY SELECT false,0,0; RETURN; END;
 u:=public.qcp_usage_total(p_company_id,c,'assistant'); lim:=(c->'limits'->>'assistantTasks')::bigint;
 RETURN QUERY SELECT u<lim,u::integer,lim::integer;
END $$;
REVOKE ALL ON FUNCTION public.sa_check_turn_quota(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sa_check_turn_quota(uuid) TO authenticated,service_role;

DO $copy_legacy$ DECLARE definition text; replacement text; BEGIN
 IF to_regprocedure('public.qcp_p2_legacy_ai_points_status(uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'P2 wrapper already exists: qcp_p2_legacy_ai_points_status';
 END IF;
 definition:=pg_get_functiondef('public.get_ai_assist_points_status(uuid)'::regprocedure);
 replacement:=replace(definition,'CREATE OR REPLACE FUNCTION public.get_ai_assist_points_status(',
   'CREATE OR REPLACE FUNCTION public.qcp_p2_legacy_ai_points_status(');
 IF replacement=definition THEN RAISE EXCEPTION 'Unrecognised function definition header: get_ai_assist_points_status'; END IF;
 EXECUTE replacement;
END $copy_legacy$;
REVOKE ALL ON FUNCTION public.qcp_p2_legacy_ai_points_status(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_ai_assist_points_status(p_company_id uuid)
RETURNS TABLE(used integer,point_limit integer,remaining integer,is_blocked boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; u bigint; lim bigint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS(
  SELECT 1 FROM public.users WHERE id=auth.uid() AND company_id=p_company_id) THEN
   RAISE EXCEPTION 'not_company_member' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND billing_model='custom_setup') THEN
  RETURN QUERY SELECT * FROM public.qcp_p2_legacy_ai_points_status(p_company_id); RETURN;
 END IF;
 BEGIN c:=public.qcp_usage_context(p_company_id);
 EXCEPTION WHEN SQLSTATE 'QCP01' THEN RETURN QUERY SELECT 0,NULL::integer,0,true; RETURN; END;
 u:=public.qcp_usage_total(p_company_id,c,'scan'); lim:=(c->'limits'->>'scanTokens')::bigint;
 RETURN QUERY SELECT u::integer,NULLIF(lim,0)::integer,GREATEST(lim-u,0)::integer,lim=0;
END $$;
REVOKE ALL ON FUNCTION public.get_ai_assist_points_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_ai_assist_points_status(uuid) TO authenticated,service_role;

-- The generic legacy feature gate must not leak Digital Takeoff to a custom
-- customer through the pro_plus compatibility basis. Add explicit tool names.
DO $copy_legacy$ DECLARE definition text; replacement text; BEGIN
 IF to_regprocedure('public.qcp_p2_legacy_company_has_feature(uuid,text)') IS NOT NULL THEN
  RAISE EXCEPTION 'P2 wrapper already exists: qcp_p2_legacy_company_has_feature';
 END IF;
 definition:=pg_get_functiondef('public.company_has_feature(uuid,text)'::regprocedure);
 replacement:=replace(definition,'CREATE OR REPLACE FUNCTION public.company_has_feature(',
   'CREATE OR REPLACE FUNCTION public.qcp_p2_legacy_company_has_feature(');
 IF replacement=definition THEN RAISE EXCEPTION 'Unrecognised function definition header: company_has_feature'; END IF;
 EXECUTE replacement;
END $copy_legacy$;
REVOKE ALL ON FUNCTION public.qcp_p2_legacy_company_has_feature(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.company_has_feature(p_company_id uuid,p_feature text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND billing_model='custom_setup') THEN
   RETURN public.qcp_p2_legacy_company_has_feature(p_company_id,p_feature);
 END IF;
 BEGIN c:=public.qcp_usage_context(p_company_id);
 EXCEPTION WHEN SQLSTATE 'QCP01' THEN RETURN false; END;
 CASE p_feature
  WHEN 'digital_takeoff' THEN RETURN (c->'limits'->>'digitalTakeoff')::boolean;
  WHEN 'roof_scan' THEN RETURN (c->'limits'->>'scanTokens')::bigint>0;
  WHEN 'offcuts' THEN RETURN (c->'limits'->>'offcuts')::boolean;
  WHEN 'smart_assistant' THEN RETURN (c->'limits'->>'assistantTasks')::bigint>0;
  ELSE RETURN public.qcp_p2_legacy_company_has_feature(p_company_id,p_feature);
 END CASE;
END $$;
REVOKE ALL ON FUNCTION public.company_has_feature(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.company_has_feature(uuid,text) TO authenticated,service_role;

-- Read model for the app. Historical usage is still visible after expiry;
-- availability is a separate field. No fabricated period or reset date.
CREATE FUNCTION public.qcp_usage_snapshot(p_company_id uuid,p_account_id text,p_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE co public.companies%ROWTYPE; b public.company_custom_billing%ROWTYPE;
 c jsonb; v_available boolean:=true; reason text:='available';
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
 BEGIN c:=public.qcp_usage_context(p_company_id);
 EXCEPTION WHEN SQLSTATE 'QCP01' THEN
   v_available:=false; reason:=SQLERRM;
   c:=jsonb_build_object('accountId',b.stripe_account_id,'mode',b.stripe_mode,
     'subscriptionId',b.stripe_subscription_id,'periodStart',b.period_start,'periodEnd',b.period_end,
     'limits',b.purchased_entitlements);
 END;
 RETURN jsonb_build_object('kind','custom','available',v_available,'reason',reason,
   'accountId',p_account_id,'mode',p_mode,'subscriptionId',b.stripe_subscription_id,
   'periodStart',b.period_start,'periodEnd',b.period_end,'limits',b.purchased_entitlements,
   'quotesUsed',public.qcp_usage_total(p_company_id,c,'quote'),
   'scanTokensUsed',public.qcp_usage_total(p_company_id,c,'scan'),
   'assistantTasksUsed',public.qcp_usage_total(p_company_id,c,'assistant'),
   'storageUsedBytes',co.storage_used_bytes+public.qcp_storage_pending_bytes(p_company_id),
   'storagePendingBytes',public.qcp_storage_pending_bytes(p_company_id));
END $$;
REVOKE ALL ON FUNCTION public.qcp_usage_snapshot(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_usage_snapshot(uuid,text,text) TO service_role;
COMMIT;
