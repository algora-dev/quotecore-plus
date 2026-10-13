-- Smart Assistant V1.1 continuity patch (2026-10-13).
--
-- Goals:
-- 1) tradespeople can resume a live conversational task after an on-site pause;
-- 2) resolver clarification state survives the same pause without becoming write authority;
-- 3) marking a task solved does not destroy a confirmed, quote-bound working brief;
-- 4) proposal/action confirmation semantics are unchanged.
--
-- This migration extends only assistant metadata TTLs. It does NOT extend action
-- proposal proof/confirmation authority, and all business records are still reread
-- under current access before values are exposed or mutations are proposed/applied.
BEGIN;

ALTER TABLE public.assistant_v2_task_context
  ALTER COLUMN expires_at SET DEFAULT (clock_timestamp()+interval '3 hours');
ALTER TABLE public.assistant_v2_resolution_states
  ALTER COLUMN expires_at SET DEFAULT (clock_timestamp()+interval '3 hours');

-- Extend only metadata that is still live at deployment time. Do not resurrect
-- an already-expired task/resolution state.
UPDATE public.assistant_v2_task_context
SET expires_at=GREATEST(expires_at,updated_at+interval '3 hours')
WHERE status<>'closed' AND expires_at>clock_timestamp();
UPDATE public.assistant_v2_resolution_states
SET expires_at=GREATEST(expires_at,created_at+interval '3 hours')
WHERE expires_at>clock_timestamp();

