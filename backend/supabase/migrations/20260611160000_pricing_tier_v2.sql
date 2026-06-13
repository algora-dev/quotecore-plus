-- =====================================================================
-- Pricing Tier v2 — Free Trial / Free / Starter / Pro
-- =====================================================================
-- Implements the locked TIER_SPEC_v2 (docs/pricing/TIER_SPEC_v2.md, Shaun
-- approved 2026-06-11). Scope of THIS migration:
--
--   1. CREATE the `free` plan row (forever-free, quote-only core).
--   2. DEACTIVATE `growth` (no real subscribers; removed from the ladder).
--   3. ADD columns: feat_invoices + monthly_invoice_limit,
--      feat_message_center, monthly_ai_tokens.
--      (NO feat_drawings/drawings_limit — "Drawings & Images" is the SAME
--      tool/table/feature as Flashings, just a trade-dependent label. It
--      reuses feat_flashings + flashing_library + require_flashing_slot.)
--   4. RE-CAP every active tier to the spec §2 matrix (source of truth,
--      overwrites prior tier_gating_v3 values).
--   5. Extend company_has_feature() with 'invoices' + 'message_center' arms.
--   6. Add company_invoice_count() (calendar-month, excludes cancelled) +
--      require_invoice_slot() (P0015) mirroring the catalog/attachment slot
--      pattern.
--   7. Add company_order_count() (calendar-month) + require_order_slot()
--      (P0016) so the monthly material-order cap is actually ENFORCED
--      (was feature-gated only until now). Per Shaun 2026-06-11 (option B).
--
-- Drawings/Images cap = Flashings cap (one tool, one table, one number).
-- Spec §2 generous value used: Trial 10 / Free 0 / Starter 0 / Pro 20.
--
-- AI tokens (monthly_ai_tokens): Free 600k / Trial 1M / Starter 1.5M /
-- Pro 3M (+ pro_plus 5M / premium NULL=unlimited). Wired into costGuard
-- in app code; column is the source of truth.
--
-- Orders: per-month order caps are now ENFORCED via require_order_slot()
-- (new this migration, Shaun option B 2026-06-11). Values per spec §2:
-- Free 0 / Trial 5 / Starter 5 / Pro 20. Starter gets material_orders ON.
--
-- One DB serves dev+prod. Additive/nullable only; no destructive ops.
-- Idempotent: re-runnable.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS feat_invoices boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_invoice_limit integer
    CHECK (monthly_invoice_limit IS NULL OR monthly_invoice_limit >= 0),
  ADD COLUMN IF NOT EXISTS feat_message_center boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_ai_tokens integer
    CHECK (monthly_ai_tokens IS NULL OR monthly_ai_tokens >= 0);

COMMENT ON COLUMN public.subscription_plans.feat_invoices IS
  'Whether the Invoices feature is available on this tier. Enforced via require_invoice_slot() + requireFeature(invoices).';
COMMENT ON COLUMN public.subscription_plans.monthly_invoice_limit IS
  'Per-calendar-month cap on invoices created. NULL = unlimited. Cancelled invoices excluded from the count.';
COMMENT ON COLUMN public.subscription_plans.feat_message_center IS
  'Whether the Message Center (/[ws]/inbox) is available on this tier.';
COMMENT ON COLUMN public.subscription_plans.monthly_ai_tokens IS
  'Per-calendar-month AI assistant token budget for the company. NULL = unlimited. Read by costGuard checkCostBudget() per effective plan.';

