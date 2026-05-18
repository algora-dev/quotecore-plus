-- =====================================================================
-- Tier pricing v3: launch pricing + Pro Plus seats
-- =====================================================================
-- Updates the user-visible monthly prices on the active tiers and bumps
-- Pro Plus to 3 included seats per Shaun's spec (2026-05-18). Adds a new
-- column `price_cents_monthly_original` so the UI can render the launch
-- price as a discounted version of an MSRP (the "before" number with the
-- strikethrough).
--
-- Display rules:
--   price_cents_monthly_original IS NULL -> no strikethrough shown
--   price_cents_monthly_original > price_cents_monthly -> strikethrough
--   any other case -> still no strikethrough (defensive)
--
-- Prices (USD):
--   starter:  $19  (was $40)
--   growth:   $29  (was $60)
--   pro:      $39  (was $90)
--   pro_plus: $59  (was $120) — also bumped to 3 seats
--   premium:  hidden / coming-soon (no price displayed)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. New column for the "before" / MSRP price
-- ---------------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS price_cents_monthly_original integer
    CHECK (price_cents_monthly_original IS NULL OR price_cents_monthly_original >= 0);

COMMENT ON COLUMN public.subscription_plans.price_cents_monthly_original IS
  'Original / MSRP monthly price in cents. Displayed as a strikethrough next to price_cents_monthly when set and strictly greater. NULL means no strikethrough.';

-- ---------------------------------------------------------------------
-- 2. Apply launch pricing
-- ---------------------------------------------------------------------
UPDATE public.subscription_plans
   SET price_cents_monthly           = 1900,
       price_cents_monthly_original  = 4000
 WHERE code = 'starter';

UPDATE public.subscription_plans
   SET price_cents_monthly           = 2900,
       price_cents_monthly_original  = 6000
 WHERE code = 'growth';

UPDATE public.subscription_plans
   SET price_cents_monthly           = 3900,
       price_cents_monthly_original  = 9000
 WHERE code = 'pro';

UPDATE public.subscription_plans
   SET price_cents_monthly           = 5900,
       price_cents_monthly_original  = 12000,
       included_seats                = 3
 WHERE code = 'pro_plus';

-- Premium stays $0 / coming-soon; no strikethrough.
UPDATE public.subscription_plans
   SET price_cents_monthly           = 0,
       price_cents_monthly_original  = NULL
 WHERE code = 'premium';

-- Trial is free forever; no strikethrough.
UPDATE public.subscription_plans
   SET price_cents_monthly           = 0,
       price_cents_monthly_original  = NULL
 WHERE code = 'trial';

COMMIT;
