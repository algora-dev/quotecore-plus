-- =====================================================================
-- Launch pricing in Stripe Checkout via "MSRP price + coupon" pattern.
-- =====================================================================
-- Stripe Checkout doesn't natively render a strikethrough MSRP next to a
-- discounted price. The workaround is to:
--   1. Bill the customer against the MSRP price (e.g. Growth = $60/mo).
--   2. Apply a "Launch Discount" coupon for the gap ($31 off forever).
-- Stripe Checkout then shows:
--     Subtotal:  $60.00
--     Discount: -$31.00  (Growth Launch Discount)
--     Total:    $29.00 / mo
--
-- The discount is `duration=forever`, so renewals stay at the launch price
-- until we explicitly remove the coupon from the customer in Stripe.
--
-- DB changes:
--   * Repoint stripe_price_id_test to the MSRP price for starter/growth/
--     pro/pro_plus (newly created in Stripe, ids hard-coded below).
--   * Add stripe_launch_coupon_id column. NULL means "no automatic
--     discount" (premium, trial). createCheckoutSession appends it via
--     the `discounts` field on the session.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. New column
-- ---------------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_launch_coupon_id text;

COMMENT ON COLUMN public.subscription_plans.stripe_launch_coupon_id IS
  'Stripe coupon id applied automatically in Checkout to discount MSRP -> launch price. NULL = bill at MSRP without discount.';

-- ---------------------------------------------------------------------
-- 2. Repoint test-mode prices to MSRP + attach launch coupons
-- ---------------------------------------------------------------------
-- Test-mode IDs created via stripe CLI on 2026-05-18. Live-mode rows stay
-- NULL until Shaun ships to production and re-creates the same setup in
-- the live Stripe account.
UPDATE public.subscription_plans
   SET stripe_price_id_test    = 'price_1TYT3HPIfO8jS1dm6R8PlDEa',
       stripe_launch_coupon_id = 'qc_starter_launch'
 WHERE code = 'starter';

UPDATE public.subscription_plans
   SET stripe_price_id_test    = 'price_1TYT3IPIfO8jS1dmi0b3TpZR',
       stripe_launch_coupon_id = 'qc_growth_launch'
 WHERE code = 'growth';

UPDATE public.subscription_plans
   SET stripe_price_id_test    = 'price_1TYT3IPIfO8jS1dm3fFJ9j0y',
       stripe_launch_coupon_id = 'qc_pro_launch'
 WHERE code = 'pro';

UPDATE public.subscription_plans
   SET stripe_price_id_test    = 'price_1TYT3JPIfO8jS1dmRes1Be8v',
       stripe_launch_coupon_id = 'qc_pro_plus_launch'
 WHERE code = 'pro_plus';

-- Trial, premium: no Stripe price, no coupon.

COMMIT;
