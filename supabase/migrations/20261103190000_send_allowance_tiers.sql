-- Send allowances per capacity tier (owner 2026-11-03 evening): Toolbox 20 /
-- Workbench 50 / Workshop 200 quotes a month. Creation stays unlimited
-- (100000 sentinel). Free Workspace keeps its own explicit quoteSends: 5
-- (admin-free rows are excluded below). Stripe prices untouched.

-- 1. Registry capacity rows: sendAllowance per tier (every revision/mode).
UPDATE public.custom_billing_price_map
   SET entitlements = entitlements || jsonb_build_object('sendAllowance', 20)
 WHERE component_code = 'capacity_low';

UPDATE public.custom_billing_price_map
   SET entitlements = entitlements || jsonb_build_object('sendAllowance', 50)
 WHERE component_code = 'capacity_medium';

UPDATE public.custom_billing_price_map
   SET entitlements = entitlements || jsonb_build_object('sendAllowance', 200)
 WHERE component_code = 'capacity_high';

-- 2. Roll the registry to the new catalog revision (registry is one physical
--    row per Stripe price - PK (account, mode, price_id) - so this is an
--    UPDATE, never a clone).
UPDATE public.custom_billing_price_map
   SET catalog_revision = 'owner-first-pass-2026-11-03.2', verified_at = now()
 WHERE catalog_id = 'quotecore-us-monthly'
   AND catalog_revision = 'owner-first-pass-2026-11-03.1';

-- 3. Existing paid setups (Stripe-metered + admin-granted comps): quoteSends
--    by capacity tier. Admin-free (Free Workspace) rows keep their 5/month.
UPDATE public.company_custom_billing
   SET purchased_entitlements = purchased_entitlements || jsonb_build_object('quoteSends',
         CASE purchased_entitlements->>'capacity'
           WHEN 'low' THEN 20
           WHEN 'medium' THEN 50
           WHEN 'high' THEN 200
           ELSE 100000
         END)
 WHERE purchased_entitlements ? 'capacity'
   AND stripe_subscription_id NOT LIKE 'admin-free-%';
