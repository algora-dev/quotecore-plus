-- P1.7.3 DRAFT / NOT APPLIED. Release-hardening only.
-- Preserve the existing owner/RLS-scoped session reader and expose the canonical
-- run error code so setup failures can be rendered honestly instead of as a
-- generic assistant error. No business data, permissions or write authority is
-- added here.
BEGIN;

ALTER FUNCTION public.sa_v2_session_read(uuid) RENAME TO sa_v2_session_read_p173_base;
REVOKE ALL ON FUNCTION public.sa_v2_session_read_p173_base(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.sa_v2_session_read(p_conversation_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  base jsonb:=public.sa_v2_session_read_p173_base(p_conversation_id);
  v jsonb:=public.sa_v2_runtime();
  recent_runs jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.started_at),'[]'::jsonb) INTO recent_runs FROM (
    SELECT r.id,r.client_request_id,r.status,r.error_code,r.started_at
    FROM public.smart_assistant_runs r
    WHERE r.conversation_id=p_conversation_id
      AND r.user_id=auth.uid()
      AND r.company_id=(v->>'company_id')::uuid
      AND r.started_at >= (v->>'history_after')::timestamptz
    ORDER BY r.started_at DESC
    LIMIT 20
  ) x;
  RETURN base||jsonb_build_object('recent_runs',recent_runs);
END;
$$;
REVOKE ALL ON FUNCTION public.sa_v2_session_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sa_v2_session_read(uuid) TO authenticated;

COMMIT;
