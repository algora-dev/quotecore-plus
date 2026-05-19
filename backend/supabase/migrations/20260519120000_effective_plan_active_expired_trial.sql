-- Lock expired trials read-only.
--
-- Smoke-test finding 2026-05-19: company_effective_plan_active() returned
-- true for any company with subscription_status='trialing', even if the
-- trial had expired (trial_ends_at < now()) and there was no Stripe
-- subscription. Combined with the plan-code resolver collapsing to
-- 'starter' on the same condition, this meant an expired-trial user got
-- Starter's full feature surface (25 quotes/month + 200 MB storage)
-- until the daily expire-trials cron flipped subscription_status to
-- 'canceled' \u2014 a write window of up to 24 hours.
--
-- Fix: an expired non-paying trial is now inactive. Mutations refuse
-- immediately at the assertCanCreateQuote / assertCanUseStorage /
-- requireFeature paths because all of them gate on isActive first.
-- Reads continue to work (the row-level select policies don't depend on
-- this function), so existing data stays viewable until purge.
--
-- The plan-code resolver already collapses to 'starter' on this exact
-- condition; this migration makes the active flag consistent.
--
-- The expire-trials cron (daily 06:09 UTC) still runs and is what
-- eventually flips subscription_status to 'canceled'. After it runs, the
-- ELSE branch catches the company. This migration just closes the limbo
-- window before the cron fires.

BEGIN;

CREATE OR REPLACE FUNCTION public.company_effective_plan_active(p_company_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT CASE
    -- Comp users are always active.
    WHEN c.comp_until IS NOT NULL AND c.comp_until > now()
      THEN true
    -- Expired trial with no paid Stripe subscription on file: read-only.
    -- Matches the same predicate used in company_effective_plan_code() to
    -- collapse to 'starter'. Without this branch, mutations sneak through
    -- until the expire-trials cron flips status to 'canceled'.
    WHEN c.subscription_status = 'trialing'
         AND c.trial_ends_at IS NOT NULL
         AND c.trial_ends_at < now()
         AND c.stripe_subscription_id IS NULL
      THEN false
    -- Normal active states + disputed-with-ticket (still working with us).
    WHEN c.subscription_status IN ('active','trialing','past_due','disputed')
      THEN true
    -- "In trouble but still alive" states: account is in read-only mode.
    -- We return true here so existing data stays viewable and the user can
    -- still log in / download files / restart subscription. Mutations are
    -- prevented by company_has_feature() returning false on those tiers.
    WHEN c.subscription_status IN ('grace','pending_data_purge','cancellation_pending')
      THEN true
    -- Suspended / canceled: fully locked. UI shows account-suspended page.
    ELSE false
  END
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

COMMIT;
