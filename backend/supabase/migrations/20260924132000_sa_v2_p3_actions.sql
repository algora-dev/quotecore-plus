-- AGENT-TODO P3: obtain the three policy approvals; validate precision, direct grants, lock-wait conflicts and atomic rollback before enabling writes.
-- DRAFT P3. New assistant-owned command journal and narrow atomic adapters.
-- IMPORTANT: P3 remains off until the integrator obtains the documented policy
-- approvals. No changes to auth, quota, billing functions or pricing engine.
BEGIN;
DO $precision$
DECLARE item record; actual_scale integer;
BEGIN
 FOR item IN SELECT * FROM (VALUES
   ('quote_components','material_rate'),('quote_components','labour_rate'),('quote_components','material_cost'),('quote_components','labour_cost'),
   ('quote_components','final_quantity'),('quote_component_entries','raw_value'),('quote_component_entries','value_after_waste'),
   ('quote_roof_areas','calc_plan_sqm'),('quote_roof_areas','final_value_sqm'),('quote_roof_areas','computed_sqm')
 ) AS fields(table_name,column_name) LOOP
   SELECT c.numeric_scale INTO actual_scale FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=item.table_name AND c.column_name=item.column_name;
   IF actual_scale IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'P3 storage adapter requires numeric(*,4) on %.%; review the live schema before enabling writes.',item.table_name,item.column_name; END IF;
 END LOOP;
END;
$precision$;
CREATE TABLE public.assistant_v2_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, user_id uuid NOT NULL,
  conversation_id uuid NOT NULL, run_id uuid NOT NULL, action_key text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('quote_details','component_change','draft_create')),
  target_kind text NOT NULL CHECK(target_kind IN ('quote','quote_component','creation')), target_id uuid,
  sections text[] NOT NULL, permission_revision integer NOT NULL,
  snapshot jsonb NOT NULL CHECK(pg_column_size(snapshot)<524288), payload jsonb NOT NULL CHECK(pg_column_size(payload)<524288),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300), changes jsonb NOT NULL CHECK(jsonb_typeof(changes)='array' AND jsonb_array_length(changes)<=80),
  note text NOT NULL CHECK(length(note)<=3000), digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'), version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','applying','committed','cancelled','conflict','needs_review','failed')),
  log_id uuid NOT NULL REFERENCES public.sa_action_log(id), result_quote_id uuid, error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(run_id,action_key)
);
CREATE INDEX sa_v2_actions_conversation ON public.assistant_v2_actions(company_id,user_id,conversation_id,created_at DESC);
CREATE UNIQUE INDEX sa_v2_one_creation_in_flight ON public.assistant_v2_actions(company_id,user_id) WHERE kind='draft_create' AND status IN ('applying','needs_review');
ALTER TABLE public.assistant_v2_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_v2_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.assistant_v2_actions TO service_role;
COMMENT ON TABLE public.assistant_v2_actions IS 'Private operational journal. No client writes; no cascading transcript deletion. Approval and retention are explicit P3 rollout prerequisites.';

