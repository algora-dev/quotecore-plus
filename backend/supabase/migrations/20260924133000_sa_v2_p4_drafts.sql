-- AGENT-TODO P4: validate existing creation policy and all partial-save windows; establish trusted uncertain-parent reconciliation before enabling.
-- DRAFT P4. Quote parent creation stays in the EXISTING server action and
-- billing-controlled atomic RPC. This migration never inserts a quotes row.
BEGIN;
CREATE UNIQUE INDEX sa_v2_created_quote_once ON public.assistant_v2_actions(result_quote_id) WHERE result_quote_id IS NOT NULL;
CREATE FUNCTION public.sa_v2_creation_context_private(p_company_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('currency',c.default_currency,'measurement_system',c.default_measurement_system,
   'bootstrap_collection_id',(SELECT b.id FROM public.component_collections b WHERE b.company_id=c.id AND b.is_bootstrap LIMIT 1),
   'collections',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'currency',x.currency,'is_bootstrap',x.is_bootstrap) ORDER BY x.id) FROM public.component_collections x WHERE x.company_id=c.id),'[]'::jsonb))
 FROM public.companies c WHERE c.id=p_company_id;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_context_private(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_context_private(uuid) TO service_role;
CREATE FUNCTION public.sa_v2_creation_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime();
BEGIN
 IF NOT (v->'phases'->>'p4')::boolean OR v->'permissions'->>'draft_quotes'<>'edit' OR v->'permissions'->>'components'='hidden' THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
 RETURN public.sa_v2_creation_context_private((v->>'company_id')::uuid);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_context() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_context() TO authenticated;
CREATE OR REPLACE FUNCTION public.sa_v2_action_view(a public.assistant_v2_actions) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('id',a.id,'action_kind',a.kind,'status',a.status,'title',a.title,'changes',a.changes,'note',a.note,
   'proof_digest',a.digest,'version',a.version,'sections',a.sections,'error',a.error,'created_at',a.created_at,
   'target',CASE WHEN a.result_quote_id IS NOT NULL THEN jsonb_build_object('kind','draft_quote','id',a.result_quote_id)
     WHEN a.snapshot->'quote'->>'id' IS NOT NULL THEN jsonb_build_object('kind',CASE WHEN a.snapshot->'quote'->>'status'='draft' THEN 'draft_quote' ELSE 'quote' END,'id',a.snapshot->'quote'->>'id') ELSE NULL END);
$$;

CREATE FUNCTION public.sa_v2_creation_claim(p_action_id uuid,p_user_id uuid,p_digest text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_actor_context(p_user_id); a public.assistant_v2_actions%ROWTYPE; lib jsonb;
BEGIN
 IF NOT (v->>'p4')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND OR a.kind<>'draft_create' THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF a.digest IS DISTINCT FROM p_digest OR a.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'proof_changed' USING ERRCODE='40001'; END IF;
 IF a.status<>'proposed' THEN RETURN jsonb_build_object('claimed',false,'action',public.sa_v2_action_view(a)); END IF;
 PERFORM 1 FROM public.users WHERE id=p_user_id FOR SHARE;
 PERFORM 1 FROM public.assistant_section_permissions WHERE company_id=a.company_id FOR SHARE;
 PERFORM 1 FROM public.assistant_v2_rollout WHERE company_id=a.company_id FOR SHARE;
 v:=public.sa_v2_actor_context(p_user_id);
 IF (v->>'company_id')::uuid IS DISTINCT FROM a.company_id OR (v->>'revision')::integer IS DISTINCT FROM a.permission_revision OR NOT (v->>'p4')::boolean
   OR EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')<>'edit') THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.smart_assistant_runs WHERE id=a.run_id AND status='completed') THEN RAISE EXCEPTION 'run_not_completed' USING ERRCODE='42501'; END IF;
 IF public.sa_v2_creation_context_private(a.company_id) IS DISTINCT FROM a.snapshot->'context' THEN RAISE EXCEPTION 'defaults_changed' USING ERRCODE='40001'; END IF;
 FOR lib IN SELECT x FROM jsonb_array_elements(a.snapshot->'libraries') x LOOP
   IF public.sa_v2_snapshot_private(a.company_id,'library',(lib->>'id')::uuid)->'library' IS DISTINCT FROM lib THEN RAISE EXCEPTION 'library_changed' USING ERRCODE='40001'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.assistant_v2_actions previous WHERE previous.company_id=a.company_id AND previous.user_id=a.user_id AND previous.kind='draft_create' AND previous.id<>a.id AND previous.status IN ('applying','needs_review')) THEN RAISE EXCEPTION 'prior_creation_needs_review' USING ERRCODE='P0004'; END IF;
 UPDATE public.assistant_v2_actions SET status='applying',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 UPDATE public.sa_action_log SET status='confirmed',confirmation_method='button',confirmed_by=p_user_id,confirmed_at=clock_timestamp() WHERE id=a.log_id AND status='proposed';
 -- Only this successful claimer may call the existing creation server action.
 -- Returning applying/needs_review never grants a second creation attempt.
 RETURN jsonb_build_object('claimed',true,'action',public.sa_v2_action_view(a),'payload',a.payload,'snapshot',a.snapshot);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_claim(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_claim(uuid,uuid,text,integer) TO service_role;

CREATE FUNCTION public.sa_v2_creation_checkpoint(p_action_id uuid,p_user_id uuid,p_quote_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.assistant_v2_actions%ROWTYPE; q public.quotes%ROWTYPE;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND kind='draft_create' FOR UPDATE;
 IF NOT FOUND OR a.status<>'applying' THEN RAISE EXCEPTION 'not_claimed' USING ERRCODE='40001'; END IF;
 IF a.result_quote_id IS NOT NULL AND a.result_quote_id<>p_quote_id THEN RAISE EXCEPTION 'wrong_parent' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.quotes WHERE id=p_quote_id AND company_id=a.company_id FOR UPDATE;
 IF NOT FOUND OR q.created_by_user_id IS DISTINCT FROM p_user_id OR q.status::text<>'draft' OR q.entry_mode<>'manual'
   OR q.customer_name IS DISTINCT FROM a.payload->'params'->>'customerName' OR q.job_name IS DISTINCT FROM a.payload->'params'->>'jobName'
   OR q.measurement_system::text IS DISTINCT FROM a.payload->'params'->>'measurementSystem' THEN RAISE EXCEPTION 'wrong_parent' USING ERRCODE='42501'; END IF;
 UPDATE public.assistant_v2_actions SET result_quote_id=p_quote_id,updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 UPDATE public.sa_action_log SET entity_type='quote',entity_id=p_quote_id::text WHERE id=a.log_id;
 RETURN public.sa_v2_action_view(a);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_checkpoint(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_checkpoint(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.sa_v2_creation_finish(p_action_id uuid,p_user_id uuid,p_children jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_actor_context(p_user_id); a public.assistant_v2_actions%ROWTYPE; q public.quotes%ROWTYPE; x jsonb; lib jsonb; matched integer;
BEGIN
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND OR a.kind<>'draft_create' THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF a.status='committed' THEN RETURN public.sa_v2_action_view(a); END IF;
 IF a.status<>'applying' OR a.result_quote_id IS NULL OR p_children IS DISTINCT FROM a.payload->'children' THEN RAISE EXCEPTION 'invalid_finish' USING ERRCODE='40001'; END IF;
 PERFORM 1 FROM public.users WHERE id=p_user_id FOR SHARE;
 PERFORM 1 FROM public.assistant_section_permissions WHERE company_id=a.company_id FOR SHARE;
 PERFORM 1 FROM public.assistant_v2_rollout WHERE company_id=a.company_id FOR SHARE;
 v:=public.sa_v2_actor_context(p_user_id);
 IF (v->>'company_id')::uuid IS DISTINCT FROM a.company_id OR (v->>'revision')::integer IS DISTINCT FROM a.permission_revision OR NOT (v->>'p4')::boolean
   OR EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')<>'edit') THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.quotes WHERE id=a.result_quote_id AND company_id=a.company_id FOR UPDATE;
 IF NOT FOUND OR q.created_by_user_id IS DISTINCT FROM p_user_id OR q.status::text<>'draft' OR q.acceptance_token IS NOT NULL OR q.entry_mode<>'manual'
   OR q.customer_name IS DISTINCT FROM a.payload->'params'->>'customerName' OR q.job_name IS DISTINCT FROM a.payload->'params'->>'jobName'
   OR q.measurement_system::text IS DISTINCT FROM a.payload->'params'->>'measurementSystem' OR q.currency IS DISTINCT FROM a.payload->>'currency'
   OR q.trade::text IS DISTINCT FROM a.payload->'params'->>'trade' OR q.component_collection_id IS DISTINCT FROM (a.payload->'params'->>'componentCollectionId')::uuid
   OR (q.global_pitch_degrees IS NOT NULL AND q.global_pitch_degrees IS DISTINCT FROM (a.payload->>'pitch')::numeric)
   OR EXISTS(SELECT 1 FROM public.quote_components WHERE quote_id=q.id) OR EXISTS(SELECT 1 FROM public.quote_roof_areas WHERE quote_id=q.id)
   THEN RAISE EXCEPTION 'parent_changed' USING ERRCODE='40001'; END IF;
 FOR lib IN SELECT z FROM jsonb_array_elements(a.snapshot->'libraries') z LOOP
   PERFORM 1 FROM public.component_library WHERE id=(lib->>'id')::uuid AND company_id=a.company_id FOR SHARE;
   IF public.sa_v2_snapshot_private(a.company_id,'library',(lib->>'id')::uuid)->'library' IS DISTINCT FROM lib THEN RAISE EXCEPTION 'library_changed' USING ERRCODE='40001'; END IF;
 END LOOP;
 -- Existing central trade helper is called by the server immediately before
 -- this function. The same quote/library values are rechecked under locks here.
 FOR x IN SELECT z FROM jsonb_array_elements(p_children->'areas') z LOOP
   INSERT INTO public.quote_roof_areas(id,quote_id,label,input_mode,final_value_sqm,calc_plan_sqm,calc_pitch_degrees,computed_sqm,sort_order,is_locked)
   VALUES((x->>'id')::uuid,q.id,x->>'label',(x->>'input_mode')::public.input_mode,(x->>'final_value_sqm')::numeric,(x->>'calc_plan_sqm')::numeric,(x->>'calc_pitch_degrees')::numeric,(x->>'computed_sqm')::numeric,(x->>'sort_order')::integer,false);
 END LOOP;
 FOR x IN SELECT z FROM jsonb_array_elements(p_children->'components') z LOOP
   INSERT INTO public.quote_components(id,quote_id,quote_roof_area_id,component_library_id,name,component_type,measurement_type,input_mode,
     material_rate,labour_rate,waste_type,waste_percent,waste_fixed,pitch_type,calc_pitch_degrees,final_quantity,material_cost,labour_cost,priced_quantity,pack_size_snapshot,calc_audit,sort_order)
   VALUES((x->>'id')::uuid,q.id,(x->>'area_id')::uuid,(x->>'library_id')::uuid,x->>'name',(x->>'component_type')::public.component_type,(x->>'measurement_type')::public.measurement_type,(x->>'input_mode')::public.input_mode,
     (x->>'material_rate')::numeric,(x->>'labour_rate')::numeric,(x->>'waste_type')::public.waste_type,(x->>'waste_percent')::numeric,(x->>'waste_fixed')::numeric,
     (x->>'pitch_type')::public.pitch_type,(x->>'calc_pitch_degrees')::numeric,(x->>'final_quantity')::numeric,(x->>'material_cost')::numeric,(x->>'labour_cost')::numeric,(x->>'priced_quantity')::numeric,(x->>'pack_size_snapshot')::numeric,x->'calc_audit',(x->>'sort_order')::integer);
   INSERT INTO public.quote_component_entries(id,quote_component_id,raw_value,value_after_waste,pitch_degrees,sort_order)
   VALUES((x->'entry'->>'id')::uuid,(x->>'id')::uuid,(x->'entry'->>'raw_value')::numeric,(x->'entry'->>'value_after_waste')::numeric,(x->'entry'->>'pitch_degrees')::numeric,0);
 END LOOP;
 UPDATE public.quotes SET global_pitch_degrees=(a.payload->>'pitch')::numeric,updated_at=clock_timestamp() WHERE id=q.id AND company_id=a.company_id;
 UPDATE public.sa_action_log SET status='committed',payload_after=payload_after||jsonb_build_object('created_quote_id',q.id) WHERE id=a.log_id AND status='confirmed';
 GET DIAGNOSTICS matched=ROW_COUNT; IF matched<>1 THEN RAISE EXCEPTION 'proof_not_committed' USING ERRCODE='40001'; END IF;
 UPDATE public.assistant_v2_actions SET status='committed',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 RETURN public.sa_v2_action_view(a);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_finish(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_finish(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.sa_v2_creation_uncertain(p_action_id uuid,p_user_id uuid,p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.assistant_v2_actions%ROWTYPE; known_refusal boolean;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND kind='draft_create' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF a.status<>'applying' THEN RETURN public.sa_v2_action_view(a); END IF;
 known_refusal:=p_code IN ('quote_limit_reached','subscription_inactive','feature_gated','storage_quota_exceeded','pre_creation_refused') AND a.result_quote_id IS NULL;
 UPDATE public.assistant_v2_actions SET status=CASE WHEN known_refusal THEN 'failed' ELSE 'needs_review' END,
   error=CASE WHEN known_refusal THEN 'The existing quote-creation policy refused this request ('||p_code||'). No draft was created.'
     WHEN a.result_quote_id IS NOT NULL THEN 'A draft exists, but the complete save could not be verified. Open that draft and ask your administrator to reconcile it. Do not create it again.'
     ELSE 'The quote-creation result is uncertain. Ask your administrator to reconcile this action before trying again. No automatic retry is allowed.' END,
   updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 UPDATE public.sa_action_log SET payload_after=payload_after||jsonb_build_object('execution_state',a.status,'result_code',left(COALESCE(p_code,'unknown'),80)) WHERE id=a.log_id;
 RETURN public.sa_v2_action_view(a);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_uncertain(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_uncertain(uuid,uuid,text) TO service_role;
COMMIT;
