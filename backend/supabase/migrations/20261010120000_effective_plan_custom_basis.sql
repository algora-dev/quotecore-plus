-- Pricing V5 phase P6: custom-setup companies get the most permissive legacy
-- plan basis for SLOT/FEATURE enforcement, while the TS entitlements loader
-- overrides the real purchased caps (quotes/storage/digital-takeoff) from the
-- company_custom_billing snapshot. plan_code history is untouched (sacred).
-- Admin override + comp arms keep priority: Shaun's manual powers stay supreme.
CREATE OR REPLACE FUNCTION public.company_effective_plan_code(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    -- Custom-setup (V5) billing: healthy custom subscriptions ride the most
    -- permissive legacy basis so legacy slot/feature gates never undercut a
    -- paid custom setup; the custom snapshot owns quotes/storage/digital caps
    -- in the entitlements loader. Unhealthy states fall through to the normal
    -- collapse arms below (grace -> free read-only, canceled -> locked).
    WHEN c.billing_model = 'custom_setup'
         AND c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN 'pro_plus'
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
