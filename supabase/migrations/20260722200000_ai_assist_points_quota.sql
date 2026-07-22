-- AI Assist points-based quota system
-- Adds per-plan point limits and per-company usage tracking for the AI Takeoff feature.
--
-- Point costs per scan: low=2, medium=4, high=8
-- Plan limits:
--   trial    = 20 (flat pool for 14-day trial, no monthly reset)
--   free     = NULL (blocked)
--   starter  = NULL (blocked)
--   growth   = 50 per month
--   pro      = 100 per month
--   pro_plus = 100 per month

-- ═══════════════════════════════════════════════════════════════════
-- 1. subscription_plans: add ai_assist_points_limit column
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS ai_assist_points_limit integer;

-- Set limits per plan code
UPDATE subscription_plans SET ai_assist_points_limit = 20  WHERE code = 'trial';
UPDATE subscription_plans SET ai_assist_points_limit = NULL WHERE code = 'free';
UPDATE subscription_plans SET ai_assist_points_limit = NULL WHERE code = 'starter';
UPDATE subscription_plans SET ai_assist_points_limit = 50  WHERE code = 'growth';
UPDATE subscription_plans SET ai_assist_points_limit = 100 WHERE code = 'pro';
UPDATE subscription_plans SET ai_assist_points_limit = 100 WHERE code = 'pro_plus';

-- ═══════════════════════════════════════════════════════════════════
-- 2. companies: add usage tracking columns
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS ai_assist_points_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_assist_points_reset_at timestamptz;

-- Initialise reset_at for existing companies to the start of the current month
-- (trial companies keep NULL = flat pool, no reset)
UPDATE companies
  SET ai_assist_points_reset_at = date_trunc('month', now())
  WHERE ai_assist_points_reset_at IS NULL
    AND subscription_status IN ('active', 'past_due', 'grace', 'cancellation_pending')
    AND plan_code IN ('growth', 'pro', 'pro_plus');

-- ═══════════════════════════════════════════════════════════════════
-- 3. RPC: check_and_deduct_ai_points
--    Atomically checks if the company has enough points and deducts.
--    Returns: { allowed: boolean, remaining: int, limit: int, error: text }
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_and_deduct_ai_points(
  p_company_id uuid,
  p_points_to_spend integer
) RETURNS table(allowed boolean, remaining integer, point_limit integer, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_plan text;
  v_point_limit integer;
  v_points_used integer;
  v_sub_status text;
  v_reset_at timestamptz;
  v_trial_ends_at timestamptz;
  v_current_period_end timestamptz;
BEGIN
  -- Get effective plan code (handles admin overrides, comp, etc.)
  SELECT public.company_effective_plan_code(p_company_id) INTO v_effective_plan;
  IF v_effective_plan IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 'Could not determine effective plan.'::text;
    RETURN;
  END IF;

  -- Get the point limit from the plan
  SELECT sp.ai_assist_points_limit INTO v_point_limit
  FROM subscription_plans sp
  WHERE sp.code = v_effective_plan;

  -- NULL limit = feature blocked for this tier
  IF v_point_limit IS NULL THEN
    RETURN QUERY SELECT false, 0, NULL, ('AI Assist is not available on the ' || v_effective_plan || ' plan. Upgrade to Growth or Pro to use AI Assist.')::text;
    RETURN;
  END IF;

  -- Get current usage + subscription context
  SELECT c.ai_assist_points_used, c.subscription_status, c.ai_assist_points_reset_at,
         c.trial_ends_at, c.current_period_end
  INTO v_points_used, v_sub_status, v_reset_at, v_trial_ends_at, v_current_period_end
  FROM companies c
  WHERE c.id = p_company_id;

  -- Monthly reset logic for paid plans (not trial)
  -- Trial: flat pool, no reset. When trial ends → plan collapses to 'free' which has NULL limit = blocked.
  IF v_effective_plan != 'trial' AND v_reset_at IS NOT NULL THEN
    -- Determine the period boundary: if current_period_end has passed, we should have already reset
    -- (webhook handles this), but also check calendar-month fallback
    IF v_current_period_end IS NOT NULL AND now() >= v_current_period_end THEN
      -- Period end passed — webhook should have reset, but belt-and-braces
      v_points_used := 0;
    ELSIF v_current_period_end IS NULL AND now() >= v_reset_at + interval '1 month' THEN
      -- No Stripe period (manual/comp) — calendar monthly reset
      v_points_used := 0;
    END IF;
  END IF;

  -- Check if user has enough points
  IF v_points_used + p_points_to_spend > v_point_limit THEN
    RETURN QUERY SELECT false, (v_point_limit - v_points_used), v_point_limit, 'Insufficient AI Assist points. You have used ' || v_points_used || ' of ' || v_point_limit || ' points. Points reset at the start of your next billing cycle.'::text;
    RETURN;
  END IF;

  -- Deduct points
  UPDATE companies
  SET ai_assist_points_used = v_points_used + p_points_to_spend
  WHERE id = p_company_id;

  RETURN QUERY SELECT true, (v_point_limit - v_points_used - p_points_to_spend), v_point_limit, NULL::text;
  RETURN;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. RPC: get_ai_assist_points_status
--    Returns current usage info without deducting. For UI display.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_ai_assist_points_status(
  p_company_id uuid
) RETURNS table(used integer, point_limit integer, remaining integer, is_blocked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_plan text;
  v_point_limit integer;
  v_points_used integer;
BEGIN
  SELECT public.company_effective_plan_code(p_company_id) INTO v_effective_plan;
  IF v_effective_plan IS NULL THEN
    RETURN QUERY SELECT 0, NULL, 0, true;
    RETURN;
  END IF;

  SELECT sp.ai_assist_points_limit INTO v_point_limit
  FROM subscription_plans sp
  WHERE sp.code = v_effective_plan;

  SELECT c.ai_assist_points_used INTO v_points_used
  FROM companies c
  WHERE c.id = p_company_id;

  IF v_point_limit IS NULL THEN
    RETURN QUERY SELECT 0, NULL, 0, true;
  ELSE
    RETURN QUERY SELECT v_points_used, v_point_limit, GREATEST(v_point_limit - v_points_used, 0), false;
  END IF;
  RETURN;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. RPC: reset_ai_assist_points
--    Called by Stripe webhook on invoice.paid to reset monthly usage.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reset_ai_assist_points(
  p_company_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE companies
  SET ai_assist_points_used = 0,
      ai_assist_points_reset_at = now()
  WHERE id = p_company_id;
END;
$$;
