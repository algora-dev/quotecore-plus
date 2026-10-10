-- QuoteCore+ P2 synchronous scan protocol. Legacy scans remain on their old path.
BEGIN;
SET LOCAL lock_timeout='5s';

CREATE UNIQUE INDEX qcp_scan_one_tail_idx ON public.qcp_usage_ledger
 (company_id,(metadata->>'parentId'))
 WHERE resource='scan' AND metadata->>'stage'='scan3';

CREATE FUNCTION public.qcp_begin_scan(p_company_id uuid,p_account_id text,p_mode text,
 p_request_key text,p_payload_hash text,p_metadata jsonb,p_parent_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; e public.qcp_usage_ledger%ROWTYPE; p public.qcp_usage_ledger%ROWTYPE;
 v_id uuid; n bigint; cost_n integer; s text:=p_metadata->>'stage'; q text:=p_metadata->>'quality';
BEGIN
 PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown_company' USING ERRCODE='P0003'; END IF;
 IF p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 160
  OR COALESCE(p_payload_hash,'') !~ '^[a-f0-9]{64}$'
  OR COALESCE(s,'') NOT IN ('scan1','scan2','scan3') OR COALESCE(q,'') NOT IN ('low','medium','high') THEN
   RAISE EXCEPTION 'invalid_scan_request' USING ERRCODE='22023';
 END IF;
 SELECT * INTO e FROM public.qcp_usage_ledger
  WHERE company_id=p_company_id AND resource='scan' AND request_key=p_request_key;
 IF FOUND THEN
   IF e.payload_hash <> p_payload_hash OR e.stripe_account_id IS DISTINCT FROM p_account_id OR e.stripe_mode IS DISTINCT FROM p_mode THEN
    RAISE EXCEPTION 'scan_request_conflict' USING ERRCODE='QCP03';
   END IF;
   RETURN jsonb_build_object('decision','replay','id',e.id,'state',e.state,'response',e.response,'errorCode',e.error_code);
 END IF;
 c := public.qcp_usage_context(p_company_id);
 IF c IS NULL OR c->>'accountId' IS DISTINCT FROM p_account_id OR c->>'mode' IS DISTINCT FROM p_mode THEN
  RAISE EXCEPTION 'custom_scope_mismatch' USING ERRCODE='QCP01';
 END IF;
 IF NOT (c->'limits'->>'digitalTakeoff')::boolean OR (c->'limits'->>'scanTokens')::bigint=0 THEN
  RAISE EXCEPTION 'roof_scan_not_in_setup' USING ERRCODE='QCP01';
 END IF;
 -- Failed and refunded attempts still count against the operational rate guard.
 SELECT count(*) INTO n FROM public.qcp_usage_ledger WHERE company_id=p_company_id
  AND resource='scan' AND metadata->>'stage' IN ('scan1','scan2')
  AND created_at>clock_timestamp()-interval '1 hour';
 IF s<>'scan3' AND n>=60 THEN
   RAISE EXCEPTION 'scan_attempt_rate_limited' USING ERRCODE='QCP05';
 END IF;
 IF s='scan3' THEN
   SELECT * INTO p FROM public.qcp_usage_ledger WHERE id=p_parent_id AND company_id=p_company_id AND resource='scan';
   IF NOT FOUND OR p.metadata->>'stage' IS DISTINCT FROM 'scan2' OR p.state<>'consumed'
     OR p.stripe_account_id IS DISTINCT FROM p_account_id OR p.stripe_mode IS DISTINCT FROM p_mode
     OR p.subscription_id<>c->>'subscriptionId'
     OR p.metadata->>'tailHash' IS NULL
     OR p.metadata->>'tailHash' IS DISTINCT FROM p_metadata->>'tailHash'
     OR p.created_at<clock_timestamp()-interval '24 hours' THEN
     RAISE EXCEPTION 'paid_component_scan_required' USING ERRCODE='QCP03';
   END IF;
   SELECT * INTO e FROM public.qcp_usage_ledger WHERE company_id=p_company_id
      AND resource='scan' AND metadata->>'stage'='scan3' AND metadata->>'parentId'=p.id::text;
   IF FOUND THEN
     IF e.payload_hash <> p_payload_hash THEN RAISE EXCEPTION 'scan_tail_conflict' USING ERRCODE='QCP03'; END IF;
     RETURN jsonb_build_object('decision','replay','id',e.id,'state',e.state,'response',e.response,'errorCode',e.error_code);
   END IF;
   -- Zero-cost continuation stays pinned to the ORIGINAL component pass period.
   INSERT INTO public.qcp_usage_ledger(company_id,stripe_account_id,stripe_mode,subscription_id,
     period_start,period_end,resource,request_key,payload_hash,units,state,metadata)
   VALUES(p_company_id,p.stripe_account_id,p.stripe_mode,p.subscription_id,p.period_start,p.period_end,
     'scan',p_request_key,p_payload_hash,0,'reserved',p_metadata||jsonb_build_object('parentId',p.id))
   RETURNING id INTO v_id;
   cost_n := 0;
 ELSE
   IF p_parent_id IS NOT NULL THEN RAISE EXCEPTION 'unexpected_scan_parent' USING ERRCODE='22023'; END IF;
   cost_n := CASE q WHEN 'low' THEN 2 WHEN 'medium' THEN 6 ELSE 12 END;
   v_id := public.qcp_usage_insert(p_company_id,c,'scan',p_request_key,p_payload_hash,cost_n,'reserved',p_metadata);
 END IF;
 RETURN jsonb_build_object('decision','accepted','id',v_id,'cost',cost_n,
   'remaining',GREATEST((c->'limits'->>'scanTokens')::bigint-public.qcp_usage_total(p_company_id,c,'scan'),0));
END $$;
REVOKE ALL ON FUNCTION public.qcp_begin_scan(uuid,text,text,text,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_begin_scan(uuid,text,text,text,text,jsonb,uuid) TO service_role;

CREATE FUNCTION public.qcp_finish_scan(p_company_id uuid,p_event_id uuid,p_succeeded boolean,
 p_response jsonb,p_error_code text DEFAULT NULL,p_tail_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.qcp_usage_ledger%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=p_company_id FOR NO KEY UPDATE;
 SELECT * INTO e FROM public.qcp_usage_ledger WHERE id=p_event_id AND company_id=p_company_id AND resource='scan' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'scan_operation_missing' USING ERRCODE='QCP03'; END IF;
 IF e.state<>'reserved' THEN RETURN jsonb_build_object('state',e.state,'response',e.response); END IF;
 IF p_succeeded IS NULL OR p_response IS NULL OR octet_length(p_response::text)>2097152 THEN
   RAISE EXCEPTION 'invalid_scan_response' USING ERRCODE='22023';
 END IF;
 IF p_succeeded AND e.metadata->>'stage'='scan2' AND COALESCE(p_tail_hash,'') !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'scan_tail_proof_missing' USING ERRCODE='22023';
 END IF;
 UPDATE public.qcp_usage_ledger SET state=CASE WHEN p_succeeded THEN 'consumed' ELSE 'refunded' END,
   response=p_response,completed_at=clock_timestamp(),error_code=left(p_error_code,120),
   metadata=metadata||CASE WHEN p_tail_hash IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('tailHash',p_tail_hash) END
 WHERE id=e.id;
 IF NOT p_succeeded AND e.metadata->>'stage'='scan3' THEN
   UPDATE public.qcp_usage_ledger SET state='refunded',error_code='component_tail_failed'
    WHERE id=(e.metadata->>'parentId')::uuid AND company_id=p_company_id
     AND resource='scan' AND metadata->>'stage'='scan2' AND state='consumed';
 END IF;
 RETURN jsonb_build_object('state',CASE WHEN p_succeeded THEN 'consumed' ELSE 'refunded' END,'response',p_response);
END $$;
REVOKE ALL ON FUNCTION public.qcp_finish_scan(uuid,uuid,boolean,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qcp_finish_scan(uuid,uuid,boolean,jsonb,text,text) TO service_role;
COMMIT;
