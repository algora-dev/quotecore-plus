-- Additive follow-up replacement of the function supplied in 20261010120000.
-- Fixes expired/missing custom snapshots becoming permissive pro_plus access.
-- Legacy/admin override branches are retained. Does NOT complete custom quota or
-- scan/task enforcement. Those RPC definitions were not included in the archive.
-- Existing manual admin-* snapshots require the next grant-policy pass. They are
-- not a Stripe subscription and must not be silently treated as one.
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
    -- paid custom setup; the custom snapshot must still own purchased caps.
    -- Invalid/expired custom access returns free explicitly, never the old plan.
    WHEN c.billing_model = 'custom_setup' THEN
      CASE WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
        AND EXISTS (
          SELECT 1 FROM public.company_custom_billing cb
          WHERE cb.company_id = c.id
            AND cb.stripe_mode = c.stripe_mode
            AND cb.stripe_subscription_id = c.stripe_subscription_id
            AND cb.stripe_customer_id = c.stripe_customer_id
            AND cb.provider_status IN ('active','trialing','past_due','unpaid','disputed')
            AND cb.period_start <= now() AND cb.period_end > now()
        ) THEN 'pro_plus' ELSE 'free' END
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
