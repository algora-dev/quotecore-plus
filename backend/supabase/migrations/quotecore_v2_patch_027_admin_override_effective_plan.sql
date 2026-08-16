-- Admin plan override: make company_effective_plan_code() actually honour it.
--
-- Bug (found 2026-08-16): the admin panel action `adminOverridePlan` writes
-- companies.admin_override_plan_code + admin_override_until, and
-- company_effective_plan_active() correctly checks those columns, but
-- company_effective_plan_code() NEVER read them. Result: the account stayed
-- "active" but kept resolving to its old plan_code (e.g. free), so every
-- feature gate (company_has_feature -> subscription_plans lookup) ignored
-- the override. Admin panel showed "overridden" while the account itself
-- saw no change.
--
-- Fix: effective plan code now checks the admin override FIRST (before
-- comp_until / trial / subscription status), mirroring the precedence
-- already documented in company_effective_plan_active().
--
-- Verified live: RS Roofing (dd3b3943) effective plan now returns pro_plus
-- with an override until 2027-08-16.

CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT CASE
    -- Admin comp override beats everything until admin_override_until.
    WHEN c.admin_override_plan_code IS NOT NULL
         AND c.admin_override_until IS NOT NULL
         AND c.admin_override_until > now()
      THEN c.admin_override_plan_code
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
$function$;
