-- Workflow Controller V1 / B+C: durable briefs, safe confirmation binding,
-- and reviewed incremental revisions. NO quote parent creation is introduced.
-- Prerequisites: the existing P1-P4/Sept-30 workflow migrations and V1 vocabulary.
-- Legacy Oct-02 produced_quote_id is accepted; its destructive RPC is disabled.
BEGIN;
ALTER TABLE public.assistant_v2_draft_briefs ADD COLUMN IF NOT EXISTS produced_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;
ALTER TABLE public.assistant_v2_draft_briefs
 ADD COLUMN workflow_state text NOT NULL DEFAULT 'needs_review'
   CHECK(workflow_state IN ('collecting','needs_choices','ready_to_review','proposal_pending_confirmation','committed','needs_review','cancelled','closed')),
 ADD COLUMN catalog_epoch bigint,
 ADD COLUMN start_run_id uuid REFERENCES public.smart_assistant_runs(id) ON DELETE SET NULL,
 ADD COLUMN last_run_id uuid REFERENCES public.smart_assistant_runs(id) ON DELETE SET NULL,
 ADD COLUMN action_id uuid REFERENCES public.assistant_v2_actions(id),
 ADD COLUMN committed_plan jsonb,
 ADD COLUMN committed_snapshot jsonb,
 ADD COLUMN conflict_reason text;
-- Do not synthesize stable IDs or a committed baseline for legacy briefs. A
-- legacy in-progress job needs explicit review/restart, never a guessed rebind.
UPDATE public.assistant_v2_draft_briefs SET conflict_reason='legacy_brief_requires_review';
DO $$ DECLARE constraint_name text;
BEGIN
 FOR constraint_name IN SELECT conname FROM pg_constraint
   WHERE conrelid='public.assistant_v2_draft_briefs'::regclass AND contype='u'
     AND pg_get_constraintdef(oid)='UNIQUE (company_id, user_id, conversation_id)'
 LOOP EXECUTE format('ALTER TABLE public.assistant_v2_draft_briefs DROP CONSTRAINT %I',constraint_name); END LOOP;
END $$;
CREATE UNIQUE INDEX sa_v2_workflow_one_start_per_run ON public.assistant_v2_draft_briefs(start_run_id) WHERE start_run_id IS NOT NULL;
CREATE INDEX sa_v2_workflow_latest ON public.assistant_v2_draft_briefs(company_id,user_id,conversation_id,updated_at DESC);
GRANT SELECT,INSERT,UPDATE ON public.assistant_v2_draft_briefs TO service_role;

-- Repeated EDIT actions may target the same quote. Only creation actions retain
-- the one-created-parent index; this does not permit replaying parent creation.
DROP INDEX IF EXISTS public.sa_v2_created_quote_once;
CREATE UNIQUE INDEX sa_v2_created_quote_once ON public.assistant_v2_actions(result_quote_id)
 WHERE result_quote_id IS NOT NULL AND payload->>'editQuoteId' IS NULL;

