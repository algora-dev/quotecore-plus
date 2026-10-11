-- Fix (2026-10-11): library_component_change payload is wrapped in {fields};
-- the previous release read the wrapper itself, so confirmed edits would no-op.
BEGIN;

CREATE OR REPLACE FUNCTION public.sa_v2_action_confirm_atomic(p_action_id uuid,p_user_id uuid,p_digest text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb; a public.assistant_v2_actions%ROWTYPE; current_snapshot jsonb; f jsonb; e jsonb; x jsonb; qid uuid; matched integer; new_id uuid; dup_count integer;
BEGIN
 v:=public.sa_v2_actor_context(p_user_id);
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF a.digest IS DISTINCT FROM p_digest OR a.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'proof_changed' USING ERRCODE='40001'; END IF;
 IF a.status<>'proposed' THEN RETURN public.sa_v2_action_view(a); END IF;
 IF a.kind='draft_create' THEN RAISE EXCEPTION 'creation_requires_existing_action' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.users WHERE id=p_user_id FOR SHARE;
 PERFORM 1 FROM public.assistant_section_permissions WHERE company_id=a.company_id FOR SHARE;
 PERFORM 1 FROM public.assistant_v2_rollout WHERE company_id=a.company_id FOR SHARE;
 v:=public.sa_v2_actor_context(p_user_id);
 IF (v->>'company_id')::uuid IS DISTINCT FROM a.company_id OR (v->>'revision')::integer IS DISTINCT FROM a.permission_revision
   OR EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')<>'edit') THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 IF a.kind='area_change' AND NOT (v->>'p4')::boolean THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.smart_assistant_runs WHERE id=a.run_id AND status='completed') THEN RAISE EXCEPTION 'run_not_completed' USING ERRCODE='42501'; END IF;
 qid:=(a.snapshot->'quote'->>'id')::uuid;
 IF a.kind IN ('quote_details','component_change','area_change') THEN
   PERFORM 1 FROM public.quotes WHERE id=qid AND company_id=a.company_id FOR UPDATE;
   IF a.kind='component_change' THEN
     PERFORM 1 FROM public.quote_components WHERE id=a.target_id AND quote_id=qid FOR UPDATE;
     PERFORM 1 FROM public.quote_component_entries WHERE quote_component_id=a.target_id ORDER BY id FOR UPDATE;
     PERFORM 1 FROM public.component_library WHERE id=(a.snapshot->'component'->>'component_library_id')::uuid AND company_id=a.company_id FOR SHARE;
   ELSIF a.kind='area_change' AND a.target_kind='quote_area' THEN
     PERFORM 1 FROM public.quote_roof_areas WHERE id=a.target_id AND quote_id=qid FOR UPDATE;
     PERFORM 1 FROM public.quote_roof_area_entries WHERE quote_roof_area_id=a.target_id ORDER BY id FOR UPDATE;
   END IF;
 ELSIF a.kind='library_component_change' THEN
   PERFORM 1 FROM public.component_library WHERE id=a.target_id AND company_id=a.company_id FOR UPDATE;
 ELSIF a.kind='library_create' THEN
   PERFORM 1 FROM public.component_collections WHERE id=(a.payload->'component'->>'collection_id')::uuid AND company_id=a.company_id FOR SHARE;
 END IF;
 IF a.kind='library_create' THEN
   -- Duplicate-name guard re-checked under the collection lock: a component
   -- with the same name added to the same collection since proposal = conflict.
   SELECT count(*) INTO dup_count FROM public.component_library
    WHERE company_id=a.company_id AND collection_id IS NOT DISTINCT FROM (a.payload->'component'->>'collection_id')::uuid
      AND lower(name)=lower(a.payload->'component'->>'name');
   IF dup_count>0 THEN
     UPDATE public.assistant_v2_actions SET status='conflict',error='A component with this name already exists in that collection. Ask for a fresh proposal.',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
     UPDATE public.sa_action_log SET status='expired' WHERE id=a.log_id; RETURN public.sa_v2_action_view(a);
   END IF;
 ELSE
   current_snapshot:=public.sa_v2_snapshot_private(a.company_id,a.target_kind,a.target_id);
   IF a.kind='library_component_change' THEN
     IF current_snapshot IS DISTINCT FROM a.snapshot THEN
       UPDATE public.assistant_v2_actions SET status='conflict',error='The library component changed. Ask for a fresh proposal.',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
       UPDATE public.sa_action_log SET status='expired' WHERE id=a.log_id; RETURN public.sa_v2_action_view(a);
     END IF;
   ELSE
     IF current_snapshot IS DISTINCT FROM a.snapshot OR current_snapshot->'quote'->>'status' NOT IN ('draft','confirmed')
       OR (current_snapshot->'quote'->>'shared')::boolean OR current_snapshot->'quote'->>'accepted_at' IS NOT NULL OR current_snapshot->'quote'->>'withdrawn_at' IS NOT NULL THEN
       UPDATE public.assistant_v2_actions SET status='conflict',error='The record changed or is no longer editable. Ask for a fresh proposal.',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
       UPDATE public.sa_action_log SET status='expired' WHERE id=a.log_id; RETURN public.sa_v2_action_view(a);
     END IF;
   END IF;
 END IF;
 IF a.kind='quote_details' THEN
   f:=a.payload;
   UPDATE public.quotes SET customer_name=COALESCE(f->>'customer_name',customer_name),job_name=COALESCE(f->>'job_name',job_name),updated_at=clock_timestamp() WHERE id=qid AND company_id=a.company_id;
 ELSIF a.kind='component_change' THEN
   f:=a.payload->'fields';
   UPDATE public.quote_components SET material_rate=(f->>'material_rate')::numeric,labour_rate=(f->>'labour_rate')::numeric,
     waste_type=(f->>'waste_type')::public.waste_type,waste_percent=(f->>'waste_percent')::numeric,waste_fixed=(f->>'waste_fixed')::numeric,
     final_quantity=(f->>'final_quantity')::numeric,material_cost=(f->>'material_cost')::numeric,labour_cost=(f->>'labour_cost')::numeric,
     priced_quantity=(f->>'priced_quantity')::numeric,pack_size_snapshot=(f->>'pack_size_snapshot')::numeric,calc_audit=f->'calc_audit',
     is_rate_overridden=(f->>'is_rate_overridden')::boolean,is_quantity_overridden=(f->>'is_quantity_overridden')::boolean,
     is_waste_overridden=(f->>'is_waste_overridden')::boolean,is_pitch_overridden=(f->>'is_pitch_overridden')::boolean,
     use_custom_pitch=(f->>'use_custom_pitch')::boolean,custom_pitch_degrees=(f->>'custom_pitch_degrees')::numeric,calc_pitch_degrees=(f->>'calc_pitch_degrees')::numeric,
     updated_at=clock_timestamp() WHERE id=a.target_id AND quote_id=qid;
   GET DIAGNOSTICS matched=ROW_COUNT; IF matched<>1 THEN RAISE EXCEPTION 'lost_target' USING ERRCODE='40001'; END IF;
   FOR e IN SELECT x FROM jsonb_array_elements(a.payload->'entries') x LOOP
     UPDATE public.quote_component_entries SET raw_value=(e->>'raw_value')::numeric,value_after_waste=(e->>'value_after_waste')::numeric,pitch_degrees=(e->>'pitch_degrees')::numeric
       WHERE id=(e->>'id')::uuid AND quote_component_id=a.target_id;
     GET DIAGNOSTICS matched=ROW_COUNT; IF matched<>1 THEN RAISE EXCEPTION 'lost_entry' USING ERRCODE='40001'; END IF;
   END LOOP;
 ELSIF a.kind='area_change' AND a.target_kind='quote_area' THEN
   f:=a.payload->'fields';
   UPDATE public.quote_roof_areas SET label=(f->>'label')::text,calc_pitch_degrees=(f->>'calc_pitch_degrees')::numeric,
     calc_plan_sqm=(f->>'calc_plan_sqm')::numeric,final_value_sqm=(f->>'final_value_sqm')::numeric,computed_sqm=(f->>'computed_sqm')::numeric,
     updated_at=clock_timestamp() WHERE id=a.target_id AND quote_id=qid;
   GET DIAGNOSTICS matched=ROW_COUNT; IF matched<>1 THEN RAISE EXCEPTION 'lost_target' USING ERRCODE='40001'; END IF;
   FOR e IN SELECT x FROM jsonb_array_elements(a.payload->'entries') x LOOP
     UPDATE public.quote_roof_area_entries SET sqm=(e->>'sqm')::numeric,updated_at=clock_timestamp()
       WHERE id=(e->>'id')::uuid AND quote_roof_area_id=a.target_id;
     GET DIAGNOSTICS matched=ROW_COUNT; IF matched<>1 THEN RAISE EXCEPTION 'lost_entry' USING ERRCODE='40001'; END IF;
   END LOOP;
   UPDATE public.sa_action_log SET entity_type='quote_area',entity_id=a.target_id::text WHERE id=a.log_id;
 ELSIF a.kind='area_change' AND a.target_kind='quote_areas' THEN
   x:=a.payload->'area';
   INSERT INTO public.quote_roof_areas(id,quote_id,label,input_mode,final_value_sqm,calc_plan_sqm,calc_pitch_degrees,computed_sqm,sort_order,is_locked)
   VALUES((x->>'id')::uuid,qid,x->>'label',(x->>'input_mode')::public.input_mode,(x->>'final_value_sqm')::numeric,(x->>'calc_plan_sqm')::numeric,(x->>'calc_pitch_degrees')::numeric,(x->>'computed_sqm')::numeric,(x->>'sort_order')::integer,false);
   UPDATE public.sa_action_log SET entity_type='quote_area',entity_id=(x->>'id')::text WHERE id=a.log_id;
 ELSIF a.kind='library_component_change' THEN
   f:=a.payload->'fields';
   UPDATE public.component_library SET
     name=COALESCE(f->>'name',name),
     measurement_type=COALESCE(f->>'measurement_type',measurement_type)::public.measurement_type,
     default_material_rate=COALESCE(f->>'default_material_rate',default_material_rate)::numeric,
     default_labour_rate=COALESCE(f->>'default_labour_rate',default_labour_rate)::numeric,
     default_waste_type=COALESCE(f->>'default_waste_type',default_waste_type)::public.waste_type,
     default_waste_percent=COALESCE(f->>'default_waste_percent',default_waste_percent)::numeric,
     default_waste_fixed=COALESCE(f->>'default_waste_fixed',default_waste_fixed)::numeric,
     default_pitch_type=COALESCE(f->>'default_pitch_type',default_pitch_type)::public.pitch_type,
     sold_by=COALESCE(f->>'sold_by',sold_by),
     cover_width_mm=COALESCE(f->>'cover_width_mm',cover_width_mm)::numeric,
     is_active=COALESCE(f->>'is_active',is_active)::boolean,
     updated_at=clock_timestamp()
   WHERE id=a.target_id AND company_id=a.company_id;
   GET DIAGNOSTICS matched=ROW_COUNT; IF matched<>1 THEN RAISE EXCEPTION 'lost_target' USING ERRCODE='40001'; END IF;
   UPDATE public.sa_action_log SET entity_type='library_component',entity_id=a.target_id::text WHERE id=a.log_id;
 ELSIF a.kind='library_create' THEN
   x:=a.payload->'component';
   new_id:=(x->>'id')::uuid;
   INSERT INTO public.component_library(id,company_id,name,component_type,measurement_type,
     default_material_rate,default_labour_rate,default_waste_type,default_waste_percent,default_waste_fixed,
     is_active,sort_order,default_pitch_type,pricing_strategy,sold_by,cover_width_mm,collection_id)
   VALUES(new_id,a.company_id,x->>'name',COALESCE(x->>'component_type','main')::public.component_type,(x->>'measurement_type')::public.measurement_type,
     (x->>'default_material_rate')::numeric,(x->>'default_labour_rate')::numeric,
     (x->>'default_waste_type')::public.waste_type,(x->>'default_waste_percent')::numeric,(x->>'default_waste_fixed')::numeric,
     COALESCE((x->>'is_active')::boolean,true),(x->>'sort_order')::integer,
     (x->>'default_pitch_type')::public.pitch_type,'per_unit'::public.pricing_strategy,
     NULLIF(x->>'sold_by','')::text,NULLIF(x->>'cover_width_mm','')::numeric,NULLIF(x->>'collection_id','')::uuid);
   UPDATE public.sa_action_log SET entity_type='library_component',entity_id=new_id::text WHERE id=a.log_id;
 END IF;
 UPDATE public.sa_action_log SET status='committed',confirmation_method='button',confirmed_by=p_user_id,confirmed_at=clock_timestamp() WHERE id=a.log_id AND status='proposed';
 GET DIAGNOSTICS matched=ROW_COUNT; IF matched<>1 THEN RAISE EXCEPTION 'proof_not_committed' USING ERRCODE='40001'; END IF;
 UPDATE public.assistant_v2_actions SET status='committed',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 RETURN public.sa_v2_action_view(a);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_action_confirm_atomic(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_action_confirm_atomic(uuid,uuid,text,integer) TO service_role;

COMMIT;
