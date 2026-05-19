-- Gerald re-audit pass-2 M-01R-P2 closure.
--
-- The 2026-05-19 migration `20260519110000_companies_trial_started_at.sql`
-- added the column and backfilled HISTORICAL rows, but the BEFORE INSERT
-- trigger `set_company_trial_defaults()` was untouched. New signup +
-- onboarding paths insert companies without an explicit `trial_started_at`,
-- the trigger fills `trial_ends_at` (giving them a 14-day auto-trial) but
-- leaves `trial_started_at` NULL. After expiry the user can invoke
-- activateTrial() and get a second 14-day trial because the guard sees
-- trial_started_at = NULL.
--
-- Fix: extend the trigger so whenever it places a company onto the trial
-- (subscription_status = 'trialing'), it also stamps trial_started_at if
-- the caller didn't supply one. The activateTrial server-action's own
-- stamping path remains unchanged; this just ensures the auto-trial path
-- also produces a durable marker.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_company_trial_defaults()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan_code IS NULL THEN
    NEW.plan_code := 'trial';
  END IF;
  IF NEW.subscription_status IS NULL THEN
    NEW.subscription_status := 'trialing';
  END IF;
  IF NEW.trial_ends_at IS NULL AND NEW.subscription_status = 'trialing' THEN
    NEW.trial_ends_at := now() + interval '14 days';
  END IF;
  -- M-01R-P2: durable trial marker. Any path that auto-creates a trial via
  -- the default trigger must also stamp trial_started_at so the
  -- once-per-company guard in activateTrial() can see it.
  IF NEW.subscription_status = 'trialing' AND NEW.trial_started_at IS NULL THEN
    NEW.trial_started_at := now();
  END IF;
  RETURN NEW;
END $$;

COMMIT;
