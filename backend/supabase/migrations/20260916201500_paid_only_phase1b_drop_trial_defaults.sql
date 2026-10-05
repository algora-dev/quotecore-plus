-- Phase 1b fix: the companies table itself carries column defaults
-- plan_code DEFAULT 'trial' and subscription_status DEFAULT 'trialing'.
-- Those fire BEFORE the set_company_trial_defaults trigger, so the neutralised
-- trigger never saw NULLs and every new signup still became a trial.
-- Drop the trial column defaults; the trigger now provides starter/canceled.

ALTER TABLE public.companies
  ALTER COLUMN plan_code DROP DEFAULT,
  ALTER COLUMN subscription_status DROP DEFAULT;

-- Repair the account that slipped through during the gap (DN Roofing):
-- put it on the locked never-paid state so it hits the paywall correctly.
UPDATE public.companies
SET plan_code = 'starter',
    subscription_status = 'canceled'
WHERE plan_code = 'trial'
  AND subscription_status = 'trialing'
  AND trial_ends_at IS NULL;