-- sa_v2_task_begin explicitly stamps the task expiry, so changing the table
-- default alone is insufficient. Preserve all validation/locking semantics and
-- change only the TTL from 15 minutes to 3 hours.
CREATE OR REPLACE FUNCTION public.sa_v2_task_begin(p_run_id uuid,p_user_id uuid,p_revision integer,p_knowledge_revision text,p_expected_task uuid,p_expected_version integer,
 p_disposition text,p_reason text,p_label text,p_pending_message text,p_closure text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r public.smart_assistant_runs%ROWTYPE;
 t public.assistant_v2_task_context%ROWTYPE; b public.assistant_v2_task_runs%ROWTYPE; have boolean; id uuid; n integer;
BEGIN
 SELECT * INTO r FROM public.sa_v2_task_trusted_run(p_run_id,p_user_id,p_revision,p_knowledge_revision);
 IF p_disposition IS NULL OR p_disposition NOT IN ('new','continue','correct','close','ask_boundary')
 OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 80 OR p_reason !~ '^[a-z_]+$'
 OR p_label IS NULL OR length(p_label)>200 OR p_label ~ '[[:cntrl:]]'
 OR (p_disposition='ask_boundary' AND (p_pending_message IS NULL OR length(p_pending_message) NOT BETWEEN 1 AND 16000))
 OR (p_disposition<>'ask_boundary' AND p_pending_message IS NOT NULL)
 OR (p_disposition='close' AND (p_closure IS NULL OR p_closure NOT IN ('solved','abandoned')))
 OR (p_disposition<>'close' AND p_closure IS NOT NULL)
 THEN RAISE EXCEPTION 'invalid_task' USING ERRCODE='22023'; END IF;
 -- Locks only this conversation checkpoint, never pricing/quota/config rows.
 PERFORM 1 FROM public.smart_assistant_conversations c WHERE c.id=r.conversation_id AND c.user_id=p_user_id AND c.company_id=r.company_id FOR UPDATE;
 SELECT * INTO t FROM public.assistant_v2_task_context WHERE conversation_id=r.conversation_id FOR UPDATE; have:=FOUND;
 SELECT * INTO b FROM public.assistant_v2_task_runs WHERE run_id=r.id;
 IF FOUND THEN
  IF NOT have OR b.task_id<>t.task_id OR b.version<>t.version OR t.last_run_id<>r.id THEN RAISE EXCEPTION 'task_changed' USING ERRCODE='P1721'; END IF;
  RETURN public.sa_v2_task_view(t);
 END IF;
 IF EXISTS(SELECT 1 FROM public.smart_assistant_runs other WHERE other.conversation_id=r.conversation_id AND other.id<>r.id AND other.status IN ('accepted','running'))
 THEN RAISE EXCEPTION 'run_in_progress' USING ERRCODE='P1722'; END IF;
 IF have AND (t.user_id<>r.user_id OR t.company_id<>r.company_id) THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 IF have AND t.permission_revision=p_revision AND t.knowledge_revision::text=p_knowledge_revision THEN
  IF (p_expected_task IS DISTINCT FROM t.task_id OR p_expected_version IS DISTINCT FROM t.version)
    AND NOT (p_expected_task IS NULL AND p_expected_version IS NULL AND p_disposition IN ('new','close'))
  THEN RAISE EXCEPTION 'task_changed' USING ERRCODE='P1721'; END IF;
  -- A trusted fresh request may replace a checkpoint hidden by a new history
  -- epoch. Missing authority can NEVER continue/correct an old task.
 ELSIF p_expected_task IS NOT NULL OR p_expected_version IS NOT NULL THEN RAISE EXCEPTION 'task_changed' USING ERRCODE='P1721';
 END IF;
 IF p_disposition IN ('continue','correct','ask_boundary') AND (NOT have OR t.status='closed' OR t.permission_revision<>p_revision OR t.knowledge_revision::text<>p_knowledge_revision OR t.expires_at<=CURRENT_TIMESTAMP)
 THEN RAISE EXCEPTION 'task_changed' USING ERRCODE='P1721'; END IF;
 id:=CASE WHEN p_disposition='new' OR NOT have OR t.permission_revision<>p_revision OR t.knowledge_revision::text<>p_knowledge_revision THEN gen_random_uuid() ELSE t.task_id END;
 n:=COALESCE(t.version,0)+1;
 INSERT INTO public.assistant_v2_task_context(conversation_id,company_id,user_id,task_id,version,permission_revision,knowledge_revision,status,label,last_run_id,started_at,updated_at,expires_at,closure,pending_message)
 VALUES(r.conversation_id,r.company_id,r.user_id,id,n,p_revision,p_knowledge_revision::bigint,
  CASE WHEN p_disposition='close' THEN 'closed' WHEN p_disposition='ask_boundary' THEN 'awaiting_input' ELSE 'open' END,p_label,r.id,
  CASE WHEN have AND id=t.task_id THEN t.started_at ELSE clock_timestamp() END,clock_timestamp(),clock_timestamp()+interval '3 hours',p_closure,p_pending_message)
 ON CONFLICT(conversation_id) DO UPDATE SET task_id=EXCLUDED.task_id,version=EXCLUDED.version,permission_revision=EXCLUDED.permission_revision,knowledge_revision=EXCLUDED.knowledge_revision,
  status=EXCLUDED.status,label=EXCLUDED.label,last_run_id=EXCLUDED.last_run_id,started_at=EXCLUDED.started_at,updated_at=EXCLUDED.updated_at,
  expires_at=EXCLUDED.expires_at,closure=EXCLUDED.closure,pending_message=EXCLUDED.pending_message;
 INSERT INTO public.assistant_v2_task_runs(run_id,conversation_id,company_id,user_id,task_id,version,permission_revision,disposition,reason)
 VALUES(r.id,r.conversation_id,r.company_id,r.user_id,id,n,p_revision,p_disposition,p_reason);
 SELECT * INTO t FROM public.assistant_v2_task_context WHERE conversation_id=r.conversation_id;
 RETURN public.sa_v2_task_view(t);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_task_begin(uuid,uuid,integer,text,uuid,integer,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_task_begin(uuid,uuid,integer,text,uuid,integer,text,text,text,text,text) TO service_role;

-- Task closure remains metadata-only and still expires pending proposals. A
-- confirmed, quote-bound brief is preserved so a later task can safely revise
-- the same draft using its committed snapshot checks. This aligns task-close
-- behavior with 20261012220000_sa_workflow_reopen_committed.sql.
CREATE OR REPLACE FUNCTION public.sa_v2_task_close(p_conversation_id uuid,p_task_id uuid,p_version integer,p_closure text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb; b public.assistant_v2_draft_briefs%rowtype;
BEGIN
 IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'authenticated_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||auth.uid()::text,0));
 result:=public.sa_v2_task_close_pre_controller_v1(p_conversation_id,p_task_id,p_version,p_closure);
 FOR b IN SELECT * FROM public.assistant_v2_draft_briefs WHERE conversation_id=p_conversation_id AND user_id=auth.uid()
   AND workflow_state NOT IN ('closed','cancelled') FOR UPDATE
 LOOP
   -- A task-control click never approves, undoes or retries a business write.
   IF EXISTS(SELECT 1 FROM public.assistant_v2_actions a WHERE a.user_id=b.user_id AND a.company_id=b.company_id AND a.payload->>'briefStateId'=b.id::text AND a.status IN ('applying','needs_review')) THEN CONTINUE; END IF;
   -- A committed quote-bound brief is recent revisable context, not pending
   -- authority. Keep it; revise/confirm will recheck the committed snapshot.
   IF b.workflow_state='committed' AND b.produced_quote_id IS NOT NULL AND b.committed_snapshot IS NOT NULL THEN CONTINUE; END IF;
   PERFORM public.sa_v2_workflow_expire_proposal(b.id);
   UPDATE public.assistant_v2_draft_briefs SET workflow_state='closed',status='closed',updated_at=clock_timestamp() WHERE id=b.id;
 END LOOP;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_task_close(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_task_close(uuid,uuid,integer,text) TO authenticated;

COMMIT;
