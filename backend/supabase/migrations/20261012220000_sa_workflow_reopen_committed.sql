-- Smart Assistant workflow: a CONFIRMED draft stays revisable after its
-- original chat task closes (owner 2026-10-12). Demo chapter step 2
-- ("change it in one line") arrives after the visitor confirms the draft;
-- the brief is workflow_state='committed' with a bound produced_quote_id.
-- The old task-liveness assert raised workflow_task_changed and dead-ended
-- every follow-up edit with "working brief no longer active".
-- The reopen safety net stays DATA-state, not task-liveness: the revise and
-- edit-confirm paths still enforce exact committed-snapshot equality, so a
-- manually edited/sent/withdrawn draft can never be silently overwritten.
-- Unbound briefs ('collecting'/'needs_choices'/'ready_to_review'/
-- 'proposal_pending_confirmation') and cancelled/closed briefs keep the
-- full task-binding check unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.sa_v2_workflow_assert_task(b public.assistant_v2_draft_briefs) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE original_task uuid; t public.assistant_v2_task_context%rowtype;
BEGIN
 -- A committed, quote-bound brief may be reopened by a later task. The
 -- original task boundary is irrelevant here; the snapshot-equality guards
 -- on revise/confirm are the authoritative protection.
 IF b.workflow_state='committed' AND b.produced_quote_id IS NOT NULL AND b.committed_snapshot IS NOT NULL THEN RETURN; END IF;
 SELECT task_id INTO original_task FROM public.assistant_v2_task_runs WHERE run_id=b.start_run_id
   AND user_id=b.user_id AND company_id=b.company_id AND conversation_id=b.conversation_id;
 IF original_task IS NULL THEN RETURN; END IF; -- Task-context feature was off.
 SELECT * INTO t FROM public.assistant_v2_task_context WHERE conversation_id=b.conversation_id AND user_id=b.user_id AND company_id=b.company_id FOR SHARE;
 IF NOT FOUND OR t.task_id IS DISTINCT FROM original_task OR t.status='closed' OR t.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'workflow_task_changed' USING ERRCODE='23505'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_workflow_assert_task(public.assistant_v2_draft_briefs) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
