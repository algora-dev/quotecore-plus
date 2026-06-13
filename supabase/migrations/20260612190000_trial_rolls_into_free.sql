-- Trial expiry now rolls the company DIRECTLY INTO the FREE tier (active),
-- instead of collapsing to a read-only 'starter' shell. Shaun, 2026-06-12.
--
-- Behaviour after this migration, the moment an unconverted trial passes its
-- trial_ends_at (stripe_subscription_id IS NULL):
--   * effective plan code  -> 'free'  (was 'starter')
--   * effective plan active -> true    (was false / read-only)
-- So the user keeps a working FREE account (5 quotes/mo, URL-link send, alerts)
-- rather than a locked one. Paid features stay locked because they resolve from
-- the Free plan row in company_has_feature(). Both functions must agree on the
-- same predicate or gating/visibility desync.

CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- Admin comp override beats everything until comp_until.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN c.plan_code
    -- Trial expired with no Stripe subscription: roll into FREE (not starter).
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN 'free'
    -- Healthy states keep their purchased plan.
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN c.plan_code
    -- Grace / pending_data_purge / cancellation_pending: collapse to starter
    -- (read-only on gated features; existing data still viewable).
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN 'starter'
    -- Suspended / canceled: fully locked elsewhere via _active = false.
    ELSE 'starter'
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;

CREATE OR REPLACE FUNCTION public.company_effective_plan_active(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- Comp users are always active.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN true
    -- Expired trial with no paid Stripe subscription: now ACTIVE on FREE
    -- (was read-only). Free-tier mutations (e.g. up to 5 quotes/mo) are allowed;
    -- paid features stay locked via company_has_feature() on the free plan row.
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN true
    -- Normal active states + disputed-with-ticket.
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN true
    -- "In trouble but still alive" states: read-only but viewable.
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN true
    -- Suspended / canceled: fully locked.
    ELSE false
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$function$;