-- ---------------------------------------------------------------------
-- 2. Create the `free` plan row (forever-free, quote-only core)
-- ---------------------------------------------------------------------
-- Sort 15: between trial (10) and starter (20).
INSERT INTO public.subscription_plans (
  code, display_name, monthly_quote_limit, storage_limit_bytes, included_seats,
  component_limit, flashing_limit, monthly_material_order_limit,
  feat_digital_takeoff, feat_flashings, feat_material_orders,
  feat_followups, feat_email_send, feat_activity_card,
  feat_catalogs, feat_attachment_library,
  feat_invoices, monthly_invoice_limit, feat_message_center, monthly_ai_tokens,
  catalog_limit, attachment_limit,
  price_cents_monthly, sort_order, active, coming_soon, tagline, feature_blurbs
)
VALUES (
  'free', 'Free',
  5,                 -- monthly_quote_limit
  52428800,          -- 50 MiB
  1,
  10,                -- component_limit
  0,                 -- flashing_limit (drawings/images OFF)
  0,                 -- monthly_material_order_limit (orders OFF)
  false, false, false,        -- digital_takeoff, flashings, material_orders
  false, false, false,        -- followups, email_send, activity_card
  false, false,               -- catalogs, attachment_library
  false, 0, false, 600000,    -- invoices OFF, msg center OFF, AI 600k/mo
  0, 0,                       -- catalog_limit, attachment_limit
  0, 15, true, false,
  'Make & send quotes, keep your data',
  ARRAY[
    'Up to 5 quotes per month, forever free',
    'Send quotes by shareable URL link',
    'Accept / decline / change alerts to your bell + email',
    'Your data stays yours — upgrade any time'
  ]
)
ON CONFLICT (code) DO UPDATE SET
  display_name                 = EXCLUDED.display_name,
  monthly_quote_limit          = EXCLUDED.monthly_quote_limit,
  storage_limit_bytes          = EXCLUDED.storage_limit_bytes,
  component_limit              = EXCLUDED.component_limit,
  flashing_limit               = EXCLUDED.flashing_limit,
  monthly_material_order_limit = EXCLUDED.monthly_material_order_limit,
  feat_digital_takeoff         = EXCLUDED.feat_digital_takeoff,
  feat_flashings               = EXCLUDED.feat_flashings,
  feat_material_orders         = EXCLUDED.feat_material_orders,
  feat_followups               = EXCLUDED.feat_followups,
  feat_email_send              = EXCLUDED.feat_email_send,
  feat_activity_card           = EXCLUDED.feat_activity_card,
  feat_catalogs                = EXCLUDED.feat_catalogs,
  feat_attachment_library      = EXCLUDED.feat_attachment_library,
  feat_invoices                = EXCLUDED.feat_invoices,
  monthly_invoice_limit        = EXCLUDED.monthly_invoice_limit,
  feat_message_center          = EXCLUDED.feat_message_center,
  monthly_ai_tokens            = EXCLUDED.monthly_ai_tokens,
  catalog_limit                = EXCLUDED.catalog_limit,
  attachment_limit             = EXCLUDED.attachment_limit,
  price_cents_monthly          = EXCLUDED.price_cents_monthly,
  sort_order                   = EXCLUDED.sort_order,
  active                       = EXCLUDED.active,
  coming_soon                  = EXCLUDED.coming_soon,
  tagline                      = EXCLUDED.tagline,
  feature_blurbs               = EXCLUDED.feature_blurbs;

-- ---------------------------------------------------------------------
-- 3. Deactivate growth (removed from the ladder; no real subscribers)
-- ---------------------------------------------------------------------
UPDATE public.subscription_plans
   SET active = false, coming_soon = false
 WHERE code = 'growth';

-- ---------------------------------------------------------------------
-- 4. Re-cap active tiers to spec §2 matrix
-- ---------------------------------------------------------------------

-- TRIAL: $0/14d, everything on, modest caps.
UPDATE public.subscription_plans
   SET monthly_quote_limit          = 10,
       component_limit              = 10,
       flashing_limit               = 10,   -- drawings/images cap (=flashings, one tool)
       monthly_material_order_limit = 5,
       storage_limit_bytes          = 104857600,   -- 100 MiB
       feat_digital_takeoff = true,
       feat_flashings       = true,
       feat_material_orders = true,
       feat_followups       = true,
       feat_email_send      = true,
       feat_activity_card   = true,
       feat_catalogs        = true,
       feat_attachment_library = true,
       catalog_limit        = 2,
       attachment_limit     = 3,
       feat_invoices        = true,
       monthly_invoice_limit = 5,
       feat_message_center  = true,
       monthly_ai_tokens    = 1000000,      -- 1M
       price_cents_monthly  = 0
 WHERE code = 'trial';

