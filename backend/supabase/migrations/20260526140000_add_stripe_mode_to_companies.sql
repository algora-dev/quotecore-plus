-- 20260526140000_add_stripe_mode_to_companies.sql
--
-- Adds a stripe_mode column to companies so we can identify which Stripe
-- environment (test vs live) created the billing records for a company.
-- This prevents the class of bug where a test-mode customer ID gets used
-- with a live-mode Stripe key (surfaced in T13 smoke test, 2026-05-26).
--
-- Backfill logic:
--   - Companies with a stripe_subscription_id → 'live' (real live subscriptions
--     are only created when the live key is active)
--   - "Residential Roofing" (cus_UXWHxulYOoHgHJ) has no subscription_id →
--     explicitly set to 'test' (it is a test-mode customer)
--   - All other companies with no Stripe data → NULL (not yet billed)
--
-- Going forward, checkout session creation and webhook handlers will stamp
-- this column on every write.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_mode text
  CHECK (stripe_mode IN ('live', 'test'));

-- Backfill companies that have a real live subscription → 'live'
UPDATE public.companies
SET stripe_mode = 'live'
WHERE stripe_subscription_id IS NOT NULL;

-- Backfill the known test-mode customer → 'test'
UPDATE public.companies
SET stripe_mode = 'test'
WHERE stripe_customer_id = 'cus_UXWHxulYOoHgHJ';

COMMENT ON COLUMN public.companies.stripe_mode IS
  'Stripe environment that created the billing records: ''live'' or ''test''. '
  'NULL means no Stripe billing has occurred yet. '
  'Set by checkout and webhook handlers on every Stripe write.';
