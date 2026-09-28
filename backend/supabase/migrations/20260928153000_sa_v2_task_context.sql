-- P1.7.2 SQL DRAFT. NOT APPLIED. Requires accepted P0..P1.7.1 migrations.
-- Assistant metadata only. No business tables, quota RPCs or existing functions
-- are replaced. Enable TASK_CONTEXT only after the acceptance gates pass.
BEGIN;
CREATE TABLE public.assistant_v2_task_context (
 conversation_id uuid PRIMARY KEY REFERENCES public.smart_assistant_conversations(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 task_id uuid NOT NULL DEFAULT gen_random_uuid(),
 version integer NOT NULL CHECK(version>0),
 permission_revision integer NOT NULL CHECK(permission_revision>=0),
 knowledge_revision bigint NOT NULL CHECK(knowledge_revision>=0),
 status text NOT NULL CHECK(status IN ('open','awaiting_input','answered','closed')),
 label text NOT NULL CHECK(length(label)<=200 AND label !~ '[[:cntrl:]]'),
 last_run_id uuid NOT NULL REFERENCES public.smart_assistant_runs(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '15 minutes'),
 closure text CHECK(closure IN ('solved','abandoned','superseded')),
 pending_message text CHECK(pending_message IS NULL OR length(pending_message) BETWEEN 1 AND 16000)
);
CREATE TABLE public.assistant_v2_task_runs (
 run_id uuid PRIMARY KEY REFERENCES public.smart_assistant_runs(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES public.smart_assistant_conversations(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 task_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 permission_revision integer NOT NULL,
 disposition text NOT NULL CHECK(disposition IN ('new','continue','correct','close','ask_boundary')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 80 AND reason ~ '^[a-z_]+$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX assistant_v2_task_runs_scope ON public.assistant_v2_task_runs(conversation_id,task_id,created_at DESC);
ALTER TABLE public.assistant_v2_task_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_v2_task_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_v2_task_context,public.assistant_v2_task_runs FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON TABLE public.assistant_v2_task_context IS 'One current dialogue checkpoint per owned conversation. No prices, entity snapshots or mutation authority. Closing does not finish/cancel a run or approve an action.';
COMMENT ON TABLE public.assistant_v2_task_runs IS 'Immutable task boundary for each admitted execution; enables context filtering without modifying transcript, history limit, replay or run finalisation.';

-- Private projection. Callers cannot select the underlying metadata tables.
CREATE FUNCTION public.sa_v2_task_view(t public.assistant_v2_task_context) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('id',t.task_id,'version',t.version,'status',t.status,'label',t.label,
 'lastRunId',t.last_run_id,'startedAt',t.started_at,'updatedAt',t.updated_at,'expiresAt',t.expires_at,
 'closure',t.closure,'boundary',t.pending_message IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.sa_v2_task_view(public.assistant_v2_task_context) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sa_v2_task_snapshot(p_conversation_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime(); t public.assistant_v2_task_context%ROWTYPE;
BEGIN
 IF NOT COALESCE((v->'phases'->>'p1')::boolean,false) OR NOT EXISTS(
  SELECT 1 FROM public.smart_assistant_conversations c WHERE c.id=p_conversation_id
   AND c.user_id=auth.uid() AND c.company_id=(v->>'company_id')::uuid)
 THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.assistant_v2_task_context x WHERE x.conversation_id=p_conversation_id
  AND x.user_id=auth.uid() AND x.company_id=(v->>'company_id')::uuid
  AND x.permission_revision=(v->>'permission_revision')::integer
  AND x.knowledge_revision=(SELECT f.knowledge_revision FROM public.assistant_v2_retrieval_rollout f WHERE f.company_id=x.company_id)
  AND x.updated_at>=GREATEST(COALESCE((v->>'history_after')::timestamptz,'-infinity'::timestamptz),
   COALESCE((SELECT f.updated_at FROM public.assistant_v2_retrieval_rollout f WHERE f.company_id=x.company_id),'-infinity'::timestamptz));
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN public.sa_v2_task_view(t);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_task_snapshot(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_task_snapshot(uuid) TO authenticated;

-- Read the previous checkpoint for a CURRENT admitted run. This does not attach
-- that checkpoint to the run: the shared router must explicitly choose a task.
CREATE FUNCTION public.sa_v2_task_read(p_run_id uuid,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_retrieval_scope(p_run_id,p_revision); r public.smart_assistant_runs%ROWTYPE;
 t public.assistant_v2_task_context%ROWTYPE; resolution jsonb; ids jsonb;
BEGIN
 IF NOT COALESCE((v->>'retrieval_enabled')::boolean,false) THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=auth.uid() AND company_id=(v->>'company_id')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.assistant_v2_task_context x WHERE x.conversation_id=r.conversation_id
 AND x.user_id=r.user_id AND x.company_id=r.company_id AND x.permission_revision=p_revision
 AND x.knowledge_revision=(v->>'knowledge_revision')::bigint
 AND x.updated_at>=GREATEST(COALESCE((v->>'history_after')::timestamptz,'-infinity'::timestamptz),COALESCE((v->>'knowledge_history_after')::timestamptz,'-infinity'::timestamptz));
 IF NOT FOUND THEN RETURN jsonb_build_object('task',NULL,'resolution',NULL,'runIds','[]'::jsonb,'pendingMessage',NULL); END IF;
 SELECT COALESCE(jsonb_agg(x.run_id),'[]'::jsonb) INTO ids FROM (
 SELECT b.run_id FROM public.assistant_v2_task_runs b JOIN public.smart_assistant_runs br ON br.id=b.run_id
 WHERE b.task_id=t.task_id AND b.conversation_id=t.conversation_id AND b.company_id=r.company_id AND b.user_id=r.user_id
 AND b.permission_revision=p_revision AND br.status='completed' AND br.started_at<=r.started_at AND b.run_id<>r.id
 ORDER BY b.created_at DESC,b.run_id DESC LIMIT 100) x;
 IF t.status<>'closed' AND t.expires_at>CURRENT_TIMESTAMP THEN
  SELECT jsonb_build_object('id',s.id,'expires_at',s.expires_at,'state',s.state) INTO resolution
  FROM public.assistant_v2_resolution_states s JOIN public.assistant_v2_task_runs b ON b.run_id=s.run_id
   JOIN public.smart_assistant_runs br ON br.id=s.run_id
  WHERE b.task_id=t.task_id AND b.conversation_id=t.conversation_id AND b.company_id=r.company_id AND b.user_id=r.user_id
   AND s.company_id=r.company_id AND s.user_id=r.user_id AND s.conversation_id=r.conversation_id
   AND s.permission_revision=p_revision AND b.permission_revision=p_revision AND s.expires_at>CURRENT_TIMESTAMP
   AND br.status='completed' AND br.started_at<=r.started_at AND br.id<>r.id
   AND s.created_at>=GREATEST(COALESCE((v->>'history_after')::timestamptz,'-infinity'::timestamptz),COALESCE((v->>'knowledge_history_after')::timestamptz,'-infinity'::timestamptz))
   AND NOT EXISTS(SELECT 1 FROM unnest(s.sections) sec WHERE COALESCE(v->'permissions'->>sec,'hidden')='hidden')
  ORDER BY br.started_at DESC,br.id DESC LIMIT 1;
 END IF;
 RETURN jsonb_build_object('task',public.sa_v2_task_view(t),'resolution',resolution,'runIds',ids,
  'pendingMessage',CASE WHEN t.status<>'closed' AND t.expires_at>CURRENT_TIMESTAMP THEN t.pending_message ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_task_read(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_task_read(uuid,integer) TO authenticated;

-- Shared private trusted-run check. This helper can touch ONLY assistant metadata.
CREATE FUNCTION public.sa_v2_task_trusted_run(p_run_id uuid,p_user_id uuid,p_revision integer,p_knowledge_revision text) RETURNS public.smart_assistant_runs
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r public.smart_assistant_runs%ROWTYPE; actual_revision integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'trusted_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=p_user_id;
 IF NOT FOUND OR r.status NOT IN ('accepted','running')
 OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.company_id=r.company_id)
 OR NOT EXISTS(SELECT 1 FROM public.smart_assistant_conversations c WHERE c.id=r.conversation_id AND c.user_id=p_user_id AND c.company_id=r.company_id)
 OR NOT COALESCE(public.smart_assistant_enabled(r.company_id),false)
 OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_rollout f WHERE f.company_id=r.company_id AND f.p1)
 OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_retrieval_rollout f WHERE f.company_id=r.company_id AND f.enabled AND f.knowledge_revision::text=p_knowledge_revision)
 OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_run_scopes sc WHERE sc.run_id=r.id AND sc.user_id=p_user_id AND sc.company_id=r.company_id AND sc.permission_revision=p_revision)
 THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT COALESCE((SELECT p.revision FROM public.assistant_section_permissions p WHERE p.company_id=r.company_id),0) INTO actual_revision;
 IF actual_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_task_trusted_run(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sa_v2_task_begin(p_run_id uuid,p_user_id uuid,p_revision integer,p_knowledge_revision text,p_expected_task uuid,p_expected_version integer,
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
  CASE WHEN have AND id=t.task_id THEN t.started_at ELSE clock_timestamp() END,clock_timestamp(),clock_timestamp()+interval '15 minutes',p_closure,p_pending_message)
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

CREATE FUNCTION public.sa_v2_task_finish(p_run_id uuid,p_user_id uuid,p_revision integer,p_knowledge_revision text,p_status text,p_label text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r public.smart_assistant_runs%ROWTYPE; t public.assistant_v2_task_context%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.sa_v2_task_trusted_run(p_run_id,p_user_id,p_revision,p_knowledge_revision);
 IF p_status IS NULL OR p_status NOT IN ('open','awaiting_input','answered') OR p_label IS NULL OR length(p_label)>200 OR p_label ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_task' USING ERRCODE='22023'; END IF;
 SELECT * INTO t FROM public.assistant_v2_task_context WHERE conversation_id=r.conversation_id AND company_id=r.company_id AND user_id=r.user_id FOR UPDATE;
 IF NOT FOUND OR t.last_run_id<>r.id OR t.permission_revision<>p_revision OR t.knowledge_revision::text<>p_knowledge_revision
  OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_task_runs b WHERE b.run_id=r.id AND b.task_id=t.task_id AND b.version=t.version AND b.company_id=r.company_id AND b.user_id=r.user_id)
 THEN RAISE EXCEPTION 'task_changed' USING ERRCODE='P1721'; END IF;
 IF t.status<>'closed' AND t.pending_message IS NULL THEN
  UPDATE public.assistant_v2_task_context SET status=p_status,label=p_label WHERE conversation_id=r.conversation_id RETURNING * INTO t;
 END IF;
 RETURN public.sa_v2_task_view(t);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_task_finish(uuid,uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_task_finish(uuid,uuid,integer,text,text,text) TO service_role;

-- Authenticated metadata-only Done/Move on. No admitted turn/model/business read.
-- Refuse closure while ANY admitted outcome is unresolved. Never pretend that
-- closing a task cancelled a run or invalidated/approved a P3 proposal.
CREATE FUNCTION public.sa_v2_task_close(p_conversation_id uuid,p_task_id uuid,p_version integer,p_closure text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_runtime(); t public.assistant_v2_task_context%ROWTYPE;
BEGIN
 IF p_closure IS NULL OR p_closure NOT IN ('solved','abandoned') OR NOT COALESCE((v->'phases'->>'p1')::boolean,false) THEN RAISE EXCEPTION 'invalid_task' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.smart_assistant_conversations c WHERE c.id=p_conversation_id AND c.user_id=auth.uid() AND c.company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.assistant_v2_task_context WHERE conversation_id=p_conversation_id AND user_id=auth.uid() AND company_id=(v->>'company_id')::uuid FOR UPDATE;
 IF NOT FOUND OR t.task_id IS DISTINCT FROM p_task_id OR t.permission_revision IS DISTINCT FROM (v->>'permission_revision')::integer
 OR t.knowledge_revision IS DISTINCT FROM (SELECT f.knowledge_revision FROM public.assistant_v2_retrieval_rollout f WHERE f.company_id=t.company_id)
 OR t.updated_at<GREATEST(COALESCE((v->>'history_after')::timestamptz,'-infinity'::timestamptz),COALESCE((SELECT f.updated_at FROM public.assistant_v2_retrieval_rollout f WHERE f.company_id=t.company_id),'-infinity'::timestamptz)) THEN RAISE EXCEPTION 'task_changed' USING ERRCODE='P1721'; END IF;
 IF EXISTS(SELECT 1 FROM public.smart_assistant_runs r WHERE r.conversation_id=p_conversation_id AND r.status IN ('accepted','running')) THEN RAISE EXCEPTION 'run_in_progress' USING ERRCODE='P1722'; END IF;
 IF t.status='closed' AND t.version=p_version+1 THEN RETURN public.sa_v2_task_view(t); END IF;
 IF t.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'task_changed' USING ERRCODE='P1721'; END IF;
 UPDATE public.assistant_v2_task_context SET status='closed',version=version+1,closure=p_closure,pending_message=NULL,updated_at=clock_timestamp()
 WHERE conversation_id=p_conversation_id RETURNING * INTO t;
 RETURN public.sa_v2_task_view(t);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_task_close(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_task_close(uuid,uuid,integer,text) TO authenticated;

-- Latest resolution IN THE CURRENT TASK, not simply the previous conversation
-- run. This survives a boundary question but cannot resurrect a closed task.
CREATE FUNCTION public.sa_v2_resolution_read_v172(p_run_id uuid,p_revision integer,p_state_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb:=public.sa_v2_retrieval_scope(p_run_id,p_revision); r public.smart_assistant_runs%ROWTYPE;
 t public.assistant_v2_task_context%ROWTYPE; saved public.assistant_v2_resolution_states%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.smart_assistant_runs WHERE id=p_run_id AND user_id=auth.uid() AND company_id=(v->>'company_id')::uuid;
 IF NOT FOUND OR NOT COALESCE((v->>'retrieval_enabled')::boolean,false) THEN RAISE EXCEPTION 'access_changed' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.assistant_v2_task_context WHERE conversation_id=r.conversation_id AND user_id=r.user_id AND company_id=r.company_id AND permission_revision=p_revision AND knowledge_revision=(v->>'knowledge_revision')::bigint;
 IF NOT FOUND OR t.status='closed' OR t.expires_at<=CURRENT_TIMESTAMP OR t.last_run_id<>r.id
 OR NOT EXISTS(SELECT 1 FROM public.assistant_v2_task_runs b WHERE b.run_id=r.id AND b.task_id=t.task_id AND b.version=t.version AND b.company_id=r.company_id AND b.user_id=r.user_id)
 THEN RETURN NULL; END IF;
 SELECT s.* INTO saved FROM public.assistant_v2_resolution_states s
 JOIN public.assistant_v2_task_runs b ON b.run_id=s.run_id JOIN public.smart_assistant_runs br ON br.id=s.run_id
 WHERE b.task_id=t.task_id AND b.conversation_id=r.conversation_id AND b.company_id=r.company_id AND b.user_id=r.user_id
  AND b.permission_revision=p_revision AND s.company_id=r.company_id AND s.user_id=r.user_id AND s.conversation_id=r.conversation_id
  AND s.permission_revision=p_revision AND s.expires_at>CURRENT_TIMESTAMP AND br.status='completed' AND br.started_at<=r.started_at AND br.id<>r.id
  AND s.created_at>=GREATEST(COALESCE((v->>'history_after')::timestamptz,'-infinity'::timestamptz),COALESCE((v->>'knowledge_history_after')::timestamptz,'-infinity'::timestamptz))
  AND NOT EXISTS(SELECT 1 FROM unnest(s.sections) sec WHERE COALESCE(v->'permissions'->>sec,'hidden')='hidden')
 ORDER BY br.started_at DESC,br.id DESC LIMIT 1;
 IF NOT FOUND OR (p_state_id IS NOT NULL AND saved.id<>p_state_id) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',saved.id,'expires_at',saved.expires_at,'state',saved.state);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_resolution_read_v172(uuid,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sa_v2_resolution_read_v172(uuid,integer,uuid) TO authenticated;
COMMIT;
