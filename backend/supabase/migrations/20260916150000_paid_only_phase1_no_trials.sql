-- Phase 1 (REV 4 plan + Tom 2026-09-16 brief): remove the free trial.
-- 1) New companies no longer get a trial: defaults become starter/canceled
--    (locked until they pay via the onboarding paywall or we comp them).
-- 2) Existing trial companies are comped to Pro for 1 month.

-- 1) Neutralise the trial-defaults trigger behaviour (trigger stays, behaviour changes).
CREATE OR REPLACE FUNCTION public.set_company_trial_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Paid-only app: no auto-trial. New companies start locked (canceled) on
  -- starter until they pay at the onboarding paywall or are manually comped.
  IF NEW.plan_code IS NULL THEN
    NEW.plan_code := 'starter';
  END IF;
  IF NEW.subscription_status IS NULL THEN
    NEW.subscription_status := 'canceled';
  END IF;
  RETURN NEW;
END $function$;

-- 2) Comp every current trial company to Pro for 1 month (per Shaun 2026-09-16).
--    Keeps trial_started_at/trial_ends_at untouched for history.
UPDATE public.companies
SET plan_code = 'pro',
    subscription_status = 'active',
    comp_until = now() + interval '1 month'
WHERE subscription_status = 'trialing';
