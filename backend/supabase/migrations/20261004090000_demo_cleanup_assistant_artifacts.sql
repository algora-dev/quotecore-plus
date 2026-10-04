-- Demo V2.2 — narrow Smart Assistant cleanup helper (Gavin-owned integration migration)
-- Contract per docs/demo-v2.2/DATABASE_GATES.md. Applied to the shared testing DB.
-- SECURITY DEFINER, service_role-only: removes ONLY a verified retired demo company's
-- assistant action journal + action log. No general audit-table DELETE grants.
CREATE OR REPLACE FUNCTION public.demo_cleanup_assistant_artifacts(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_plan text;
  v_actions bigint := 0;
  v_logs bigint := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_only' USING ERRCODE = '42501';
  END IF;
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_required' USING ERRCODE = '22023';
  END IF;

  SELECT c.plan_code INTO v_plan
    FROM public.companies c WHERE c.id = p_company_id FOR UPDATE;
  IF NOT FOUND OR v_plan IS DISTINCT FROM 'demo' THEN
    RAISE EXCEPTION 'verified_demo_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.demo_sessions ds
    WHERE ds.company_id = p_company_id
      AND ds.status IN ('cleanup_pending', 'cleanup_failed', 'expired', 'terminating', 'failed')
  ) OR EXISTS (
    SELECT 1 FROM public.demo_sessions ds
    WHERE ds.company_id = p_company_id
      AND ds.status IN ('active', 'provisioning')
      AND (ds.expires_at > clock_timestamp() OR ds.status = 'provisioning')
  ) THEN
    RAISE EXCEPTION 'retired_demo_required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.smart_assistant_runs r
    WHERE r.company_id = p_company_id AND r.status IN ('accepted', 'running')
      AND r.started_at > clock_timestamp() - interval '10 minutes'
  ) OR EXISTS (
    SELECT 1 FROM public.assistant_v2_actions a
    WHERE a.company_id = p_company_id AND a.status = 'applying'
      AND a.updated_at > clock_timestamp() - interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'assistant_operation_in_flight' USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.assistant_v2_actions WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_actions = ROW_COUNT;
  DELETE FROM public.sa_action_log WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_logs = ROW_COUNT;
  RETURN jsonb_build_object('actions_deleted', v_actions, 'logs_deleted', v_logs);
END;
$function$;

-- Least privilege: owner can delete from the two journals; no client role gains EXECUTE.
ALTER FUNCTION public.demo_cleanup_assistant_artifacts(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.demo_cleanup_assistant_artifacts(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_cleanup_assistant_artifacts(uuid) TO service_role;
