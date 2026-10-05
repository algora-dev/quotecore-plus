-- patch_050: fix check_and_deduct_ai_points NULL-limit crash (42804).
-- The NULL-plan-limit branch returned an untyped NULL in the integer
-- point_limit column, which Postgres rejects with 42804. Starter/free
-- plans (NULL ai_assist_points_limit) therefore crashed with a 500
-- instead of a clean "not available on your plan" response.
-- Fix: explicit NULL::integer cast. No behavior change otherwise.

CREATE OR REPLACE FUNCTION public.check_and_deduct_ai_points(p_company_id uuid, p_points_to_spend integer)
 RETURNS TABLE(allowed boolean, remaining integer, point_limit integer, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_effective_plan text;
  v_point_limit integer;
  v_points_used integer;
  v_sub_status text;
  v_reset_at timestamptz;
  v_trial_ends_at timestamptz;
  v_current_period_end timestamptz;
BEGIN
  SELECT public.company_effective_plan_code(p_company_id) INTO v_effective_plan;
  IF v_effective_plan IS NULL THEN
    RETURN QUERY SELECT false, 0::integer, 0::integer, 'Could not determine effective plan.'::text;
    RETURN;
  END IF;

  SELECT sp.ai_assist_points_limit INTO v_point_limit
  FROM subscription_plans sp
  WHERE sp.code = v_effective_plan;

  IF v_point_limit IS NULL THEN
    RETURN QUERY SELECT false, 0::integer, NULL::integer, ('AI Assist is not available on the ' || v_effective_plan || ' plan. Upgrade to Growth or Pro to use AI Assist.')::text;
    RETURN;
  END IF;

  SELECT c.ai_assist_points_used, c.subscription_status, c.ai_assist_points_reset_at,
         c.trial_ends_at, c.current_period_end
  INTO v_points_used, v_sub_status, v_reset_at, v_trial_ends_at, v_current_period_end
  FROM companies c
  WHERE c.id = p_company_id;

  IF v_effective_plan != 'trial' AND v_reset_at IS NOT NULL THEN
    IF v_current_period_end IS NOT NULL AND now() >= v_current_period_end THEN
      v_points_used := 0;
    ELSIF v_current_period_end IS NULL AND now() >= v_reset_at + interval '1 month' THEN
      v_points_used := 0;
    END IF;
  END IF;

  IF v_points_used + p_points_to_spend > v_point_limit THEN
    RETURN QUERY SELECT false, (v_point_limit - v_points_used), v_point_limit, 'Insufficient AI Assist points. You have used ' || v_points_used || ' of ' || v_point_limit || ' points. Points reset at the start of your next billing cycle.'::text;
    RETURN;
  END IF;

  UPDATE companies
  SET ai_assist_points_used = v_points_used + p_points_to_spend
  WHERE id = p_company_id;

  RETURN QUERY SELECT true, (v_point_limit - v_points_used - p_points_to_spend), v_point_limit, NULL::text;
  RETURN;
END;
$function$;
