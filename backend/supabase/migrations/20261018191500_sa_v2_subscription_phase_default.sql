-- 2026-10-18: Smart Assistant V2 phases follow the subscription gate.
-- Root cause (owner report 15:09): sa_v2_runtime derived phases ONLY from the
-- manual per-company assistant_v2_rollout table (default off). Only RS Roofing
-- and QA fixtures had rows, so V2 could never render for a real paying customer
-- on any environment; testing only worked because RS Roofing was seeded during
-- QA. Together with SMART_ASSISTANT_V2_ENABLED being deployment-scoped (flip
-- requires redeploy), main rendered the legacy fallback launcher.
-- Fix (minimal diff from live definition): when no manual rollout row exists,
-- SA-entitled companies default to all phases on with the standard policies.
-- Existing rows stay authoritative (QA fixtures, per-company kill switch).

CREATE OR REPLACE FUNCTION public.sa_v2_runtime()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
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
    v_flags.enabled_at := clock_timestamp();
    v_flags.updated_at := clock_timestamp();
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
