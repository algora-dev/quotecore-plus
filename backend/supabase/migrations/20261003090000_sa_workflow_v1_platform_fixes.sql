-- Platform fixes found during live acceptance (2026-10-03):
-- 1) sa_v2_workflow_apply_children: PL/pgSQL loop variable 'e' collided with table/lateral
--    aliases 'e' (SQLSTATE 42702) - aliases renamed to je/ent; logic unchanged.
-- 2) Old P4 claim/cancel helpers raised deterministic conflicts as 40001, which PostgREST
--    retries indefinitely (recorded platform gotcha) - now 23505 with the same messages.
BEGIN;
CREATE OR REPLACE FUNCTION public.sa_v2_creation_claim_pre_controller_v1(p_action_id uuid, p_user_id uuid, p_digest text, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v jsonb:=public.sa_v2_actor_context(p_user_id); a public.assistant_v2_actions%ROWTYPE; lib jsonb;
BEGIN
 IF NOT (v->>'p4')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND OR a.kind<>'draft_create' THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF a.digest IS DISTINCT FROM p_digest OR a.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'proof_changed' USING ERRCODE='23505'; END IF;
 IF a.status<>'proposed' THEN RETURN jsonb_build_object('claimed',false,'action',public.sa_v2_action_view(a)); END IF;
 PERFORM 1 FROM public.users WHERE id=p_user_id FOR SHARE;
 PERFORM 1 FROM public.assistant_section_permissions WHERE company_id=a.company_id FOR SHARE;
 PERFORM 1 FROM public.assistant_v2_rollout WHERE company_id=a.company_id FOR SHARE;
 v:=public.sa_v2_actor_context(p_user_id);
 IF (v->>'company_id')::uuid IS DISTINCT FROM a.company_id OR (v->>'revision')::integer IS DISTINCT FROM a.permission_revision OR NOT (v->>'p4')::boolean
   OR EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')<>'edit') THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.smart_assistant_runs WHERE id=a.run_id AND status='completed') THEN RAISE EXCEPTION 'run_not_completed' USING ERRCODE='42501'; END IF;
 IF public.sa_v2_creation_context_private(a.company_id) IS DISTINCT FROM a.snapshot->'context' THEN RAISE EXCEPTION 'defaults_changed' USING ERRCODE='23505'; END IF;
 FOR lib IN SELECT x FROM jsonb_array_elements(a.snapshot->'libraries') x LOOP
   IF public.sa_v2_snapshot_private(a.company_id,'library',(lib->>'id')::uuid)->'library' IS DISTINCT FROM lib THEN RAISE EXCEPTION 'library_changed' USING ERRCODE='23505'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.assistant_v2_actions previous WHERE previous.company_id=a.company_id AND previous.user_id=a.user_id AND previous.kind='draft_create' AND previous.id<>a.id AND previous.status IN ('applying','needs_review')) THEN RAISE EXCEPTION 'prior_creation_needs_review' USING ERRCODE='P0004'; END IF;
 UPDATE public.assistant_v2_actions SET status='applying',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 UPDATE public.sa_action_log SET status='confirmed',confirmation_method='button',confirmed_by=p_user_id,confirmed_at=clock_timestamp() WHERE id=a.log_id AND status='proposed';
 -- Only this successful claimer may call the existing creation server action.
 -- Returning applying/needs_review never grants a second creation attempt.
 RETURN jsonb_build_object('claimed',true,'action',public.sa_v2_action_view(a),'payload',a.payload,'snapshot',a.snapshot);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sa_v2_action_cancel_pre_controller_v1(p_action_id uuid, p_digest text, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v jsonb:=public.sa_v2_runtime(); a public.assistant_v2_actions%ROWTYPE;
BEGIN
 IF NOT (v->'phases'->>'p3')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=auth.uid() AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')='hidden')
   OR NOT EXISTS(SELECT 1 FROM public.smart_assistant_runs r WHERE r.id=a.run_id AND r.status='completed') THEN
   RAISE EXCEPTION 'not_found' USING ERRCODE='P0002';
 END IF;
 IF a.digest IS DISTINCT FROM p_digest OR a.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'proof_changed' USING ERRCODE='23505'; END IF;
 IF a.status='proposed' THEN
   UPDATE public.assistant_v2_actions SET status='cancelled',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
   UPDATE public.sa_action_log SET status='expired' WHERE id=a.log_id AND status='proposed';
 END IF;
 RETURN public.sa_v2_action_view(a);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sa_v2_workflow_apply_children(p_quote_id uuid,p_company_id uuid,p_before jsonb,p_after jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE x jsonb; e jsonb; previous jsonb; before_entries jsonb; after_entries jsonb; expected uuid[]; actual uuid[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.quotes WHERE id=p_quote_id AND company_id=p_company_id)
   OR jsonb_typeof(p_before->'areas') IS DISTINCT FROM 'array' OR jsonb_typeof(p_after->'areas') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_before->'components') IS DISTINCT FROM 'array' OR jsonb_typeof(p_after->'components') IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_after->'areas')>12 OR jsonb_array_length(p_after->'components') NOT BETWEEN 1 AND 24
 THEN RAISE EXCEPTION 'invalid_structural_plan' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(je),'[]'::jsonb) INTO before_entries FROM jsonb_array_elements(p_before->'components') c CROSS JOIN LATERAL jsonb_array_elements(c->'entries') je;
 SELECT coalesce(jsonb_agg(je),'[]'::jsonb) INTO after_entries FROM jsonb_array_elements(p_after->'components') c CROSS JOIN LATERAL jsonb_array_elements(c->'entries') je;
 IF jsonb_array_length(after_entries) NOT BETWEEN 1 AND 600 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_after->'components') c
   WHERE jsonb_typeof(c->'entries') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'entries') NOT BETWEEN 1 AND 200)
 THEN RAISE EXCEPTION 'invalid_measurement_entries' USING ERRCODE='22023'; END IF;
 -- Refuse any untracked builder/trigger-created structures rather than deleting
 -- or rebasing them invisibly. Identity comparisons include every repeated entry.
 SELECT array_agg((value->>'id')::uuid ORDER BY value->>'id') INTO expected FROM jsonb_array_elements(p_before->'areas');
 SELECT array_agg(id ORDER BY id) INTO actual FROM public.quote_roof_areas WHERE quote_id=p_quote_id;
 IF coalesce(expected,'{}') IS DISTINCT FROM coalesce(actual,'{}') THEN RAISE EXCEPTION 'area_identity_changed' USING ERRCODE='23505'; END IF;
 SELECT array_agg((value->>'id')::uuid ORDER BY value->>'id') INTO expected FROM jsonb_array_elements(p_before->'components');
 SELECT array_agg(id ORDER BY id) INTO actual FROM public.quote_components WHERE quote_id=p_quote_id;
 IF coalesce(expected,'{}') IS DISTINCT FROM coalesce(actual,'{}') THEN RAISE EXCEPTION 'component_identity_changed' USING ERRCODE='23505'; END IF;
 SELECT array_agg((value->>'id')::uuid ORDER BY value->>'id') INTO expected FROM jsonb_array_elements(before_entries);
 SELECT array_agg(ent.id ORDER BY ent.id) INTO actual FROM public.quote_component_entries ent JOIN public.quote_components c ON c.id=ent.quote_component_id WHERE c.quote_id=p_quote_id;
 IF coalesce(expected,'{}') IS DISTINCT FROM coalesce(actual,'{}') THEN RAISE EXCEPTION 'entry_identity_changed' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT id FROM (
    SELECT value->>'id' id FROM jsonb_array_elements(p_after->'areas') UNION ALL
    SELECT value->>'id' FROM jsonb_array_elements(p_after->'components') UNION ALL
    SELECT value->>'id' FROM jsonb_array_elements(after_entries)) ids GROUP BY id HAVING count(*)<>1)
 THEN RAISE EXCEPTION 'duplicate_structural_identity' USING ERRCODE='22023'; END IF;

 FOR x IN SELECT value FROM jsonb_array_elements(p_after->'areas') LOOP
   SELECT value INTO previous FROM jsonb_array_elements(p_before->'areas') WHERE value->>'id'=x->>'id';
   IF previous IS NULL AND EXISTS(SELECT 1 FROM public.quote_roof_areas WHERE id=(x->>'id')::uuid)
   THEN RAISE EXCEPTION 'area_identity_collision' USING ERRCODE='42501'; END IF;
   IF previous IS DISTINCT FROM x THEN
     INSERT INTO public.quote_roof_areas(id,quote_id,label,input_mode,final_value_sqm,calc_plan_sqm,calc_pitch_degrees,computed_sqm,sort_order,is_locked)
      VALUES((x->>'id')::uuid,p_quote_id,x->>'label',(x->>'input_mode')::public.input_mode,(x->>'final_value_sqm')::numeric,(x->>'calc_plan_sqm')::numeric,(x->>'calc_pitch_degrees')::numeric,(x->>'computed_sqm')::numeric,(x->>'sort_order')::integer,false)
      ON CONFLICT(id) DO UPDATE SET label=EXCLUDED.label,input_mode=EXCLUDED.input_mode,final_value_sqm=EXCLUDED.final_value_sqm,calc_plan_sqm=EXCLUDED.calc_plan_sqm,calc_pitch_degrees=EXCLUDED.calc_pitch_degrees,computed_sqm=EXCLUDED.computed_sqm,sort_order=EXCLUDED.sort_order WHERE quote_roof_areas.quote_id=p_quote_id;
   END IF;
 END LOOP;
 -- Delete only explicitly removed entry identities, scoped through this quote.
 DELETE FROM public.quote_component_entries ent USING public.quote_components c
 WHERE e.quote_component_id=c.id AND c.quote_id=p_quote_id
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(before_entries) j WHERE (j->>'id')::uuid=ent.id)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(after_entries) j WHERE (j->>'id')::uuid=ent.id);

 FOR x IN SELECT value FROM jsonb_array_elements(p_after->'components') LOOP
   SELECT value INTO previous FROM jsonb_array_elements(p_before->'components') WHERE value->>'id'=x->>'id';
   IF previous IS NULL AND EXISTS(SELECT 1 FROM public.quote_components WHERE id=(x->>'id')::uuid)
   THEN RAISE EXCEPTION 'component_identity_collision' USING ERRCODE='42501'; END IF;
   IF x->>'area_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.quote_roof_areas WHERE id=(x->>'area_id')::uuid AND quote_id=p_quote_id)
   THEN RAISE EXCEPTION 'area_parent_mismatch' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.component_library c JOIN public.quotes q ON q.id=p_quote_id WHERE c.id=(x->>'library_id')::uuid AND c.company_id=p_company_id AND c.is_active)
   THEN RAISE EXCEPTION 'component_unavailable' USING ERRCODE='42501'; END IF;
   IF previous IS DISTINCT FROM x THEN
     INSERT INTO public.quote_components(id,quote_id,quote_roof_area_id,component_library_id,name,component_type,measurement_type,input_mode,material_rate,labour_rate,waste_type,waste_percent,waste_fixed,pitch_type,calc_pitch_degrees,final_quantity,material_cost,labour_cost,priced_quantity,pack_size_snapshot,calc_audit,sort_order)
      VALUES((x->>'id')::uuid,p_quote_id,(x->>'area_id')::uuid,(x->>'library_id')::uuid,x->>'name',(x->>'component_type')::public.component_type,(x->>'measurement_type')::public.measurement_type,(x->>'input_mode')::public.input_mode,(x->>'material_rate')::numeric,(x->>'labour_rate')::numeric,(x->>'waste_type')::public.waste_type,(x->>'waste_percent')::numeric,(x->>'waste_fixed')::numeric,(x->>'pitch_type')::public.pitch_type,(x->>'calc_pitch_degrees')::numeric,(x->>'final_quantity')::numeric,(x->>'material_cost')::numeric,(x->>'labour_cost')::numeric,(x->>'priced_quantity')::numeric,(x->>'pack_size_snapshot')::numeric,x->'calc_audit',(x->>'sort_order')::integer)
      ON CONFLICT(id) DO UPDATE SET quote_roof_area_id=EXCLUDED.quote_roof_area_id,component_library_id=EXCLUDED.component_library_id,name=EXCLUDED.name,component_type=EXCLUDED.component_type,measurement_type=EXCLUDED.measurement_type,input_mode=EXCLUDED.input_mode,material_rate=EXCLUDED.material_rate,labour_rate=EXCLUDED.labour_rate,waste_type=EXCLUDED.waste_type,waste_percent=EXCLUDED.waste_percent,waste_fixed=EXCLUDED.waste_fixed,pitch_type=EXCLUDED.pitch_type,calc_pitch_degrees=EXCLUDED.calc_pitch_degrees,final_quantity=EXCLUDED.final_quantity,material_cost=EXCLUDED.material_cost,labour_cost=EXCLUDED.labour_cost,priced_quantity=EXCLUDED.priced_quantity,pack_size_snapshot=EXCLUDED.pack_size_snapshot,calc_audit=EXCLUDED.calc_audit,sort_order=EXCLUDED.sort_order WHERE quote_components.quote_id=p_quote_id;
   END IF;
   FOR e IN SELECT value FROM jsonb_array_elements(x->'entries') LOOP
     IF EXISTS(SELECT 1 FROM public.quote_component_entries WHERE id=(e->>'id')::uuid AND quote_component_id<>(x->>'id')::uuid)
     THEN RAISE EXCEPTION 'entry_parent_mismatch' USING ERRCODE='42501'; END IF;
     SELECT value INTO previous FROM jsonb_array_elements(before_entries) WHERE value->>'id'=e->>'id';
     IF previous IS DISTINCT FROM e THEN
       INSERT INTO public.quote_component_entries(id,quote_component_id,raw_value,value_after_waste,pitch_degrees,sort_order)
      VALUES((e->>'id')::uuid,(x->>'id')::uuid,(e->>'raw_value')::numeric,(e->>'value_after_waste')::numeric,(e->>'pitch_degrees')::numeric,(e->>'sort_order')::integer)
      ON CONFLICT(id) DO UPDATE SET raw_value=EXCLUDED.raw_value,value_after_waste=EXCLUDED.value_after_waste,pitch_degrees=EXCLUDED.pitch_degrees,sort_order=EXCLUDED.sort_order WHERE quote_component_entries.quote_component_id=(x->>'id')::uuid;
     END IF;
   END LOOP;
 END LOOP;
 DELETE FROM public.quote_components c WHERE c.quote_id=p_quote_id
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_before->'components') j WHERE (j->>'id')::uuid=c.id)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_after->'components') j WHERE (j->>'id')::uuid=c.id);
 DELETE FROM public.quote_roof_areas a WHERE a.quote_id=p_quote_id
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_before->'areas') j WHERE (j->>'id')::uuid=a.id)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_after->'areas') j WHERE (j->>'id')::uuid=a.id);
END; $$;



COMMIT;
