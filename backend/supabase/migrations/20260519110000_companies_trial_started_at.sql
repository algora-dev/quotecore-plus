-- Gerald audit M-01R: durable once-per-company trial marker.
--
-- Previously `activateTrial` server action used `companies.stripe_customer_id`
-- as the "has this company ever started a trial?" proxy, which only fires
-- AFTER first Checkout. A non-paying company whose trial expired could
-- re-invoke activateTrial and get another 14 days.
--
-- Fix: add an explicit `trial_started_at` timestamp, set the first time a
-- trial is activated, and gate subsequent attempts on its presence.
--
-- Backfill: any company currently in `trialing` status with a non-null
-- `trial_ends_at` is stamped with `plan_started_at` (best available approx
-- of when the trial began). Pure migration; service-role-only path so we
-- don't need to touch the C-01 column-level GRANT (this column is billing
-- state, not profile state).

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

COMMENT ON COLUMN public.companies.trial_started_at IS
  'First time the company activated the non-Stripe trial. NULL means trial has never been used. Once set, activateTrial() server-action refuses further activations. M-01R.';

-- Backfill existing trial companies so they don't get a second trial after
-- this migration ships.
UPDATE public.companies
SET trial_started_at = COALESCE(plan_started_at, created_at)
WHERE trial_started_at IS NULL
  AND (
    subscription_status = 'trialing'
    OR trial_ends_at IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS companies_trial_started_at_idx
  ON public.companies (trial_started_at)
  WHERE trial_started_at IS NOT NULL;

COMMIT;
