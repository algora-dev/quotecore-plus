-- SA V2 Phase 2b (2026-09-29 evening): roof-area create/edit actions.
-- ADDITIVE ONLY. Gavin applies migrations; this file is not applied by agents.
--
-- Extends the existing P3 propose->confirm protocol with a new action kind
-- 'area_change' covering two targets:
--   * target_kind 'quote_area'  (EDIT): one existing quote_roof_areas row
--     (label / pitch / plan m2 / typed surface m2), with its manual
--     quote_roof_area_entries re-pitched by the same rafter factor the
--     builder's updateQuoteRoofArea action applies.
--   * target_kind 'quote_areas' (CREATE): one NEW quote_roof_areas row on an
--     editable quote/draft, inserted exactly like sa_v2_creation_finish
--     inserts draft-creation areas (same columns, is_locked=false).
-- Takeoff-derived areas are REFUSED at proposal time by the server engine
-- (canvas geometry needs the takeoff editor + calibration scale; this path
-- never re-implements polygon math). Component quantities are untouched:
-- manual/builder component entries are independent snapshots by design, so
-- there are no dependent entry recalc rows for the SQL apply to mirror.
--
-- Idempotency/confirmation follow the component_change conventions exactly:
-- proposed -> committed inside ONE transaction, guarded by digest+version,
-- run-completed, permission revision, editable-status and a fresh private
-- snapshot comparison under row locks. Re-apply (status<>'proposed') returns
-- the existing action view without touching data again. No 'applying' window
-- exists because, unlike draft creation, no external policy step runs between
-- claim and finish.
BEGIN;

-- Precision preflight (P3 style): the engine writes these columns with
-- storageNumber conventions; refuse to enable writes if the live schema
-- drifted from what the v2 schema defines.
DO $precision$
DECLARE item record; actual_scale integer;
BEGIN
 FOR item IN SELECT * FROM (VALUES
   ('quote_roof_areas','calc_pitch_degrees',4),('quote_roof_areas','calc_plan_sqm',4),
   ('quote_roof_areas','final_value_sqm',4),('quote_roof_areas','computed_sqm',4),
   ('quote_roof_area_entries','sqm',2)
 ) AS fields(table_name,column_name,expected_scale) LOOP
   SELECT c.numeric_scale INTO actual_scale FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=item.table_name AND c.column_name=item.column_name;
   IF actual_scale IS DISTINCT FROM item.expected_scale THEN RAISE EXCEPTION 'SA area adapter requires numeric scale % on %.%; live schema differs.',item.expected_scale,item.table_name,item.column_name; END IF;
 END LOOP;
END;
$precision$;

-- 1. Extend the journal CHECK constraints for the new kind/targets.
--    Direct DDL. A def-regex match silently no-ops because pg_get_constraintdef()
--    normalises IN (...) to = ANY (ARRAY[...]); replaced 2026-09-29 after the
--    first live apply (constraints verified in pg_constraint on the shared DB).
ALTER TABLE public.assistant_v2_actions DROP CONSTRAINT assistant_v2_actions_kind_check;
ALTER TABLE public.assistant_v2_actions ADD CONSTRAINT assistant_v2_actions_kind_check CHECK(kind IN (''quote_details'',''component_change'',''draft_create'',''area_change''));
ALTER TABLE public.assistant_v2_actions DROP CONSTRAINT assistant_v2_actions_target_kind_check;
ALTER TABLE public.assistant_v2_actions ADD CONSTRAINT assistant_v2_actions_target_kind_check CHECK(target_kind IN (''quote'',''quote_component'',''creation'',''quote_area'',''quote_areas''));

