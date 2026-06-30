-- Admin User Management & Subscription Control
-- Date: 2026-06-30
-- Adds admin override columns, admin pause columns, admin_actions audit table,
-- and updates the effective-plan SQL functions to respect them.
-- All additive, no destructive changes.

-- ===========================================================================
-- 1. New columns on companies
-- ===========================================================================

-- Admin override (separate from plan_code so webhook can't break it)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_override_plan_code text REFERENCES subscription_plans(code);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_override_until timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_override_notes text;

-- Admin pause (separate from subscription_status so dunning cron doesn't conflict)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_paused boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_paused_at timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_paused_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_pause_reason text;

-- ===========================================================================
-- 2. admin_actions audit table
--    All FKs ON DELETE SET NULL so audit rows don't block account deletion.
--    Immutable snapshot fields survive deletion. No client INSERT policy —
--    service-role writes only.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  target_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  admin_email_snapshot text NOT NULL,
  target_user_email_snapshot text,
  target_company_name_snapshot text,
  action_type text NOT NULL,
  reason text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Admins can read audit rows. No INSERT policy — service-role client bypasses RLS.
DROP POLICY IF EXISTS admin_actions_admin_read ON admin_actions;
CREATE POLICY admin_actions_admin_read ON admin_actions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
  ));

-- ===========================================================================
-- 3. Updated SQL function: company_effective_plan_code()
--    Does NOT return 'free' when paused — returns underlying plan.
--    Access lock lives in _active. Override takes precedence when active.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN c.admin_override_plan_code
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN 'free'
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN c.plan_code
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN 'starter'
    ELSE 'starter'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;

-- ===========================================================================
-- 4. Updated SQL function: company_effective_plan_active()
--    admin_paused checked FIRST — returns false when paused, before anything.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.company_effective_plan_active(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN c.admin_paused = true
      THEN false
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN true
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN true
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN true
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN true
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN true
    ELSE false
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;
