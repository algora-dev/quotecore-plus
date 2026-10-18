-- 20261018200500: Default-on rollout for ALL trusted V2 functions
-- Incident (2026-10-18 19:35 UTC, Roofline admin-granted company): migration
-- 20261018191500 taught sa_v2_runtime to default all phases ON for entitled
-- companies WITHOUT an assistant_v2_rollout row, but the trusted functions
-- below still hard-required a rollout row. Every real customer turn died at
-- bindRunScope with 42501 'invalid_run' -> surfaced to users as
-- "This action is not available with your current access.".
-- Secondary bug: sa_v2_runtime synthesized enabled_at := clock_timestamp()
-- for missing rows, so history_after was always "now" and sa_v2_session_read
-- filtered out ALL messages/runs -> welcome screen + permanently
-- unresolvable "outcome is not confirmed" client state.
--
-- Fix: every gate now accepts (rollout row with p1) OR (no rollout row at
-- all). Rows remain authoritative overrides, including the per-company
-- emergency off switch (row with p1=false still denies). The default
-- history anchor is the fixed instant the default-on model went live
-- (2026-10-18 19:15 UTC, migration 20261018191500) so history_after is
-- stable across calls instead of tracking the current time.

-- 1) sa_v2_runtime: stable history anchor for companies using defaults.
CREATE OR REPLACE FUNCTION public.sa_v2_runtime()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid(); v_company uuid; v_slug text; v_perm record;
  v_flags public.assistant_v2_rollout%ROWTYPE; v_enabled boolean; v_ready boolean;
BEGIN
  SELECT u.company_id, c.slug INTO v_company, v_slug
    FROM public.users u JOIN public.companies c ON c.id = u.company_id WHERE u.id = v_user;
  IF v_user IS NULL OR v_company IS NULL OR NOT COALESCE(public.smart_assistant_enabled(v_company), false) THEN
    RAISE EXCEPTION 'sa_v2_access_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_perm FROM public.sa_v2_permissions_read();
  SELECT r.* INTO v_flags FROM public.assistant_v2_rollout r WHERE r.company_id = v_company;
  -- Subscription-driven default (owner 2026-10-18): entitled companies without a
  -- manual rollout row get all phases on with the standard policies. Rows remain
  -- authoritative overrides (QA fixtures, per-company emergency off switch).
  IF NOT FOUND THEN
    v_flags.company_id := v_company;
    v_flags.p1 := true; v_flags.p2 := true; v_flags.p3 := true; v_flags.p4 := true;
    v_flags.write_policy := 'propose_then_confirm';
    v_flags.confirmation_policy := 'requester_button';
    v_flags.ledger_policy := 'retain_action_fields';
    -- Fixed epoch (2026-10-18): clock_timestamp() here made history_after "now"
    -- on every call, hiding all session history for default-on companies.
    v_flags.enabled_at := timestamptz '2026-10-18 19:15:00+00';
    v_flags.updated_at := timestamptz '2026-10-18 19:15:00+00';
  END IF;
  v_enabled := COALESCE(v_flags.p1, false);
  v_ready := v_flags.write_policy = 'propose_then_confirm' AND v_flags.confirmation_policy = 'requester_button' AND v_flags.ledger_policy = 'retain_action_fields';
  RETURN jsonb_build_object('user_id',v_user,'company_id',v_company,'workspace_slug',v_slug,
    'phases',jsonb_build_object('p1',v_enabled,'p2',v_enabled AND COALESCE(v_flags.p2,false),
      'p3',v_enabled AND COALESCE(v_flags.p2 AND v_flags.p3 AND v_ready,false),
      'p4',v_enabled AND COALESCE(v_flags.p2 AND v_flags.p3 AND v_flags.p4 AND v_ready,false)),
    'permissions',v_perm.permissions,'permission_revision',v_perm.revision,
    'history_after',GREATEST(v_flags.enabled_at,v_perm.updated_at), 'write_policy',v_flags.write_policy);
END;
$function$;

-- 2) sa_v2_run_scope_add: accept default-on companies (no rollout row).
CREATE OR REPLACE FUNCTION public.sa_v2_run_scope_add(p_run_id uuid, p_user_id uuid, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r public.smart_assistant_runs%ROWTYPE; current_revision integer; actual_revision integer;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=p_user_id;
 IF NOT FOUND OR r.status NOT IN ('accepted','running')
   OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.company_id=r.company_id)
   OR NOT COALESCE(public.smart_assistant_enabled(r.company_id),false)
   OR NOT (EXISTS(SELECT 1 FROM public.assistant_v2_rollout f WHERE f.company_id=r.company_id AND f.p1)
       OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_rollout f WHERE f.company_id=r.company_id)) THEN
   RAISE EXCEPTION 'invalid_run' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE((SELECT p.revision FROM public.assistant_section_permissions p WHERE p.company_id=r.company_id),0) INTO current_revision;
 IF p_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 INSERT INTO public.assistant_v2_run_scopes(run_id,company_id,user_id,permission_revision)
   VALUES(r.id,r.company_id,p_user_id,p_revision) ON CONFLICT(run_id) DO NOTHING;
 SELECT x.permission_revision INTO actual_revision FROM public.assistant_v2_run_scopes x WHERE x.run_id=r.id AND x.user_id=p_user_id AND x.company_id=r.company_id;
 IF actual_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('ok',true);