-- 2. Private snapshots for roof areas (service-role only, tenant-scoped).
--    'quote_area'  : {quote, area, area_entries[], takeoff_linked}
--    'quote_areas' : {quote, areas[]} for the bound draft (p_id = quote id)
CREATE OR REPLACE FUNCTION public.sa_v2_snapshot_private(p_company_id uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE qid uuid; q jsonb; c jsonb; lib jsonb; entries jsonb; a jsonb; areas jsonb;
BEGIN
 IF p_kind='quote' THEN qid:=p_id;
 ELSIF p_kind='quote_component' THEN SELECT t.quote_id INTO qid FROM public.quote_components t JOIN public.quotes z ON z.id=t.quote_id WHERE t.id=p_id AND z.company_id=p_company_id;
 ELSIF p_kind='quote_area' THEN SELECT t.quote_id INTO qid FROM public.quote_roof_areas t JOIN public.quotes z ON z.id=t.quote_id WHERE t.id=p_id AND z.company_id=p_company_id;
 ELSIF p_kind='quote_areas' THEN qid:=p_id;
 ELSIF p_kind='library' THEN
   SELECT jsonb_build_object('library',jsonb_build_object('id',x.id,'name',x.name,'company_id',x.company_id,'collection_id',x.collection_id,'is_active',x.is_active,'updated_at',x.updated_at,
     'measurement_type',x.measurement_type,'component_type',x.component_type,'default_material_rate',x.default_material_rate,'default_labour_rate',x.default_labour_rate,
     'default_waste_type',x.default_waste_type,'default_waste_percent',x.default_waste_percent,'default_waste_fixed',x.default_waste_fixed,'default_pitch_type',x.default_pitch_type,
     'pricing_strategy',x.pricing_strategy,'pack_price',x.pack_price,'pack_size',x.pack_size,'pack_coverage_m2',x.pack_coverage_m2,'height_value_mm',x.height_value_mm,'depth_value_mm',x.depth_value_mm)) INTO lib
     FROM public.component_library x WHERE x.id=p_id AND x.company_id=p_company_id;
   RETURN lib;
 ELSE RAISE EXCEPTION 'invalid_kind' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',x.id,'company_id',x.company_id,'status',x.status,'entry_mode',x.entry_mode,'customer_name',x.customer_name,'job_name',x.job_name,
   'measurement_system',x.measurement_system,'currency',x.currency,'global_pitch_degrees',x.global_pitch_degrees,'updated_at',x.updated_at,
   'trade',x.trade,'component_collection_id',x.component_collection_id,'accepted_at',x.accepted_at,'withdrawn_at',x.withdrawn_at,'shared',x.acceptance_token IS NOT NULL)
   INTO q FROM public.quotes x WHERE x.id=qid AND x.company_id=p_company_id;
 IF q IS NULL THEN RETURN NULL; END IF;
 IF p_kind='quote' THEN RETURN jsonb_build_object('quote',q); END IF;
 IF p_kind='quote_areas' THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.sort_order,x.created_at,x.id),'[]') INTO areas FROM public.quote_roof_areas x WHERE x.quote_id=qid;
   IF jsonb_array_length(areas)>48 THEN RAISE EXCEPTION 'too_many_areas' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('quote',q,'areas',areas);
 END IF;
 IF p_kind='quote_area' THEN
   SELECT to_jsonb(x) INTO a FROM public.quote_roof_areas x WHERE x.id=p_id AND x.quote_id=qid;
   IF a IS NULL THEN RETURN NULL; END IF;
   SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.sort_order,x.id),'[]') INTO entries FROM public.quote_roof_area_entries x WHERE x.quote_roof_area_id=p_id;
   IF jsonb_array_length(entries)>60 THEN RAISE EXCEPTION 'too_many_entries' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('quote',q,'area',a,'area_entries',entries,
     'takeoff_linked',EXISTS(SELECT 1 FROM public.quote_takeoff_measurements m WHERE m.quote_roof_area_id=p_id));
 END IF;
 SELECT to_jsonb(x) INTO c FROM public.quote_components x WHERE x.id=p_id AND x.quote_id=qid;
 IF c IS NULL THEN RETURN NULL; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') INTO entries FROM public.quote_component_entries x WHERE x.quote_component_id=p_id;
 IF jsonb_array_length(entries)>200 THEN RAISE EXCEPTION 'too_many_entries' USING ERRCODE='22023'; END IF;
 IF c->>'component_library_id' IS NOT NULL THEN lib:=public.sa_v2_snapshot_private(p_company_id,'library',(c->>'component_library_id')::uuid)->'library'; END IF;
 RETURN jsonb_build_object('quote',q,'component',c,'library',lib,'entries',entries);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_snapshot_private(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_snapshot_private(uuid,text,uuid) TO service_role;

-- 3. Authenticated snapshot entry point: area kinds require Edit on the
--    record's quote section AND Edit on components (builder scope), matching
--    the server-side tool registration gate.
CREATE OR REPLACE FUNCTION public.sa_v2_target_snapshot(p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime(); result jsonb; section text;
BEGIN
 IF NOT (v->'phases'->>'p3')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
 result:=public.sa_v2_snapshot_private((v->>'company_id')::uuid,p_kind,p_id);
 IF result IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF p_kind='library' THEN
   IF v->'permissions'->>'components'='hidden' THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 ELSE
   section:=CASE WHEN result->'quote'->>'status'='draft' THEN 'draft_quotes' ELSE 'quotes' END;
   IF v->'permissions'->>section<>'edit' OR (p_kind IN ('quote_component','quote_area','quote_areas') AND v->'permissions'->>'components'<>'edit') THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_target_snapshot(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_target_snapshot(text,uuid) TO authenticated;

-- 4. Proposal journal accepts area actions; the new kind is P4-gated exactly
--    like draft creation (p4 covers the creation/edit phase of this rollout).
CREATE OR REPLACE FUNCTION public.sa_v2_action_propose(p_run_id uuid,p_user_id uuid,p_key text,p_action jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_actor_context(p_user_id); r public.smart_assistant_runs%ROWTYPE; a public.assistant_v2_actions%ROWTYPE; lid uuid; sections text[];
BEGIN
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid;
 IF NOT FOUND OR r.status NOT IN ('accepted','running') THEN RAISE EXCEPTION 'invalid_run' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE run_id=p_run_id AND action_key=p_key;
 IF FOUND THEN RETURN public.sa_v2_action_view(a); END IF;
 IF p_action->>'kind' NOT IN ('quote_details','component_change','draft_create','area_change') OR p_action->>'digest' !~ '^[a-f0-9]{64}$'
   OR (p_action->>'permissionRevision')::integer IS DISTINCT FROM (v->>'revision')::integer
   OR jsonb_typeof(p_action->'sections')<>'array' OR jsonb_array_length(p_action->'sections') NOT BETWEEN 1 AND 9
   OR p_key IS NULL OR length(p_key)>200 THEN RAISE EXCEPTION 'invalid_proposal' USING ERRCODE='22023'; END IF;
 IF p_action->>'kind'='area_change' AND p_action->>'targetKind' NOT IN ('quote_area','quote_areas') THEN RAISE EXCEPTION 'invalid_proposal' USING ERRCODE='22023'; END IF;
 SELECT array_agg(x) INTO sections FROM jsonb_array_elements_text(p_action->'sections') x;
 IF EXISTS(SELECT 1 FROM unnest(sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')<>'edit') THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 IF p_action->>'kind' IN ('draft_create','area_change') AND NOT (v->>'p4')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
 INSERT INTO public.sa_action_log(company_id,user_id,run_id,action_type,entity_type,entity_id,payload_before,payload_after,verification_mode)
 VALUES(r.company_id,p_user_id,r.id,p_action->>'kind',p_action->>'targetKind',p_action->>'targetId',
   jsonb_build_object('changes',p_action->'changes','proof_digest',p_action->>'digest'),jsonb_build_object('changes',p_action->'changes','note',p_action->>'note','proof_digest',p_action->>'digest'),'chat_summary') RETURNING id INTO lid;
 INSERT INTO public.assistant_v2_actions(company_id,user_id,conversation_id,run_id,action_key,kind,target_kind,target_id,sections,permission_revision,snapshot,payload,title,changes,note,digest,log_id)
 VALUES(r.company_id,p_user_id,r.conversation_id,r.id,p_key,p_action->>'kind',p_action->>'targetKind',(p_action->>'targetId')::uuid,sections,(v->>'revision')::integer,
   p_action->'before',p_action->'after',p_action->>'title',p_action->'changes',p_action->>'note',p_action->>'digest',lid) RETURNING * INTO a;
 RETURN public.sa_v2_action_view(a);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_action_propose(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_action_propose(uuid,uuid,text,jsonb) TO service_role;

-- 5. Atomic confirm: new area_change apply branches. Everything before the
--    branches (digest/version, status machine, permission re-check under
--    share locks, run-completed, editable status, fresh-snapshot conflict
--    detection under row locks) is byte-identical to the component path.
CREATE OR REPLACE FUNCTION public.sa_v2_action_confirm_atomic(p_action_id uuid,p_user_id uuid,p_digest text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb; a public.assistant_v2_actions%ROWTYPE; current_snapshot jsonb; f jsonb; e jsonb; x jsonb; qid uuid; matched integer;
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
 PERFORM 1 FROM public.quotes WHERE id=qid AND company_id=a.company_id FOR UPDATE;
 IF a.kind='component_change' THEN
   PERFORM 1 FROM public.quote_components WHERE id=a.target_id AND quote_id=qid FOR UPDATE;
   PERFORM 1 FROM public.quote_component_entries WHERE quote_component_id=a.target_id ORDER BY id FOR UPDATE;
   PERFORM 1 FROM public.component_library WHERE id=(a.snapshot->'component'->>'component_library_id')::uuid AND company_id=a.company_id FOR SHARE;
 ELSIF a.kind='area_change' AND a.target_kind='quote_area' THEN
   PERFORM 1 FROM public.quote_roof_areas WHERE id=a.target_id AND quote_id=qid FOR UPDATE;
   PERFORM 1 FROM public.quote_roof_area_entries WHERE quote_roof_area_id=a.target_id ORDER BY id FOR UPDATE;
 END IF;
 current_snapshot:=public.sa_v2_snapshot_private(a.company_id,a.target_kind,a.target_id);
 IF current_snapshot IS DISTINCT FROM a.snapshot OR current_snapshot->'quote'->>'status' NOT IN ('draft','confirmed')
   OR (current_snapshot->'quote'->>'shared')::boolean OR current_snapshot->'quote'->>'accepted_at' IS NOT NULL OR current_snapshot->'quote'->>'withdrawn_at' IS NOT NULL THEN
   UPDATE public.assistant_v2_actions SET status='conflict',error='The record changed or is no longer editable. Ask for a fresh proposal.',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
   UPDATE public.sa_action_log SET status='expired' WHERE id=a.log_id; RETURN public.sa_v2_action_view(a);
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
