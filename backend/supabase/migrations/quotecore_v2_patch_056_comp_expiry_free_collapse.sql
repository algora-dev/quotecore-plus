-- Comp expiry enforcement (2026-09-24).
-- Problem: comped companies carry plan_code='pro' + subscription_status='active'
-- (set by the paid-only migration script). When comp_until passes, the plan
-- resolver falls through to the healthy-'active' branch and returns 'pro'
-- forever. The 1-month comp granted 2026-09-16 (expires 2026-10-16) never ends.
--
-- Fix: when a comp has expired AND the company has no Stripe subscription,
-- the 'active' status is a comp artifact; collapse to 'free' (the backend
-- restricted state: view/export own work, no new quoting features).
--
-- Safety:
--   * Companies that subscribe during the comp get stripe_subscription_id
--     from the webhook -> this branch never matches them again.
--   * admin_override branch still wins (admins can still save anyone).
--   * Dormant until the first comp_until passes (all current comps are
--     future-dated): zero behaviour change on the day this is applied.
--   * company_effective_plan_active() is deliberately NOT changed: the
--     'active' status keeps _active=true, so comp-expired users land in the
--     restricted Free workspace (same precedent as expired-trial collapse),
--     NOT behind the hard paywall gate.

BEGIN;

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
    -- Comp active: keep the granted plan.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    -- Comp expired with no Stripe subscription: the 'active' status is a
    -- comp artifact from the 2026-09 paid-only switch; collapse to free.
    WHEN c.comp_until IS NOT NULL
         AND c.comp_until <= now()
         AND c.stripe_subscription_id IS NULL
      THEN 'free'
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

REVOKE ALL ON FUNCTION public.company_effective_plan_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_effective_plan_code(uuid) TO authenticated, service_role;

COMMIT;
