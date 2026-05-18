-- =====================================================================
-- Add companies.cancel_at to track Stripe's scheduled-cancellation field.
-- =====================================================================
-- Stripe carries TWO different "this sub is winding down" flags:
--   1. cancel_at_period_end (boolean) — cancel at the end of the current
--      paid period. Set by the Customer Portal's standard cancel flow.
--   2. cancel_at (timestamp) — explicit one-shot cancel at a future time.
--      Set by some Stripe Dashboard flows and Subscription Schedules.
--
-- We already track (1) but not (2). The trial-activation gate also needs
-- to honour (2) so users who've scheduled a cancellation can pre-stage a
-- trial without waiting for the period to elapse.
--
-- Webhook fills this column from sub.cancel_at on every subscription
-- update; the trial gate treats any non-null cancel_at OR cancel_at_period_end
-- as "winding down".
-- =====================================================================

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cancel_at timestamptz;

COMMENT ON COLUMN public.companies.cancel_at IS
  'Stripe-scheduled subscription cancellation timestamp (sub.cancel_at). Set on customer.subscription.updated; cleared on customer.subscription.deleted. Distinct from cancel_at_period_end which is a boolean for the standard portal flow.';

COMMIT;
