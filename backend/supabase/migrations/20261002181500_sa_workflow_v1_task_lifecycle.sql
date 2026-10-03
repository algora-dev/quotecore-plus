-- Apply AFTER 20261002181000 and the existing task-context migration.
BEGIN;
ALTER FUNCTION public.sa_v2_task_close(uuid,uuid,integer,text) RENAME TO sa_v2_task_close_pre_controller_v1;
REVOKE ALL ON FUNCTION public.sa_v2_task_close_pre_controller_v1(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.sa_v2_task_close(p_conversation_id uuid,p_task_id uuid,p_version integer,p_closure text) RETURNS jsonb
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
   -- An already-confirmed uncertain/in-flight action keeps its recovery binding.
   IF EXISTS(SELECT 1 FROM public.assistant_v2_actions a WHERE a.user_id=b.user_id AND a.company_id=b.company_id AND a.payload->>'briefStateId'=b.id::text AND a.status IN ('applying','needs_review')) THEN CONTINUE; END IF;
   PERFORM public.sa_v2_workflow_expire_proposal(b.id);
   UPDATE public.assistant_v2_draft_briefs SET workflow_state='closed',status='closed',updated_at=clock_timestamp() WHERE id=b.id;
 END LOOP;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_task_close(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_task_close(uuid,uuid,integer,text) TO authenticated;

ALTER FUNCTION public.sa_v2_action_cancel(uuid,text,integer) RENAME TO sa_v2_action_cancel_pre_controller_v1;
REVOKE ALL ON FUNCTION public.sa_v2_action_cancel_pre_controller_v1(uuid,text,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.sa_v2_action_cancel(p_action_id uuid,p_digest text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb; a public.assistant_v2_actions%rowtype;
BEGIN
 IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'authenticated_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sa-workflow:'||auth.uid()::text,0));
 result:=public.sa_v2_action_cancel_pre_controller_v1(p_action_id,p_digest,p_version);
 SELECT * INTO a FROM public.assistant_v2_actions WHERE id=p_action_id AND user_id=auth.uid() FOR UPDATE;
 IF FOUND AND a.status='cancelled' AND a.payload->>'controllerVersion'='1' THEN
   UPDATE public.assistant_v2_draft_briefs SET workflow_state='collecting',status='open',action_id=NULL,updated_at=clock_timestamp()
   WHERE id=(a.payload->>'briefStateId')::uuid AND company_id=a.company_id AND user_id=a.user_id AND action_id=a.id AND workflow_state='proposal_pending_confirmation';
 END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.sa_v2_action_cancel(uuid,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_action_cancel(uuid,text,integer) TO authenticated;
COMMIT;
