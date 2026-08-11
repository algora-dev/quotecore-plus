-- =====================================================================
-- Active Smart Components - global active allowance model
-- =====================================================================
-- Replaces the hard creation cap with an "active component" model:
--   * Companies can store and edit unlimited Smart Components.
--   * Only `is_active = true` non-system components consume the allowance.
--   * The allowance is global to the company, not per library.
--   * Creation never fails solely because the active allowance is full;
--     at-cap inserts land as inactive instead.
--   * Activation over cap is rejected atomically (P0010).
--   * Downgrades deactivate overflow deterministically (no data loss).
--
-- This migration is additive/nullable only. No destructive schema changes.
-- Idempotent: safe to re-run.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Update component_limit values per tier
-- ---------------------------------------------------------------------
UPDATE public.subscription_plans SET component_limit = 10  WHERE code = 'trial';
UPDATE public.subscription_plans SET component_limit = 5   WHERE code = 'free';
UPDATE public.subscription_plans SET component_limit = 20  WHERE code = 'starter';
UPDATE public.subscription_plans SET component_limit = 50  WHERE code = 'pro';
UPDATE public.subscription_plans SET component_limit = 200 WHERE code = 'pro_plus';

COMMENT ON COLUMN public.subscription_plans.component_limit IS
  'Maximum active non-system Smart Components for the company. NULL = unlimited. Enforced via require_component_slot() at insert/reactivation time. Inactive components do not count.';

-- ---------------------------------------------------------------------
-- 2. Fix company_effective_plan_code: expired trials collapse to 'free',
--    not 'starter'. The cron persists plan_code='free' but until it runs
--    the SQL function must also resolve correctly.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT CASE
    -- Admin comp override beats everything until comp_until.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    -- Trial expired with no Stripe subscription: collapses to free.
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN 'free'
    -- Healthy states (active / trialing / past_due, plus disputed-with-
    -- ticket-open per section 9.6) keep their purchased plan.
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN c.plan_code
    -- Grace / pending_data_purge / cancellation_pending: collapse to free
    -- (read-only on gated features; existing data still viewable).
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN 'free'
    -- Suspended / canceled: fully locked elsewhere via _active = false.
    ELSE 'free'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

COMMENT ON FUNCTION public.company_effective_plan_code IS
  'Returns the plan code the company can actually use TODAY. Collapses to free on expired trial / grace / purge / cancellation / suspended. plan_code itself is never modified by these transitions.';

-- ---------------------------------------------------------------------
-- 3. Update company_component_count: exclude system rows
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.company_component_count(p_company_id uuid)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.component_library
   WHERE company_id = p_company_id
     AND is_active  = true
     AND is_system  = false;
$$;

COMMENT ON FUNCTION public.company_component_count IS
  'Count of active non-system Smart Components for tier-cap enforcement. Inactive and system rows are excluded.';

-- ---------------------------------------------------------------------
-- 4. Replace insert trigger: allow creation at cap, land as inactive
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_enforce_component_cap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- System rows never consume allowance.
  IF NEW.is_system IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Inactive inserts are always allowed (they don't consume a slot).
  IF NEW.is_active IS NOT DISTINCT FROM FALSE THEN
    RETURN NEW;
  END IF;

  -- Active insert: check subscription + cap.
  BEGIN
    PERFORM public.require_component_slot(NEW.company_id);
  EXCEPTION
    WHEN SQLSTATE 'P0010' THEN
      -- At cap: allow the insert but force inactive.
      NEW.is_active := false;
      RETURN NEW;
    WHEN OTHERS THEN
      -- Re-raise subscription_inactive, feature errors, etc.
      RAISE;
  END;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_enforce_component_cap() FROM PUBLIC, anon, authenticated;

-- Trigger already exists from migration 20260519100200; DROP + CREATE to pick up new body.
DROP TRIGGER IF EXISTS component_library_enforce_cap ON public.component_library;
CREATE TRIGGER component_library_enforce_cap
  BEFORE INSERT ON public.component_library
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_component_cap();

-- ---------------------------------------------------------------------
-- 5. Keep the reactivation trigger (false -> true) as the hard boundary.
--    This is the key enforcement point for activation via PostgREST updates.
--    Update to exclude system rows.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_enforce_component_cap_reactivate()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- System rows bypass the cap.
  IF NEW.is_system IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active IS TRUE AND (OLD.is_active IS DISTINCT FROM TRUE) THEN
    PERFORM public.require_component_slot(NEW.company_id);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_enforce_component_cap_reactivate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS component_library_enforce_cap_reactivate ON public.component_library;
CREATE TRIGGER component_library_enforce_cap_reactivate
  BEFORE UPDATE OF is_active ON public.component_library
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_component_cap_reactivate();

-- ---------------------------------------------------------------------
-- 6. Reconcile function: deactivate overflow on downgrade
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_company_component_limit(p_company_id uuid)
  RETURNS TABLE(deactivated_count integer)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_code  text;
  v_active_count integer;
  v_overflow integer;
BEGIN
  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.component_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  -- NULL = unlimited, nothing to do.
  IF v_limit IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  SELECT COUNT(*)::integer
    INTO v_active_count
    FROM public.component_library
   WHERE company_id = p_company_id
     AND is_active  = true
     AND is_system  = false;

  IF v_active_count <= v_limit THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  v_overflow := v_active_count - v_limit;

  -- Deactivate the most recently created overflow rows.
  -- Deterministic ordering: created_at DESC, id DESC (newest first = deactivate last added).
  UPDATE public.component_library
     SET is_active = false
   WHERE id IN (
     SELECT id
       FROM public.component_library
      WHERE company_id = p_company_id
        AND is_active  = true
        AND is_system  = false
      ORDER BY created_at DESC, id DESC
      LIMIT v_overflow
   );

  RETURN QUERY SELECT v_overflow;
END $$;

COMMENT ON FUNCTION public.reconcile_company_component_limit IS
  'Idempotent: deactivates overflow active non-system components beyond the company plan limit. Keeps oldest active, deactivates newest overflow. Returns count deactivated. No-op for unlimited plans or companies already within limit.';

GRANT EXECUTE ON FUNCTION public.reconcile_company_component_limit(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 7. Reconcile all existing companies that may be over-cap after limit changes
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT DISTINCT company_id
      FROM public.component_library
     WHERE is_active = true
       AND is_system = false
  LOOP
    PERFORM public.reconcile_company_component_limit(c.company_id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 8. Partial index for active non-system component queries
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS component_library_active_nonsystem_idx
  ON public.component_library (company_id)
  WHERE is_active = true AND is_system = false;

COMMIT;