END;
$function$;

-- 3) sa_v2_actor_context: default-on phases/policies for companies without a row.
CREATE OR REPLACE FUNCTION public.sa_v2_actor_context(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'pg_catalog', 'pg_temp'
AS $function$
DECLARE cid uuid; r public.assistant_v2_rollout%ROWTYPE; p public.assistant_section_permissions%ROWTYPE; v_has_row boolean; v_p4 boolean;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
  SELECT u.company_id INTO cid FROM public.users u WHERE u.id=p_user_id;
  IF cid IS NULL OR NOT COALESCE(public.smart_assistant_enabled(cid),false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.assistant_v2_rollout WHERE company_id=cid;
  v_has_row := FOUND;
  SELECT * INTO p FROM public.assistant_section_permissions WHERE company_id=cid;
  -- Default-on (owner 2026-10-18): entitled companies without a rollout row run
  -- all phases with the standard policies, mirroring sa_v2_runtime. Rows remain
  -- authoritative overrides incl. the per-company emergency off switch.
  IF v_has_row THEN
    IF NOT COALESCE(r.p1 AND r.p2 AND r.p3 AND r.write_policy='propose_then_confirm'
      AND r.confirmation_policy='requester_button' AND r.ledger_policy='retain_action_fields',false) THEN RAISE EXCEPTION 'phase_off' USING ERRCODE='42501'; END IF;
    v_p4 := r.p4;
  ELSE
    v_p4 := true;
  END IF;
  RETURN jsonb_build_object('company_id',cid,'permissions',COALESCE(p.permissions,public.sa_v2_permissions_defaults()),'revision',COALESCE(p.revision,0),'p4',COALESCE(v_p4,true));
END;
$function$;

-- 4) sa_v2_resolution_store: same default-on acceptance for the main rollout row.
CREATE OR REPLACE FUNCTION public.sa_v2_resolution_store(p_run_id uuid, p_user_id uuid, p_revision integer, p_sections text[], p_state jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r public.smart_assistant_runs%ROWTYPE; saved public.assistant_v2_resolution_states%ROWTYPE; actual_revision integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=p_user_id;
 IF NOT FOUND OR r.status NOT IN ('accepted','running')
  OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.company_id=r.company_id)
  OR NOT EXISTS(SELECT 1 FROM public.smart_assistant_conversations c WHERE c.id=r.conversation_id AND c.user_id=p_user_id AND c.company_id=r.company_id)
  OR NOT COALESCE(public.smart_assistant_enabled(r.company_id),false)
  OR NOT (EXISTS(SELECT 1 FROM public.assistant_v2_rollout f WHERE f.company_id=r.company_id AND f.p1)
      OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_rollout f WHERE f.company_id=r.company_id))
  OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_retrieval_rollout f WHERE f.company_id=r.company_id AND f.enabled)
  OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_run_scopes sc WHERE sc.run_id=r.id AND sc.user_id=p_user_id AND sc.company_id=r.company_id AND sc.permission_revision=p_revision)
 THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT COALESCE((SELECT p.revision FROM public.assistant_section_permissions p WHERE p.company_id=r.company_id),0) INTO actual_revision;
 IF actual_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_state) IS DISTINCT FROM 'object' OR octet_length(p_state::text)>30000
  OR p_state->'version' IS DISTINCT FROM '1'::jsonb OR COALESCE(p_state->>'status','') NOT IN ('pending','resolved','closed')
  OR jsonb_typeof(p_state->'intent') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_state->'candidates') IS DISTINCT FROM 'array' OR jsonb_array_length(p_state->'candidates')>5
  OR jsonb_typeof(p_state->'rejected') IS DISTINCT FROM 'array' OR jsonb_array_length(p_state->'rejected')>20
  OR p_sections IS NULL OR cardinality(p_sections)>9 OR array_position(p_sections,NULL) IS NOT NULL
  OR NOT p_sections <@ ARRAY['quotes','draft_quotes','orders','invoices','components','customers','emails','billing','settings']::text[]
 THEN RAISE EXCEPTION 'invalid_resolution_state' USING ERRCODE='22023'; END IF;
 -- One immutable resolution outcome per run. Retrying this trusted write is
 -- idempotent; attempting to change the choices after publication is rejected.
 INSERT INTO public.assistant_v2_resolution_states(run_id,company_id,user_id,conversation_id,permission_revision,sections,state)
 VALUES(r.id,r.company_id,r.user_id,r.conversation_id,p_revision,p_sections,p_state)
 ON CONFLICT(run_id) DO NOTHING;
 SELECT * INTO saved FROM public.assistant_v2_resolution_states WHERE run_id=r.id;
 IF saved.state IS DISTINCT FROM p_state OR saved.sections IS DISTINCT FROM p_sections OR saved.permission_revision IS DISTINCT FROM p_revision
 THEN RAISE EXCEPTION 'resolution_already_set' USING ERRCODE='22023'; END IF;
 -- Opportunistic bounded pruning of THIS ACTOR's expired resolver hints only.
 -- Does not delete messages, audit proofs, action proposals or other companies.
 DELETE FROM public.assistant_v2_resolution_states x WHERE x.id IN (
  SELECT old.id FROM public.assistant_v2_resolution_states old
  WHERE old.company_id=r.company_id AND old.user_id=r.user_id AND old.expires_at<clock_timestamp()
  ORDER BY old.expires_at LIMIT 100);
 RETURN jsonb_build_object('id',saved.id,'expires_at',saved.expires_at);