-- STARTER: $19/mo. "Run the business" — orders, invoices, email send,
-- message center, higher quote/component caps. NO flashings/drawings,
-- digital measuring, catalogs, attachments, follow-ups, activity.
UPDATE public.subscription_plans
   SET monthly_quote_limit          = 25,
       component_limit              = 20,
       flashing_limit               = 0,    -- drawings/images OFF
       monthly_material_order_limit = 5,
       storage_limit_bytes          = 524288000,   -- 500 MiB
       feat_digital_takeoff = false,
       feat_flashings       = false,
       feat_material_orders = true,         -- Orders ON
       feat_followups       = false,
       feat_email_send      = true,         -- QCP email send ON
       feat_activity_card   = false,
       feat_catalogs        = false,
       feat_attachment_library = false,
       catalog_limit        = 0,
       attachment_limit     = 0,
       feat_invoices        = true,         -- Invoices ON
       monthly_invoice_limit = 5,
       feat_message_center  = true,         -- Message Center ON
       monthly_ai_tokens    = 1500000,      -- 1.5M
       price_cents_monthly  = 1900
 WHERE code = 'starter';

-- PRO: $39/mo. "Automate & go pro" — everything.
UPDATE public.subscription_plans
   SET monthly_quote_limit          = 100,
       component_limit              = 30,
       flashing_limit               = 20,   -- drawings/images cap
       monthly_material_order_limit = 20,
       storage_limit_bytes          = 3221225472,  -- 3 GiB
       feat_digital_takeoff = true,
       feat_flashings       = true,
       feat_material_orders = true,
       feat_followups       = true,
       feat_email_send      = true,
       feat_activity_card   = true,
       feat_catalogs        = true,
       feat_attachment_library = true,
       catalog_limit        = 3,
       attachment_limit     = 10,
       feat_invoices        = true,
       monthly_invoice_limit = 20,
       feat_message_center  = true,
       monthly_ai_tokens    = 3000000,      -- 3M
       price_cents_monthly  = 3900
 WHERE code = 'pro';

-- pro_plus / premium: keep existing caps; just populate the NEW columns so
-- higher tiers strictly dominate Pro. (Not part of the v2 ladder UI, but
-- must not be left with invoices/message-center OFF.)
UPDATE public.subscription_plans
   SET feat_invoices         = true,
       monthly_invoice_limit = 40,
       feat_message_center   = true,
       monthly_ai_tokens     = 5000000      -- 5M
 WHERE code = 'pro_plus';

UPDATE public.subscription_plans
   SET feat_invoices         = true,
       monthly_invoice_limit = NULL,        -- unlimited
       feat_message_center   = true,
       monthly_ai_tokens     = NULL         -- unlimited
 WHERE code = 'premium';

-- Inactive legacy tiers (scaling/business/enterprise/growth): leave the new
-- feature flags at their column defaults (false / 0 / NULL). They're
-- active=false so they never surface; no need to populate.