-- Explicit actor lookup for trusted commands. Does not alter JWT/session state.
CREATE FUNCTION public.sa_v2_actor_context(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid; r public.assistant_v2_rollout%ROWTYPE; p public.assistant_section_permissions%ROWTYPE;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
  SELECT u.company_id INTO cid FROM public.users u WHERE u.id=p_user_id;
  IF cid IS NULL OR NOT COALESCE(public.smart_assistant_enabled(cid),false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.assistant_v2_rollout WHERE company_id=cid;
  SELECT * INTO p FROM public.assistant_section_permissions WHERE company_id=cid;
  IF NOT COALESCE(r.p1 AND r.p2 AND r.p3 AND r.write_policy='propose_then_confirm'
    AND r.confirmation_policy='requester_button' AND r.ledger_policy='retain_action_fields',false) THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('company_id',cid,'permissions',COALESCE(p.permissions,public.sa_v2_permissions_defaults()),'revision',COALESCE(p.revision,0),'p4',r.p4);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_actor_context(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_actor_context(uuid) TO service_role;

-- Private exact snapshots. All callers first derive or verify tenant identity.
-- VOLATILE is intentional on this reader and actor_context: confirmation calls
-- them again AFTER waiting for locks. Do not reuse a pre-lock STABLE snapshot.
-- The integration suite must exercise a competing committed edit during a lock wait.
CREATE FUNCTION public.sa_v2_snapshot_private(p_company_id uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE qid uuid; q jsonb; c jsonb; lib jsonb; entries jsonb;
BEGIN
 IF p_kind='quote' THEN qid:=p_id;
 ELSIF p_kind='quote_component' THEN SELECT t.quote_id INTO qid FROM public.quote_components t JOIN public.quotes z ON z.id=t.quote_id WHERE t.id=p_id AND z.company_id=p_company_id;
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
CREATE FUNCTION public.sa_v2_target_snapshot(p_kind text,p_id uuid) RETURNS jsonb
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
   IF v->'permissions'->>section<>'edit' OR (p_kind='quote_component' AND v->'permissions'->>'components'<>'edit') THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_target_snapshot(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_target_snapshot(text,uuid) TO authenticated;

CREATE FUNCTION public.sa_v2_action_view(a public.assistant_v2_actions) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('id',a.id,'status',a.status,'title',a.title,'changes',a.changes,'note',a.note,
   'proof_digest',a.digest,'version',a.version,'sections',a.sections,'error',a.error,'created_at',a.created_at,
   'target',CASE WHEN a.result_quote_id IS NOT NULL THEN jsonb_build_object('kind','draft_quote','id',a.result_quote_id)
     WHEN a.snapshot->'quote'->>'id' IS NOT NULL THEN jsonb_build_object('kind',CASE WHEN a.snapshot->'quote'->>'status'='draft' THEN 'draft_quote' ELSE 'quote' END,'id',a.snapshot->'quote'->>'id') ELSE NULL END);
$$;
REVOKE ALL ON FUNCTION public.sa_v2_action_view(public.assistant_v2_actions) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_action_view(public.assistant_v2_actions) TO service_role;

CREATE FUNCTION public.sa_v2_action_propose(p_run_id uuid,p_user_id uuid,p_key text,p_action jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_actor_context(p_user_id); r public.smart_assistant_runs%ROWTYPE; a public.assistant_v2_actions%ROWTYPE; lid uuid; sections text[];
BEGIN
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid;
 IF NOT FOUND OR r.status NOT IN ('accepted','running') THEN RAISE EXCEPTION 'invalid_run' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE run_id=p_run_id AND action_key=p_key;
 IF FOUND THEN RETURN public.sa_v2_action_view(a); END IF;
 IF p_action->>'kind' NOT IN ('quote_details','component_change','draft_create') OR p_action->>'digest' !~ '^[a-f0-9]{64}$'
   OR (p_action->>'permissionRevision')::integer IS DISTINCT FROM (v->>'revision')::integer
   OR jsonb_typeof(p_action->'sections')<>'array' OR jsonb_array_length(p_action->'sections') NOT BETWEEN 1 AND 9
   OR p_key IS NULL OR length(p_key)>200 THEN RAISE EXCEPTION 'invalid_proposal' USING ERRCODE='22023'; END IF;
 SELECT array_agg(x) INTO sections FROM jsonb_array_elements_text(p_action->'sections') x;
 IF EXISTS(SELECT 1 FROM unnest(sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')<>'edit') THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 IF p_action->>'kind'='draft_create' AND NOT (v->>'p4')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
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

CREATE FUNCTION public.sa_v2_action_read(p_action_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime(); a public.assistant_v2_actions%ROWTYPE;
BEGIN
 IF NOT (v->'phases'->>'p3')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=auth.uid() AND company_id=(v->>'company_id')::uuid;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')='hidden') THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 -- Proposal is executable only after the model run was durably completed.
 IF NOT EXISTS(SELECT 1 FROM public.smart_assistant_runs r WHERE r.id=a.run_id AND r.status='completed') THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 RETURN public.sa_v2_action_view(a);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_action_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_action_read(uuid) TO authenticated;
CREATE FUNCTION public.sa_v2_action_cancel(p_action_id uuid,p_digest text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime(); a public.assistant_v2_actions%ROWTYPE;
BEGIN
 IF NOT (v->'phases'->>'p3')::boolean THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=auth.uid() AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')='hidden')
   OR NOT EXISTS(SELECT 1 FROM public.smart_assistant_runs r WHERE r.id=a.run_id AND r.status='completed') THEN
   RAISE EXCEPTION 'not_found' USING ERRCODE='P0002';
 END IF;
 IF a.digest IS DISTINCT FROM p_digest OR a.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'proof_changed' USING ERRCODE='40001'; END IF;
 IF a.status='proposed' THEN
   UPDATE public.assistant_v2_actions SET status='cancelled',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
   UPDATE public.sa_action_log SET status='expired' WHERE id=a.log_id AND status='proposed';
 END IF;
 RETURN public.sa_v2_action_view(a);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_action_cancel(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_action_cancel(uuid,text,integer) TO authenticated;

CREATE FUNCTION public.sa_v2_action_confirm_atomic(p_action_id uuid,p_user_id uuid,p_digest text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb; a public.assistant_v2_actions%ROWTYPE; current_snapshot jsonb; f jsonb; e jsonb; qid uuid; matched integer;
BEGIN
 v:=public.sa_v2_actor_context(p_user_id);
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF a.digest IS DISTINCT FROM p_digest OR a.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'proof_changed' USING ERRCODE='40001'; END IF;
 IF a.status<>'proposed' THEN RETURN public.sa_v2_action_view(a); END IF;
 IF a.kind='draft_create' THEN RAISE EXCEPTION 'creation_requires_existing_action' USING ERRCODE='22023'; END IF;
 -- Share-lock only the new permission/gate rows and actor membership. No quota lock.
 PERFORM 1 FROM public.users WHERE id=p_user_id FOR SHARE;
 PERFORM 1 FROM public.assistant_section_permissions WHERE company_id=a.company_id FOR SHARE;
 PERFORM 1 FROM public.assistant_v2_rollout WHERE company_id=a.company_id FOR SHARE;
 v:=public.sa_v2_actor_context(p_user_id);
 IF (v->>'company_id')::uuid IS DISTINCT FROM a.company_id OR (v->>'revision')::integer IS DISTINCT FROM a.permission_revision
   OR EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')<>'edit') THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.smart_assistant_runs WHERE id=a.run_id AND status='completed') THEN RAISE EXCEPTION 'run_not_completed' USING ERRCODE='42501'; END IF;
 qid:=(a.snapshot->'quote'->>'id')::uuid;
 PERFORM 1 FROM public.quotes WHERE id=qid AND company_id=a.company_id FOR UPDATE;
 IF a.kind='component_change' THEN
   PERFORM 1 FROM public.quote_components WHERE id=a.target_id AND quote_id=qid FOR UPDATE;
   PERFORM 1 FROM public.quote_component_entries WHERE quote_component_id=a.target_id ORDER BY id FOR UPDATE;
   PERFORM 1 FROM public.component_library WHERE id=(a.snapshot->'component'->>'component_library_id')::uuid AND company_id=a.company_id FOR SHARE;
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
   -- Only engine outputs and explicit approved inputs. No arbitrary jsonb_populate
   -- whole-row update and no acceptance/status/currency/quote ownership changes.
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
 END IF;
 -- Business write and proof commit share this one DB transaction.
 UPDATE public.sa_action_log SET status='committed',confirmation_method='button',confirmed_by=p_user_id,confirmed_at=clock_timestamp() WHERE id=a.log_id AND status='proposed';
 GET DIAGNOSTICS matched=ROW_COUNT; IF matched<>1 THEN RAISE EXCEPTION 'proof_not_committed' USING ERRCODE='40001'; END IF;
 UPDATE public.assistant_v2_actions SET status='committed',updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 RETURN public.sa_v2_action_view(a);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_action_confirm_atomic(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_action_confirm_atomic(uuid,uuid,text,integer) TO service_role;

-- Preserve P1 messages/card filtering and extend only the owner-scoped result.
ALTER FUNCTION public.sa_v2_session_read(uuid) RENAME TO sa_v2_session_read_p1;
REVOKE ALL ON FUNCTION public.sa_v2_session_read_p1(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.sa_v2_session_read(p_conversation_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE base jsonb:=public.sa_v2_session_read_p1(p_conversation_id); v jsonb:=public.sa_v2_runtime(); actions jsonb;
BEGIN
 SELECT COALESCE(jsonb_agg(public.sa_v2_action_view(a::public.assistant_v2_actions) ORDER BY a.created_at),'[]') INTO actions FROM
   (SELECT a.* FROM public.assistant_v2_actions a JOIN public.smart_assistant_runs r ON r.id=a.run_id
    WHERE a.user_id=auth.uid() AND a.company_id=(v->>'company_id')::uuid AND a.conversation_id=p_conversation_id
      AND EXISTS(SELECT 1 FROM public.assistant_v2_run_scopes sc WHERE sc.run_id=r.id AND sc.permission_revision=(v->>'permission_revision')::integer)
      AND r.status='completed' AND r.started_at >= (v->>'history_after')::timestamptz
      AND NOT EXISTS(SELECT 1 FROM unnest(a.sections) s WHERE COALESCE(v->'permissions'->>s,'hidden')='hidden')
    ORDER BY a.created_at DESC LIMIT 60) a;
 RETURN base||jsonb_build_object('actions',actions);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_session_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_session_read(uuid) TO authenticated;
COMMIT;
