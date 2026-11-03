-- Free Workspace rebalance + paid capacity value (owner 2026-11-03).
-- Free: quotes = 10 AT ONCE (code-side concurrent check; key unchanged),
-- storage 1GB -> 100MB. Paid: unlimited creation + sends (ledger sentinel
-- 100000) and capacity component caps 20/30/50 (Toolbox/Workbench/Workshop).
-- Stripe prices and price IDs are untouched - entitlements only.

-- 1. Existing free workspaces: storage allowance 100MB.
UPDATE public.company_custom_billing
   SET purchased_entitlements = purchased_entitlements || jsonb_build_object('storageBytes', 100000000)
 WHERE stripe_customer_id = 'admin-granted'
   AND stripe_subscription_id LIKE 'admin-free-%';

-- 2. Capacity registry rows (every revision): unlimited-creation sentinel +
--    component caps. Historical revisions keep their codes/prices; only the
--    entitlements the owner re-valued today change.
UPDATE public.custom_billing_price_map
   SET entitlements = entitlements || jsonb_build_object('quotes', 100000, 'componentLimit', 20)
 WHERE component_code = 'capacity_low';

UPDATE public.custom_billing_price_map
   SET entitlements = entitlements || jsonb_build_object('quotes', 100000, 'componentLimit', 30)
 WHERE component_code = 'capacity_medium';

UPDATE public.custom_billing_price_map
   SET entitlements = entitlements || jsonb_build_object('quotes', 100000, 'componentLimit', 50)
 WHERE component_code = 'capacity_high';

-- 3. Roll the registry to the new catalog revision. The registry is one
--    physical row per Stripe Price (PK = account, mode, price_id), so a
--    revision bump is an UPDATE of the existing rows, never a clone.
UPDATE public.custom_billing_price_map
   SET catalog_revision = 'owner-first-pass-2026-11-03.1',
       verified_at = now()
 WHERE catalog_id = 'quotecore-us-monthly'
   AND catalog_revision = 'owner-first-pass-2026-10-05.4';

-- 4. Existing paid (custom_metered) companies: unlimited creation + capacity
--    component caps. Admin-free and admin-granted rows keep their own caps
--    (their stripe_customer_id is 'admin-granted').
UPDATE public.company_custom_billing
   SET purchased_entitlements = purchased_entitlements || jsonb_build_object(
         'quotes', 100000,
         'componentLimit', CASE purchased_entitlements->>'capacity'
           WHEN 'low' THEN 20
           WHEN 'medium' THEN 30
           WHEN 'high' THEN 50
           ELSE 100000
         END)
 WHERE purchased_entitlements ? 'capacity'
   AND COALESCE(stripe_customer_id, '') <> 'admin-granted';
