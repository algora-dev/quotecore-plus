-- 2026-10-19 never-again job: fix qcp_p2_legacy_ai_points_status for NULL-limit plans.
--
-- Live defect (found by the billing-matrix smoke on testing 2026-10-20): legacy
-- companies whose effective plan has ai_assist_points_limit = NULL (starter,
-- free, business, enterprise, scaling) hit `RETURN QUERY SELECT 0, NULL, 0, true`
-- where the untyped NULL is resolved by PL/pgSQL as text, producing
--   ERROR 42804: structure of query does not match function result type
--   (Returned type text does not match expected type integer in column 2)
-- breaking get_ai_assist_points_status for every such legacy company since P2
-- (2026-10-10). Silent so far because entitlements.ts ignores this RPC's error
-- and the takeoff page wraps its direct call.
--
-- Fix: explicit ::integer casts on the NULL literals. Minimal diff from the
-- LIVE definition (pulled 2026-10-20 via pg_get_functiondef, never rewritten
-- from memory). The one paying legacy customer is on pro (limit 50) and uses
-- the typed-variable branch; nothing else changes for them.

CREATE OR REPLACE FUNCTION public.qcp_p2_legacy_ai_points_status(p_company_id uuid)
 RETURNS TABLE(used integer, point_limit integer, remaining integer, is_blocked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_effective_plan text;
  v_point_limit integer;
  v_points_used integer;
BEGIN
  SELECT public.company_effective_plan_code(p_company_id) INTO v_effective_plan;
  IF v_effective_plan IS NULL THEN
    RETURN QUERY SELECT 0::integer, NULL::integer, 0::integer, true;
    RETURN;
  END IF;

  SELECT sp.ai_assist_points_limit INTO v_point_limit
  FROM subscription_plans sp
  WHERE sp.code = v_effective_plan;

  SELECT c.ai_assist_points_used INTO v_points_used
  FROM companies c
  WHERE c.id = p_company_id;

  IF v_point_limit IS NULL THEN
    RETURN QUERY SELECT 0::integer, NULL::integer, 0::integer, true;
  ELSE
    RETURN QUERY SELECT v_points_used, v_point_limit, GREATEST(v_point_limit - v_points_used, 0), false;
  END IF;
  RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public.qcp_p2_legacy_ai_points_status(uuid) FROM PUBLIC, anon, authenticated, service_role;
