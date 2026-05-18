-- =====================================================================
-- Tier gating v3: re-cap pricing tiers + selectable trial + coming-soon tiers
-- =====================================================================
-- Resets monthly_quote_limit / storage_limit_bytes / component_limit /
-- flashing_limit / monthly_material_order_limit on the active tiers to
-- match Shaun's spec from 2026-05-18, deactivates the unused legacy tiers
-- (scaling/business/enterprise) so they no longer surface in the billing
-- UI, and adds two placeholder "coming soon" tiers.
--
-- Spec:
--   trial    -> 10 quotes/mo, 100 MiB storage, 10 comp, 5 flash, all features ON
--   starter  -> 25 quotes/mo, 200 MiB storage, 10 comp, 0 flash, 0 orders, lite features
--   growth   -> 50 quotes/mo, 2 GiB storage,   15 comp, 0 flash, 0 orders, lite features
--   pro      -> 100 quotes/mo, 3 GiB storage,  25 comp, 10 flash, 10 orders, all features
--   pro_plus -> 200 quotes/mo, 5 GiB storage,  50 comp, 20 flash, 20 orders, all features
--   premium  -> placeholder coming-soon. Display only; never selectable.
--
-- New columns:
--   * monthly_material_order_limit (per-month cap on material_orders rows;
--     NULL = unlimited). We only add the column here; enforcement comes in
--     a follow-up when material orders becomes user-creatable on lower
--     tiers (today material_orders is itself feature-gated on pro+).
--   * coming_soon (boolean) drives the greyed-out "Extra features" card
--     on the billing page. coming_soon=true rows are visible in the
--     pricing UI but never selectable.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS monthly_material_order_limit integer
    CHECK (monthly_material_order_limit IS NULL OR monthly_material_order_limit >= 0),
  ADD COLUMN IF NOT EXISTS coming_soon boolean NOT NULL DEFAULT false,
  -- Marketing copy surfaced on plan cards / View modals. Optional; falls
  -- back to a generic feature list when null.
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS feature_blurbs text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.subscription_plans.monthly_material_order_limit IS
  'Per-month cap on outgoing material orders. NULL = unlimited. Today this is feature-gated; will be enforced as a cap once orders are unlocked on lower tiers.';
COMMENT ON COLUMN public.subscription_plans.coming_soon IS
  'True for placeholder tiers that should render as greyed-out "Coming soon" cards on the billing page. Never selectable.';
COMMENT ON COLUMN public.subscription_plans.feature_blurbs IS
  'Plain-English bullet points displayed in the plan View modal. Curated copy that complements the numeric caps.';

-- ---------------------------------------------------------------------
-- 2. Update active tiers to the new spec
-- ---------------------------------------------------------------------
-- trial: full feature set, tiny caps. Already in spec from v2 — we just
-- re-assert the values here so the migration is idempotent and the
-- feature_blurbs land.
UPDATE public.subscription_plans
   SET monthly_quote_limit          = 10,
       storage_limit_bytes          = 104857600,     -- 100 MiB
       component_limit              = 10,
       flashing_limit               = 5,
       monthly_material_order_limit = 5,
       feat_digital_takeoff = true,
       feat_flashings       = true,
       feat_material_orders = true,
       feat_followups       = true,
       feat_email_send      = true,
       feat_activity_card   = true,
       price_cents_monthly  = 0,
       active               = true,
       coming_soon          = false,
       tagline              = '14-day taste of everything',
       feature_blurbs       = ARRAY[
         '14-day free trial — no card required',
         'All features unlocked so you can try the whole product',
         'Tiny caps so we know you mean business when you upgrade',
         'Auto-collapses to read-only after 14 days unless you pick a plan'
       ]
 WHERE code = 'trial';

UPDATE public.subscription_plans
   SET monthly_quote_limit          = 25,
       storage_limit_bytes          = 209715200,     -- 200 MiB
       component_limit              = 10,
       flashing_limit               = 0,
       monthly_material_order_limit = 0,
       feat_digital_takeoff = false,
       feat_flashings       = false,
       feat_material_orders = false,
       feat_followups       = false,
       feat_email_send      = false,
       feat_activity_card   = false,
       active               = true,
       coming_soon          = false,
       tagline              = 'Entry plan for solo contractors',
       feature_blurbs       = ARRAY[
         'Manual quote builder',
         'Customer-facing accept pages with stop-the-followups link',
         'Standard component library',
         'Suitable for ~25 jobs/month'
       ]
 WHERE code = 'starter';

UPDATE public.subscription_plans
   SET monthly_quote_limit          = 50,
       storage_limit_bytes          = 2147483648,    -- 2 GiB
       component_limit              = 15,
       flashing_limit               = 0,
       monthly_material_order_limit = 0,
       feat_digital_takeoff = true,
       feat_flashings       = false,
       feat_material_orders = false,
       feat_followups       = false,
       feat_email_send      = true,
       feat_activity_card   = true,
       active               = true,
       coming_soon          = false,
       tagline              = 'For growing roofing crews',
       feature_blurbs       = ARRAY[
         'Everything in Starter',
         'Digital takeoff: upload roof plans and measure on canvas',
         'Send quotes by email from inside the app',
         'Activity card on each quote (who saw it, when)'
       ]
 WHERE code = 'growth';