CREATE FUNCTION public.sa_v2_workflow_run_actor(p_user_id uuid,p_conversation_id uuid,p_run_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_actor_context(p_user_id);
BEGIN
 IF NOT coalesce((v->>'p4')::boolean,false) OR EXISTS(SELECT 1 FROM unnest(ARRAY['draft_quotes','customers','components']) s WHERE coalesce(v->'permissions'->>s,'hidden')<>'edit')
 THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.smart_assistant_runs r JOIN public.smart_assistant_conversations c ON c.id=r.conversation_id
  WHERE r.id=p_run_id AND r.user_id=p_user_id AND r.company_id=(v->>'company_id')::uuid
    AND r.conversation_id=p_conversation_id AND r.status IN ('accepted','running')
    AND c.user_id=p_user_id AND c.company_id=r.company_id AND c.active_run_id=r.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_run' USING ERRCODE='42501'; END IF;
 RETURN v;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_run_actor(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sa_v2_workflow_expire_proposal(p_brief_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.assistant_v2_actions%rowtype;
BEGIN
 -- All workflow callers take the same per-user advisory lock. Also lock the
 -- action to serialize with the pre-existing cancellation endpoint.
 FOR a IN SELECT * FROM public.assistant_v2_actions
   WHERE payload->>'briefStateId'=p_brief_id::text AND status IN ('proposed','applying','needs_review') FOR UPDATE
 LOOP
   IF a.status IN ('applying','needs_review') THEN RAISE EXCEPTION 'prior_creation_needs_review' USING ERRCODE='P0004'; END IF;
   UPDATE public.assistant_v2_actions SET status='cancelled',updated_at=clock_timestamp() WHERE id=a.id;
   UPDATE public.sa_action_log SET status='expired',payload_after=payload_after||jsonb_build_object('superseded_by_workflow',true)
     WHERE id=a.log_id AND status='proposed';
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_expire_proposal(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Optional task binding: when task context was active at creation, a stale
-- card cannot revive it after Done, expiry, or a self-contained new request.
CREATE FUNCTION public.sa_v2_workflow_assert_task(b public.assistant_v2_draft_briefs) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE original_task uuid; t public.assistant_v2_task_context%rowtype;
BEGIN
 SELECT task_id INTO original_task FROM public.assistant_v2_task_runs WHERE run_id=b.start_run_id
   AND user_id=b.user_id AND company_id=b.company_id AND conversation_id=b.conversation_id;
 IF original_task IS NULL THEN RETURN; END IF; -- Task-context feature was off.
 SELECT * INTO t FROM public.assistant_v2_task_context WHERE conversation_id=b.conversation_id AND user_id=b.user_id AND company_id=b.company_id FOR SHARE;
 IF NOT FOUND OR t.task_id IS DISTINCT FROM original_task OR t.status='closed' OR t.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'workflow_task_changed' USING ERRCODE='40001'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_assert_task(public.assistant_v2_draft_briefs) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sa_v2_workflow_save(p_user_id uuid,p_conversation_id uuid,p_run_id uuid,p_state_id uuid,p_expected_revision integer,p_epoch bigint,p_brief jsonb,p_state text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb; cid uuid; current_epoch bigint; b public.assistant_v2_draft_briefs%rowtype; previous_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||p_user_id::text,0));
 v:=public.sa_v2_workflow_run_actor(p_user_id,p_conversation_id,p_run_id); cid:=(v->>'company_id')::uuid;
 SELECT epoch INTO current_epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=cid FOR SHARE;
 IF current_epoch IS DISTINCT FROM p_epoch THEN RAISE EXCEPTION 'workflow_config_changed' USING ERRCODE='40001'; END IF;
 IF p_state NOT IN ('collecting','needs_choices','ready_to_review') OR p_state IS NULL
   OR jsonb_typeof(p_brief) IS DISTINCT FROM 'object' OR p_brief->>'version' IS DISTINCT FROM '1'
   OR jsonb_typeof(p_brief->'areas') IS DISTINCT FROM 'array' OR jsonb_array_length(p_brief->'areas')>12
   OR jsonb_typeof(p_brief->'measurements') IS DISTINCT FROM 'array' OR jsonb_array_length(p_brief->'measurements')>24
   OR length(p_brief::text)>200000
 THEN RAISE EXCEPTION 'invalid_working_brief' USING ERRCODE='22023'; END IF;
 IF p_state_id IS NULL THEN
   IF p_expected_revision IS NOT NULL OR EXISTS(SELECT 1 FROM public.assistant_v2_draft_briefs WHERE start_run_id=p_run_id)
   THEN RAISE EXCEPTION 'workflow_already_started' USING ERRCODE='40001'; END IF;
   -- New goals get a NEW brief. Never reuse a previously produced quote ID.
   FOR previous_id IN SELECT id FROM public.assistant_v2_draft_briefs WHERE company_id=cid AND user_id=p_user_id AND conversation_id=p_conversation_id
     AND workflow_state NOT IN ('cancelled','closed') FOR UPDATE
   LOOP
     PERFORM public.sa_v2_workflow_expire_proposal(previous_id);
     UPDATE public.assistant_v2_draft_briefs SET workflow_state='closed',status='closed',updated_at=clock_timestamp() WHERE id=previous_id;
   END LOOP;
   INSERT INTO public.assistant_v2_draft_briefs(company_id,user_id,conversation_id,permission_revision,brief,workflow_state,catalog_epoch,start_run_id,last_run_id,status)
   VALUES(cid,p_user_id,p_conversation_id,(v->>'revision')::integer,p_brief,p_state,p_epoch,p_run_id,p_run_id,'open') RETURNING * INTO b;
 ELSE
   SELECT * INTO b FROM public.assistant_v2_draft_briefs WHERE id=p_state_id AND company_id=cid AND user_id=p_user_id AND conversation_id=p_conversation_id FOR UPDATE;
   IF NOT FOUND OR b.revision IS DISTINCT FROM p_expected_revision OR b.workflow_state IN ('cancelled','closed')
     OR b.permission_revision IS DISTINCT FROM (v->>'revision')::integer OR b.brief->>'version' IS DISTINCT FROM '1'
   THEN RAISE EXCEPTION 'workflow_changed' USING ERRCODE='40001'; END IF;
   IF (b.produced_quote_id IS NOT NULL AND (b.committed_plan IS NULL OR b.committed_snapshot IS NULL)) OR (b.produced_quote_id IS NULL AND (b.committed_plan IS NOT NULL OR b.committed_snapshot IS NOT NULL))
   THEN RAISE EXCEPTION 'bound_draft_needs_review' USING ERRCODE='P0004'; END IF;
   PERFORM public.sa_v2_workflow_assert_task(b);
   PERFORM public.sa_v2_workflow_expire_proposal(b.id);
   UPDATE public.assistant_v2_draft_briefs SET brief=p_brief,revision=revision+1,catalog_epoch=p_epoch,workflow_state=p_state,status='open',
     last_run_id=p_run_id,action_id=NULL,conflict_reason=NULL,updated_at=clock_timestamp() WHERE id=b.id RETURNING * INTO b;
 END IF;
 RETURN to_jsonb(b);
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_save(uuid,uuid,uuid,uuid,integer,bigint,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_workflow_save(uuid,uuid,uuid,uuid,integer,bigint,jsonb,text) TO service_role;

CREATE FUNCTION public.sa_v2_workflow_attach(p_user_id uuid,p_run_id uuid,p_state_id uuid,p_revision integer,p_action_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE b public.assistant_v2_draft_briefs%rowtype; a public.assistant_v2_actions%rowtype; current_epoch bigint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||p_user_id::text,0));
 SELECT * INTO b FROM public.assistant_v2_draft_briefs WHERE id=p_state_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 PERFORM public.sa_v2_workflow_run_actor(p_user_id,b.conversation_id,p_run_id);
 SELECT epoch INTO current_epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=b.company_id FOR SHARE;
 SELECT * INTO b FROM public.assistant_v2_draft_briefs WHERE id=p_state_id FOR UPDATE;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND company_id=b.company_id AND run_id=p_run_id FOR UPDATE;
 IF NOT FOUND OR a.kind<>'draft_create' OR a.status<>'proposed' OR b.revision IS DISTINCT FROM p_revision
   OR b.last_run_id IS DISTINCT FROM p_run_id OR b.workflow_state<>'ready_to_review'
   OR a.payload->>'controllerVersion' IS DISTINCT FROM '1' OR a.payload->>'briefStateId' IS DISTINCT FROM b.id::text
   OR (a.payload->>'briefRevision')::integer IS DISTINCT FROM b.revision
   OR (a.payload->>'workflowEpoch')::bigint IS DISTINCT FROM current_epoch OR current_epoch IS DISTINCT FROM b.catalog_epoch
   OR (a.payload->>'editQuoteId')::uuid IS DISTINCT FROM b.produced_quote_id
 THEN RAISE EXCEPTION 'workflow_changed' USING ERRCODE='40001'; END IF;
 UPDATE public.assistant_v2_draft_briefs SET action_id=a.id,workflow_state='proposal_pending_confirmation',status='proposal',updated_at=clock_timestamp() WHERE id=b.id;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_attach(uuid,uuid,uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_workflow_attach(uuid,uuid,uuid,integer,uuid) TO service_role;

CREATE FUNCTION public.sa_v2_workflow_cancel(p_user_id uuid,p_conversation_id uuid,p_run_id uuid,p_state_id uuid,p_revision integer,p_close boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb; b public.assistant_v2_draft_briefs%rowtype;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||p_user_id::text,0));
 v:=public.sa_v2_workflow_run_actor(p_user_id,p_conversation_id,p_run_id);
 FOR b IN SELECT * FROM public.assistant_v2_draft_briefs WHERE company_id=(v->>'company_id')::uuid AND user_id=p_user_id AND conversation_id=p_conversation_id
   AND (p_state_id IS NULL OR id=p_state_id) AND workflow_state NOT IN ('cancelled','closed') FOR UPDATE
 LOOP
   IF p_state_id IS NOT NULL AND b.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'workflow_changed' USING ERRCODE='40001'; END IF;
   IF p_close AND EXISTS(SELECT 1 FROM public.assistant_v2_actions a WHERE a.user_id=b.user_id AND a.company_id=b.company_id AND a.payload->>'briefStateId'=b.id::text AND a.status IN ('applying','needs_review')) THEN CONTINUE; END IF;
   PERFORM public.sa_v2_workflow_expire_proposal(b.id);
   UPDATE public.assistant_v2_draft_briefs SET workflow_state=CASE WHEN p_close THEN 'closed' ELSE 'cancelled' END,
     status=CASE WHEN p_close THEN 'closed' ELSE 'cancelled' END,updated_at=clock_timestamp() WHERE id=b.id;
 END LOOP;
 -- Closing/cancelling never creates, confirms, deletes or edits a quote.
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_cancel(uuid,uuid,uuid,uuid,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_workflow_cancel(uuid,uuid,uuid,uuid,integer,boolean) TO service_role;

-- Exact full-row conflict baseline is private; it is never model context or a
-- client card. A manual builder edit must not be silently overwritten.
CREATE FUNCTION public.sa_v2_workflow_snapshot_private(p_company_id uuid,p_quote_id uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('quote',to_jsonb(q),
  'areas',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.quote_roof_areas x WHERE x.quote_id=q.id),'[]'::jsonb),
  'components',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.quote_components x WHERE x.quote_id=q.id),'[]'::jsonb),
  'entries',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.quote_component_entries e JOIN public.quote_components c ON c.id=e.quote_component_id WHERE c.quote_id=q.id),'[]'::jsonb),
  'area_entries',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.quote_roof_area_entries e JOIN public.quote_roof_areas a ON a.id=e.quote_roof_area_id WHERE a.quote_id=q.id),'[]'::jsonb))
 FROM public.quotes q WHERE q.id=p_quote_id AND q.company_id=p_company_id;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_snapshot_private(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.sa_v2_workflow_quote_snapshot(p_user_id uuid,p_quote_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_actor_context(p_user_id); snapshot jsonb;
BEGIN
 IF NOT coalesce((v->>'p4')::boolean,false) OR EXISTS(SELECT 1 FROM unnest(ARRAY['draft_quotes','customers','components']) s WHERE coalesce(v->'permissions'->>s,'hidden')<>'edit')
 THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 snapshot:=public.sa_v2_workflow_snapshot_private((v->>'company_id')::uuid,p_quote_id);
 IF snapshot IS NULL OR snapshot->'quote'->>'created_by_user_id' IS DISTINCT FROM p_user_id::text THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 RETURN snapshot;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_quote_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_workflow_quote_snapshot(uuid,uuid) TO service_role;

CREATE FUNCTION public.sa_v2_workflow_assert_proposal(a public.assistant_v2_actions) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE b public.assistant_v2_draft_briefs%rowtype; current_epoch bigint; cutoff timestamptz;
BEGIN
 IF a.payload->>'controllerVersion' IS DISTINCT FROM '1' THEN
   IF a.payload->>'briefStateId' IS NOT NULL OR a.payload->>'editQuoteId' IS NOT NULL
   THEN RAISE EXCEPTION 'legacy_workflow_requires_review' USING ERRCODE='40001'; END IF;
   RETURN; -- Existing, non-workflow P4 creation retains its original safeguards.
 END IF;
 SELECT epoch INTO current_epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=a.company_id FOR SHARE;
 SELECT greatest(r.enabled_at,p.updated_at) INTO cutoff FROM public.assistant_v2_rollout r LEFT JOIN public.assistant_section_permissions p ON p.company_id=r.company_id WHERE r.company_id=a.company_id;
 SELECT * INTO b FROM public.assistant_v2_draft_briefs WHERE id=(a.payload->>'briefStateId')::uuid AND user_id=a.user_id
   AND company_id=a.company_id AND conversation_id=a.conversation_id FOR UPDATE;
 IF NOT FOUND OR b.workflow_state<>'proposal_pending_confirmation' OR b.action_id IS DISTINCT FROM a.id
   OR b.revision IS DISTINCT FROM (a.payload->>'briefRevision')::integer OR b.permission_revision IS DISTINCT FROM a.permission_revision
   OR current_epoch IS DISTINCT FROM (a.payload->>'workflowEpoch')::bigint OR b.catalog_epoch IS DISTINCT FROM current_epoch
   OR b.produced_quote_id IS DISTINCT FROM (a.payload->>'editQuoteId')::uuid OR b.created_at<cutoff OR a.created_at<cutoff
   OR (b.produced_quote_id IS NOT NULL AND (b.committed_snapshot IS DISTINCT FROM a.snapshot->'quoteSnapshot' OR b.committed_plan IS DISTINCT FROM a.snapshot->'previousPlan'))
 THEN RAISE EXCEPTION 'workflow_changed' USING ERRCODE='40001'; END IF;
 IF a.status='proposed' THEN PERFORM public.sa_v2_workflow_assert_task(b); END IF;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_assert_proposal(public.assistant_v2_actions) FROM PUBLIC,anon,authenticated,service_role;

-- Rename and privatise the exact installed Sept-30/P4 implementations. The
-- wrappers compose with them rather than weakening quota/proof/audit policy.
ALTER FUNCTION public.sa_v2_creation_claim(uuid,uuid,text,integer) RENAME TO sa_v2_creation_claim_pre_controller_v1;
ALTER FUNCTION public.sa_v2_creation_finish(uuid,uuid,jsonb) RENAME TO sa_v2_creation_finish_pre_controller_v1;
ALTER FUNCTION public.sa_v2_creation_uncertain(uuid,uuid,text) RENAME TO sa_v2_creation_uncertain_pre_controller_v1;
REVOKE ALL ON FUNCTION public.sa_v2_creation_claim_pre_controller_v1(uuid,uuid,text,integer),public.sa_v2_creation_finish_pre_controller_v1(uuid,uuid,jsonb),public.sa_v2_creation_uncertain_pre_controller_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sa_v2_creation_claim(p_action_id uuid,p_user_id uuid,p_digest text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb; a public.assistant_v2_actions%rowtype;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||p_user_id::text,0));
 v:=public.sa_v2_actor_context(p_user_id);
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF a.status='proposed' THEN PERFORM public.sa_v2_workflow_assert_proposal(a); END IF;
 RETURN public.sa_v2_creation_claim_pre_controller_v1(p_action_id,p_user_id,p_digest,p_version);
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_claim(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_claim(uuid,uuid,text,integer) TO service_role;

CREATE FUNCTION public.sa_v2_workflow_bind_committed(a public.assistant_v2_actions) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE matched integer;
BEGIN
 IF a.payload->>'controllerVersion' IS DISTINCT FROM '1' THEN RETURN; END IF;
 IF a.status<>'committed' OR a.result_quote_id IS NULL THEN RAISE EXCEPTION 'not_committed' USING ERRCODE='40001'; END IF;
 UPDATE public.assistant_v2_draft_briefs SET produced_quote_id=a.result_quote_id,committed_plan=a.payload,
   committed_snapshot=public.sa_v2_workflow_snapshot_private(a.company_id,a.result_quote_id),
   workflow_state='committed',status='closed',conflict_reason=NULL,updated_at=clock_timestamp()
 WHERE id=(a.payload->>'briefStateId')::uuid AND company_id=a.company_id AND user_id=a.user_id
   AND revision=(a.payload->>'briefRevision')::integer AND action_id=a.id;
 GET DIAGNOSTICS matched=ROW_COUNT;
 IF matched<>1 THEN RAISE EXCEPTION 'workflow_changed' USING ERRCODE='40001'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_bind_committed(public.assistant_v2_actions) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sa_v2_creation_finish(p_action_id uuid,p_user_id uuid,p_children jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.assistant_v2_actions%rowtype; result jsonb; v jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||p_user_id::text,0));
 v:=public.sa_v2_actor_context(p_user_id);
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 IF a.status='committed' THEN RETURN public.sa_v2_action_view(a); END IF;
 IF a.payload->>'editQuoteId' IS NOT NULL THEN RAISE EXCEPTION 'use_atomic_workflow_edit' USING ERRCODE='42501'; END IF;
 PERFORM public.sa_v2_workflow_assert_proposal(a);
 result:=public.sa_v2_creation_finish_pre_controller_v1(p_action_id,p_user_id,p_children);
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id;
 PERFORM public.sa_v2_workflow_bind_committed(a);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_finish(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_finish(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.sa_v2_creation_uncertain(p_action_id uuid,p_user_id uuid,p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.assistant_v2_actions%rowtype; result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||p_user_id::text,0));
 result:=public.sa_v2_creation_uncertain_pre_controller_v1(p_action_id,p_user_id,p_code);
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=p_user_id;
 IF a.payload->>'controllerVersion'='1' AND a.status IN ('needs_review','failed') THEN
  UPDATE public.assistant_v2_draft_briefs SET workflow_state=CASE WHEN a.status='needs_review' THEN 'needs_review' ELSE 'collecting' END,
    conflict_reason=a.error,updated_at=clock_timestamp()
   WHERE id=(a.payload->>'briefStateId')::uuid AND user_id=p_user_id AND company_id=a.company_id AND action_id=a.id;
 END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_creation_uncertain(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_creation_uncertain(uuid,uuid,text) TO service_role;

-- Private narrow child mutation transport, using engine-calculated payloads.
CREATE FUNCTION public.sa_v2_workflow_apply_children(p_quote_id uuid,p_company_id uuid,p_before jsonb,p_after jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE x jsonb; e jsonb; previous jsonb; before_entries jsonb; after_entries jsonb; expected uuid[]; actual uuid[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.quotes WHERE id=p_quote_id AND company_id=p_company_id)
   OR jsonb_typeof(p_before->'areas') IS DISTINCT FROM 'array' OR jsonb_typeof(p_after->'areas') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_before->'components') IS DISTINCT FROM 'array' OR jsonb_typeof(p_after->'components') IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_after->'areas')>12 OR jsonb_array_length(p_after->'components') NOT BETWEEN 1 AND 24
 THEN RAISE EXCEPTION 'invalid_structural_plan' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(e),'[]'::jsonb) INTO before_entries FROM jsonb_array_elements(p_before->'components') c CROSS JOIN LATERAL jsonb_array_elements(c->'entries') e;
 SELECT coalesce(jsonb_agg(e),'[]'::jsonb) INTO after_entries FROM jsonb_array_elements(p_after->'components') c CROSS JOIN LATERAL jsonb_array_elements(c->'entries') e;
 IF jsonb_array_length(after_entries) NOT BETWEEN 1 AND 600 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_after->'components') c
   WHERE jsonb_typeof(c->'entries') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'entries') NOT BETWEEN 1 AND 200)
 THEN RAISE EXCEPTION 'invalid_measurement_entries' USING ERRCODE='22023'; END IF;
 -- Refuse any untracked builder/trigger-created structures rather than deleting
 -- or rebasing them invisibly. Identity comparisons include every repeated entry.
 SELECT array_agg((value->>'id')::uuid ORDER BY value->>'id') INTO expected FROM jsonb_array_elements(p_before->'areas');
 SELECT array_agg(id ORDER BY id) INTO actual FROM public.quote_roof_areas WHERE quote_id=p_quote_id;
 IF coalesce(expected,'{}') IS DISTINCT FROM coalesce(actual,'{}') THEN RAISE EXCEPTION 'area_identity_changed' USING ERRCODE='40001'; END IF;
 SELECT array_agg((value->>'id')::uuid ORDER BY value->>'id') INTO expected FROM jsonb_array_elements(p_before->'components');
 SELECT array_agg(id ORDER BY id) INTO actual FROM public.quote_components WHERE quote_id=p_quote_id;
 IF coalesce(expected,'{}') IS DISTINCT FROM coalesce(actual,'{}') THEN RAISE EXCEPTION 'component_identity_changed' USING ERRCODE='40001'; END IF;
 SELECT array_agg((value->>'id')::uuid ORDER BY value->>'id') INTO expected FROM jsonb_array_elements(before_entries);
 SELECT array_agg(e.id ORDER BY e.id) INTO actual FROM public.quote_component_entries e JOIN public.quote_components c ON c.id=e.quote_component_id WHERE c.quote_id=p_quote_id;
 IF coalesce(expected,'{}') IS DISTINCT FROM coalesce(actual,'{}') THEN RAISE EXCEPTION 'entry_identity_changed' USING ERRCODE='40001'; END IF;
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
 DELETE FROM public.quote_component_entries e USING public.quote_components c
 WHERE e.quote_component_id=c.id AND c.quote_id=p_quote_id
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(before_entries) j WHERE (j->>'id')::uuid=e.id)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(after_entries) j WHERE (j->>'id')::uuid=e.id);

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
REVOKE ALL ON FUNCTION public.sa_v2_workflow_apply_children(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sa_v2_workflow_edit_confirm(p_action_id uuid,p_user_id uuid,p_digest text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE claim jsonb; a public.assistant_v2_actions%rowtype; q public.quotes%rowtype; snapshot jsonb; lib jsonb; matched integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 -- Claim, locks, exact comparison, child/parent writes, audit and brief binding
 -- are ONE transaction. A failed statement rolls back the claim and every edit.
 claim:=public.sa_v2_creation_claim(p_action_id,p_user_id,p_digest,p_version);
 IF claim->>'claimed' IS DISTINCT FROM 'true' THEN RETURN claim->'action'; END IF;
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id;
 IF a.payload->>'controllerVersion' IS DISTINCT FROM '1' OR a.payload->>'editQuoteId' IS NULL
 THEN RAISE EXCEPTION 'not_a_workflow_edit' USING ERRCODE='22023'; END IF;
 SELECT * INTO q FROM public.quotes WHERE id=(a.payload->>'editQuoteId')::uuid AND company_id=a.company_id FOR UPDATE;
 IF NOT FOUND OR q.created_by_user_id IS DISTINCT FROM p_user_id OR q.status::text<>'draft' OR q.entry_mode<>'manual'
   OR q.acceptance_token IS NOT NULL OR q.accepted_at IS NOT NULL OR q.withdrawn_at IS NOT NULL OR q.declined_at IS NOT NULL
   OR q.measurement_system::text IS DISTINCT FROM a.payload->'params'->>'measurementSystem'
   OR q.currency IS DISTINCT FROM a.payload->>'currency' OR q.trade::text IS DISTINCT FROM a.payload->'params'->>'trade'
 THEN RAISE EXCEPTION 'edit_target_changed' USING ERRCODE='40001'; END IF;
 -- Parent locks also block new FK-referencing child inserts. Lock existing
 -- descendants against independent builder updates before taking the baseline.
 PERFORM 1 FROM public.quote_roof_areas WHERE quote_id=q.id ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.quote_components WHERE quote_id=q.id ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.quote_component_entries e JOIN public.quote_components c ON c.id=e.quote_component_id WHERE c.quote_id=q.id ORDER BY e.id FOR UPDATE OF e;
 PERFORM 1 FROM public.quote_roof_area_entries e JOIN public.quote_roof_areas r ON r.id=e.quote_roof_area_id WHERE r.quote_id=q.id ORDER BY e.id FOR UPDATE OF e;
 snapshot:=public.sa_v2_workflow_snapshot_private(a.company_id,q.id);
 IF snapshot IS DISTINCT FROM a.snapshot->'quoteSnapshot' OR jsonb_array_length(snapshot->'area_entries')<>0
 THEN RAISE EXCEPTION 'draft_snapshot_changed' USING ERRCODE='40001'; END IF;
 FOR lib IN SELECT value FROM jsonb_array_elements(a.snapshot->'libraries') LOOP
   PERFORM 1 FROM public.component_library WHERE id=(lib->>'id')::uuid AND company_id=a.company_id FOR SHARE;
   IF public.sa_v2_snapshot_private(a.company_id,'library',(lib->>'id')::uuid)->'library' IS DISTINCT FROM lib
   THEN RAISE EXCEPTION 'library_changed' USING ERRCODE='40001'; END IF;
 END LOOP;
 PERFORM public.sa_v2_workflow_apply_children(q.id,a.company_id,a.snapshot->'previousPlan'->'children',a.payload->'children');
 UPDATE public.quotes SET customer_name=a.payload->'params'->>'customerName',job_name=a.payload->'params'->>'jobName',
   site_address=nullif(a.payload->'params'->>'siteAddress',''),component_collection_id=(a.payload->'params'->>'componentCollectionId')::uuid,
   global_pitch_degrees=(a.payload->>'pitch')::numeric,updated_at=clock_timestamp() WHERE id=q.id AND company_id=a.company_id;
 UPDATE public.sa_action_log SET status='committed',entity_type='quote',entity_id=q.id::text,
   payload_after=payload_after||jsonb_build_object('updated_quote_id',q.id,'mutation','structural_incremental_v1') WHERE id=a.log_id AND status='confirmed';
 GET DIAGNOSTICS matched=ROW_COUNT;
 IF matched<>1 THEN RAISE EXCEPTION 'proof_not_committed' USING ERRCODE='40001'; END IF;
 UPDATE public.assistant_v2_actions SET status='committed',result_quote_id=q.id,updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 PERFORM public.sa_v2_workflow_bind_committed(a);
 RETURN public.sa_v2_action_view(a);
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_edit_confirm(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_workflow_edit_confirm(uuid,uuid,text,integer) TO service_role;

-- Safety net for old binaries: even an accidental legacy call cannot delete
-- quote children. Rollback the application flag, never restore this helper.
CREATE OR REPLACE FUNCTION public.sa_v2_draft_edit_clear(p_quote_id uuid,p_company_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'destructive_draft_rebuild_disabled' USING ERRCODE='42501'; END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_draft_edit_clear(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- A pre-proposal read conflict is a state transition, not an automatic rebase.
CREATE FUNCTION public.sa_v2_workflow_conflict(p_user_id uuid,p_conversation_id uuid,p_run_id uuid,p_state_id uuid,p_revision integer,p_baseline jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb; b public.assistant_v2_draft_briefs%rowtype;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||p_user_id::text,0));
 v:=public.sa_v2_workflow_run_actor(p_user_id,p_conversation_id,p_run_id);
 SELECT * INTO b FROM public.assistant_v2_draft_briefs WHERE id=p_state_id AND user_id=p_user_id AND company_id=(v->>'company_id')::uuid AND conversation_id=p_conversation_id FOR UPDATE;
 IF NOT FOUND OR b.revision IS DISTINCT FROM p_revision OR b.committed_snapshot IS DISTINCT FROM p_baseline OR b.workflow_state IN ('closed','cancelled')
 THEN RAISE EXCEPTION 'workflow_changed' USING ERRCODE='40001'; END IF;
 PERFORM public.sa_v2_workflow_expire_proposal(b.id);
 UPDATE public.assistant_v2_draft_briefs SET workflow_state='needs_review',conflict_reason='The saved draft changed outside this working brief. Review it in the builder; no automatic rebase or duplicate creation is allowed.',updated_at=clock_timestamp() WHERE id=b.id;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_conflict(uuid,uuid,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_workflow_conflict(uuid,uuid,uuid,uuid,integer,jsonb) TO service_role;

COMMIT;