-- ---------------------------------------------------------------------
-- 5. Extend company_has_feature() — add 'invoices' + 'message_center'
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.company_has_feature(p_company_id uuid, p_feature text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_effective_code text;
  v_allowed boolean;
BEGIN
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT CASE p_feature
    WHEN 'digital_takeoff'    THEN sp.feat_digital_takeoff
    WHEN 'flashings'          THEN sp.feat_flashings
    WHEN 'material_orders'    THEN sp.feat_material_orders
    WHEN 'followups'          THEN sp.feat_followups
    WHEN 'email_send'         THEN sp.feat_email_send
    WHEN 'activity_card'      THEN sp.feat_activity_card
    WHEN 'catalogs'           THEN sp.feat_catalogs
    WHEN 'attachment_library' THEN sp.feat_attachment_library
    WHEN 'invoices'           THEN sp.feat_invoices            -- ← new
    WHEN 'message_center'     THEN sp.feat_message_center      -- ← new
    ELSE false
  END
  INTO v_allowed
  FROM public.subscription_plans sp
  WHERE sp.code = v_effective_code;

  RETURN COALESCE(v_allowed, false);
END $$;

COMMENT ON FUNCTION public.company_has_feature IS
  'Single feature-check function used by app code AND RLS policies. Extend the CASE arm + add a column to subscription_plans when introducing a new gated feature.';

-- ---------------------------------------------------------------------
-- 6. company_invoice_count() — calendar-month, excludes cancelled
-- ---------------------------------------------------------------------
-- Counts invoices created in the current UTC calendar month. Cancelled
-- invoices do NOT count toward the cap (a cancelled invoice shouldn't burn
-- a slot). Drafts + sent + paid + disputed all count.
CREATE OR REPLACE FUNCTION public.company_invoice_count(p_company_id uuid)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.invoices
   WHERE company_id = p_company_id
     AND cancelled_at IS NULL
     AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC');
$$;

COMMENT ON FUNCTION public.company_invoice_count IS
  'Count of invoices created this UTC calendar month (excluding cancelled) for monthly-cap enforcement.';

-- ---------------------------------------------------------------------
-- 7. require_invoice_slot() — P0015
-- ---------------------------------------------------------------------
-- Raises on inactive subscription, missing feature, or exceeded monthly
-- limit. Call inside the same transaction / immediately before invoice
-- INSERT. Error codes:
--   P0001 = subscription_inactive (shared)
--   P0012 = feature_not_available:invoices (shared)
--   P0015 = invoice_limit_reached (new)
CREATE OR REPLACE FUNCTION public.require_invoice_slot(p_company_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_used        integer;
  v_limit       integer;
  v_code        text;
  v_active      boolean;
  v_has_feature boolean;
BEGIN
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  v_has_feature := public.company_has_feature(p_company_id, 'invoices');
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'feature_not_available:invoices'
      USING ERRCODE = 'P0012';
  END IF;

  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.monthly_invoice_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  -- NULL = unlimited
  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  v_used := public.company_invoice_count(p_company_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'invoice_limit_reached'
      USING ERRCODE = 'P0015',
            DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
  END IF;
END $$;

COMMENT ON FUNCTION public.require_invoice_slot IS
  'Raises subscription_inactive (P0001), feature_not_available (P0012), or invoice_limit_reached (P0015). Call before the invoice INSERT.';

-- ---------------------------------------------------------------------
-- 8. Permissions
-- ---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.company_invoice_count(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.require_invoice_slot(uuid)   TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. company_order_count() — calendar-month material orders
-- ---------------------------------------------------------------------
-- Counts material_orders created this UTC calendar month. material_orders
-- has no company-side "cancelled" state (declined_at is a SUPPLIER response;
-- the order still existed and consumed a slot), so we count all rows for
-- the month — consistent with how quotes count drafts.
CREATE OR REPLACE FUNCTION public.company_order_count(p_company_id uuid)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.material_orders
   WHERE company_id = p_company_id
     AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC');
$$;

COMMENT ON FUNCTION public.company_order_count IS
  'Count of material orders created this UTC calendar month for monthly-cap enforcement.';

-- ---------------------------------------------------------------------
-- 10. require_order_slot() — P0016
-- ---------------------------------------------------------------------
-- Raises on inactive subscription, missing feature, or exceeded monthly
-- limit. Call immediately before the material_orders INSERT. Error codes:
--   P0001 = subscription_inactive (shared)
--   P0012 = feature_not_available:material_orders (shared)
--   P0016 = order_limit_reached (new)
CREATE OR REPLACE FUNCTION public.require_order_slot(p_company_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_used        integer;
  v_limit       integer;
  v_code        text;
  v_active      boolean;
  v_has_feature boolean;
BEGIN
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  v_has_feature := public.company_has_feature(p_company_id, 'material_orders');
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'feature_not_available:material_orders'
      USING ERRCODE = 'P0012';
  END IF;

  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.monthly_material_order_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  -- NULL = unlimited
  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  v_used := public.company_order_count(p_company_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'order_limit_reached'
      USING ERRCODE = 'P0016',
            DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
  END IF;
END $$;

COMMENT ON FUNCTION public.require_order_slot IS
  'Raises subscription_inactive (P0001), feature_not_available (P0012), or order_limit_reached (P0016). Call before the material_orders INSERT.';

GRANT EXECUTE ON FUNCTION public.company_order_count(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.require_order_slot(uuid)   TO authenticated, service_role;

COMMIT;