UPDATE public.subscription_plans
   SET monthly_quote_limit          = 100,
       storage_limit_bytes          = 3221225472,    -- 3 GiB
       component_limit              = 25,
       flashing_limit               = 10,
       monthly_material_order_limit = 10,
       feat_digital_takeoff = true,
       feat_flashings       = true,
       feat_material_orders = true,
       feat_followups       = true,
       feat_email_send      = true,
       feat_activity_card   = true,
       active               = true,
       coming_soon          = false,
       tagline              = 'The full QuoteCore+ workflow',
       feature_blurbs       = ARRAY[
         'Everything in Growth',
         'Flashings drawing tool + reusable library',
         'Material orders — send POs straight to suppliers',
         'Automated quote follow-ups'
       ]
 WHERE code = 'pro';

-- New tier: pro_plus. Insert if missing, otherwise update.
INSERT INTO public.subscription_plans (
  code, display_name, monthly_quote_limit, storage_limit_bytes, included_seats,
  component_limit, flashing_limit, monthly_material_order_limit,
  feat_digital_takeoff, feat_flashings, feat_material_orders,
  feat_followups, feat_email_send, feat_activity_card,
  price_cents_monthly, sort_order, active, coming_soon, tagline, feature_blurbs
)
VALUES (
  'pro_plus', 'Pro Plus',
  200,                  -- monthly_quote_limit
  5368709120,           -- 5 GiB
  1,
  50,                   -- component_limit
  20,                   -- flashing_limit
  20,                   -- monthly_material_order_limit
  true, true, true, true, true, true,
  -- Pricing slot left at 0 until Shaun sets it. UI surfaces this as
  -- "Pricing coming soon" rather than "Free".
  0,
  45,
  true,
  false,
  'Higher caps for established crews',
  ARRAY[
    'Everything in Pro',
    'Double the quote / component / flashing capacity',
    'Higher storage budget for plan PDFs and photos',
    'Priority email support'
  ]
)
ON CONFLICT (code) DO UPDATE SET
  display_name                  = EXCLUDED.display_name,
  monthly_quote_limit           = EXCLUDED.monthly_quote_limit,
  storage_limit_bytes           = EXCLUDED.storage_limit_bytes,
  component_limit               = EXCLUDED.component_limit,
  flashing_limit                = EXCLUDED.flashing_limit,
  monthly_material_order_limit  = EXCLUDED.monthly_material_order_limit,
  feat_digital_takeoff          = EXCLUDED.feat_digital_takeoff,
  feat_flashings                = EXCLUDED.feat_flashings,
  feat_material_orders          = EXCLUDED.feat_material_orders,
  feat_followups                = EXCLUDED.feat_followups,
  feat_email_send               = EXCLUDED.feat_email_send,
  feat_activity_card            = EXCLUDED.feat_activity_card,
  sort_order                    = EXCLUDED.sort_order,
  active                        = EXCLUDED.active,
  coming_soon                   = EXCLUDED.coming_soon,
  tagline                       = EXCLUDED.tagline,
  feature_blurbs                = EXCLUDED.feature_blurbs;

-- ---------------------------------------------------------------------
-- 3. Deactivate legacy tiers (rows stay for historical FK integrity)
-- ---------------------------------------------------------------------
-- These were placeholders in v1; they're not user-pickable in v3.
-- We keep them active=false so the billing UI hides them, and
-- non-coming-soon so they don't pollute the placeholder section either.
UPDATE public.subscription_plans
   SET active      = false,
       coming_soon = false
 WHERE code IN ('scaling', 'business', 'enterprise');

-- ---------------------------------------------------------------------
-- 4. Coming-soon placeholder tier
-- ---------------------------------------------------------------------
-- Visible on the billing page as a greyed-out card. Never selectable.
-- The name is deliberately marketing-y so we can swap it for the real
-- "premium" tier later without breaking links / saved customer copy.
INSERT INTO public.subscription_plans (
  code, display_name, monthly_quote_limit, storage_limit_bytes, included_seats,
  component_limit, flashing_limit, monthly_material_order_limit,
  feat_digital_takeoff, feat_flashings, feat_material_orders,
  feat_followups, feat_email_send, feat_activity_card,
  price_cents_monthly, sort_order, active, coming_soon, tagline, feature_blurbs
)
VALUES (
  'premium', 'Premium',
  -- Caps are placeholder; UI shows them as "—" because coming_soon=true.
  9999, 53687091200, 5,
  NULL, NULL, NULL,
  true, true, true, true, true, true,
  0,
  55,
  true,    -- active so it renders; coming_soon=true blocks selection
  true,
  'Extra features (coming soon)',
  ARRAY[
    'Everything in Pro Plus',
    'Bigger storage, higher caps',
    'Team seats (multiple users per company)',
    'Roadmap features — AI quote drafting, supplier price sync, more'
  ]
)
ON CONFLICT (code) DO UPDATE SET
  display_name                  = EXCLUDED.display_name,
  monthly_quote_limit           = EXCLUDED.monthly_quote_limit,
  storage_limit_bytes           = EXCLUDED.storage_limit_bytes,
  component_limit               = EXCLUDED.component_limit,
  flashing_limit                = EXCLUDED.flashing_limit,
  monthly_material_order_limit  = EXCLUDED.monthly_material_order_limit,
  feat_digital_takeoff          = EXCLUDED.feat_digital_takeoff,
  feat_flashings                = EXCLUDED.feat_flashings,
  feat_material_orders          = EXCLUDED.feat_material_orders,
  feat_followups                = EXCLUDED.feat_followups,
  feat_email_send               = EXCLUDED.feat_email_send,
  feat_activity_card            = EXCLUDED.feat_activity_card,
  sort_order                    = EXCLUDED.sort_order,
  active                        = EXCLUDED.active,
  coming_soon                   = EXCLUDED.coming_soon,
  tagline                       = EXCLUDED.tagline,
  feature_blurbs                = EXCLUDED.feature_blurbs;

COMMIT;