END;
$function$;

-- 5) sa_v2_task_trusted_run: same default-on acceptance for the main rollout row.
CREATE OR REPLACE FUNCTION public.sa_v2_task_trusted_run(p_run_id uuid, p_user_id uuid, p_revision integer, p_knowledge_revision text)
 RETURNS smart_assistant_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r public.smart_assistant_runs%ROWTYPE; actual_revision integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=p_user_id;
 IF NOT FOUND OR r.status NOT IN ('accepted','running')
 OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.company_id=r.company_id)
 OR NOT EXISTS(SELECT 1 FROM public.smart_assistant_conversations c WHERE c.id=r.conversation_id AND c.user_id=p_user_id AND c.company_id=r.company_id)
 OR NOT COALESCE(public.smart_assistant_enabled(r.company_id),false)
 OR NOT (EXISTS(SELECT 1 FROM public.assistant_v2_rollout f WHERE f.company_id=r.company_id AND f.p1)
     OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_rollout f WHERE f.company_id=r.company_id))
 OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_retrieval_rollout f WHERE f.company_id=r.company_id AND f.enabled AND f.knowledge_revision::text=p_knowledge_revision)
 OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_run_scopes sc WHERE sc.run_id=r.id AND sc.user_id=p_user_id AND sc.company_id=r.company_id AND sc.permission_revision=p_revision)
 THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT COALESCE((SELECT p.revision FROM public.assistant_section_permissions p WHERE p.company_id=r.company_id),0) INTO actual_revision;
 IF actual_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 RETURN r;
END;
$function$;

-- 6) sa_v2_workflow_assert_proposal: stable cutoff when no rollout row exists
--    (LEFT JOIN over rollout returns zero rows for default-on companies).
CREATE OR REPLACE FUNCTION public.sa_v2_workflow_assert_proposal(a assistant_v2_actions)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'pg_catalog', 'pg_temp'
AS $function$
DECLARE b public.assistant_v2_draft_briefs%rowtype; current_epoch bigint; cutoff timestamptz;
BEGIN
 IF a.payload->>'controllerVersion' IS DISTINCT FROM '1' THEN
   IF a.payload->>'briefStateId' IS NOT NULL OR a.payload->>'editQuoteId' IS NOT NULL
   THEN RAISE EXCEPTION 'legacy_workflow_requires_review' USING ERRCODE='23505'; END IF;
   RETURN; -- Existing, non-workflow P4 creation retains its original safeguards.
 END IF;
 SELECT epoch INTO current_epoch FROM public.assistant_v2_workflow_epochs WHERE company_id=a.company_id FOR SHARE;
 SELECT greatest(r.enabled_at,p.updated_at) INTO cutoff FROM public.assistant_v2_rollout r LEFT JOIN public.assistant_section_permissions p ON p.company_id=r.company_id WHERE r.company_id=a.company_id;
 -- Default-on companies have no rollout row: anchor at the default-on epoch.
 cutoff := COALESCE(cutoff, timestamptz '2026-10-18 19:15:00+00');
 SELECT * INTO b FROM public.assistant_v2_draft_briefs WHERE id=(a.payload->>'briefStateId')::uuid AND user_id=a.user_id
   AND company_id=a.company_id AND conversation_id=a.conversation_id FOR UPDATE;
 IF NOT FOUND OR b.workflow_state<>'proposal_pending_confirmation' OR b.action_id IS DISTINCT FROM a.id
   OR b.revision IS DISTINCT FROM (a.payload->>'briefRevision')::integer OR b.permission_revision IS DISTINCT FROM a.permission_revision
   OR current_epoch IS DISTINCT FROM (a.payload->>'workflowEpoch')::bigint OR b.catalog_epoch IS DISTINCT FROM current_epoch
   OR b.produced_quote_id IS DISTINCT FROM (a.payload->>'editQuoteId')::uuid OR b.created_at<cutoff OR a.created_at<cutoff
   OR (b.produced_quote_id IS NOT NULL AND (b.committed_snapshot IS DISTINCT FROM a.snapshot->'quoteSnapshot' OR b.committed_plan IS DISTINCT FROM a.snapshot->'previousPlan'))
 THEN RAISE EXCEPTION 'workflow_changed' USING ERRCODE='23505'; END IF;
 IF a.status='proposed' THEN PERFORM public.sa_v2_workflow_assert_task(b); END IF;
END; $function$;
