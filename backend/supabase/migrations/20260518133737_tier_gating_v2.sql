-- =====================================================================
-- Tier gating v2 (free-trial reposition + component/flashing caps)
-- =====================================================================
-- Repositions the free trial from "lite tier" to "full-feature taster"
-- with tiny numeric caps:
--   * trial monthly_quote_limit stays at 10 (draft+sent share this bucket
--     via create_quote_atomic's single counter)
--   * trial gets ALL features unlocked so users can try everything
--   * trial gets a 10-component lifetime cap + 5-flashing lifetime cap
--   * trial storage drops to 100 MiB (was 200 MiB)
--
-- Component/flashing limits are LIFETIME totals (not monthly). Soft-deleted
-- components (is_active=false) do NOT count. Flashing has no is_active so
-- every row counts.
--
-- Existing higher-tier plans get NULL limits (= unlimited) so we don't
-- accidentally cap paying customers. Shaun will dial in per-tier numbers
-- later via a separate migration that just UPDATEs the rows.
--
-- Grandfathering: existing companies that already exceed the new trial
-- caps stay over-cap; gating is enforced at NEW insert time only via the
-- check helpers, never via DELETE.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. New limit columns on subscription_plans
-- ---------------------------------------------------------------------
-- NULL = unlimited. We use NULL rather than a sentinel like -1 so SQL
-- "WHERE used >= limit" naturally short-circuits when limit IS NULL.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS component_limit integer
    CHECK (component_limit IS NULL OR component_limit >= 0),
  ADD COLUMN IF NOT EXISTS flashing_limit  integer
    CHECK (flashing_limit  IS NULL OR flashing_limit  >= 0);

COMMENT ON COLUMN public.subscription_plans.component_limit IS
  'Lifetime cap on company_library rows where is_active=true. NULL = unlimited. Enforced via require_component_slot() at insert time.';
COMMENT ON COLUMN public.subscription_plans.flashing_limit IS
  'Lifetime cap on flashing_library rows. NULL = unlimited. Enforced via require_flashing_slot() at insert time.';

-- ---------------------------------------------------------------------
-- 2. Re-seed trial + leave other tiers untouched on numeric features.
-- ---------------------------------------------------------------------
-- Free trial repositions to "everything unlocked, tiny caps". The 14-day
-- expiry still collapses to starter via company_effective_plan_code().
UPDATE public.subscription_plans
   SET monthly_quote_limit  = 10,
       storage_limit_bytes  = 104857600,   -- 100 MiB
       component_limit      = 10,
       flashing_limit       = 5,
       feat_digital_takeoff = true,
       feat_flashings       = true,
       feat_material_orders = true,
       feat_followups       = true,
       feat_email_send      = true,
       feat_activity_card   = true
 WHERE code = 'trial';

-- Other tiers: explicit NULL on the new caps (unlimited). Idempotent.
UPDATE public.subscription_plans
   SET component_limit = NULL,
       flashing_limit  = NULL
 WHERE code IN ('starter','growth','pro','scaling','business','enterprise');

-- ---------------------------------------------------------------------
-- 3. Count helpers
-- ---------------------------------------------------------------------
-- Single-row functions used by both the require_*_slot enforcers below
-- and by the entitlements snapshot loader on the app side.

CREATE OR REPLACE FUNCTION public.company_component_count(p_company_id uuid)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.component_library
   WHERE company_id = p_company_id
     AND is_active  = true;
$$;

COMMENT ON FUNCTION public.company_component_count IS
  'Lifetime active-component count for tier-cap enforcement. Soft-deleted (is_active=false) rows excluded.';

CREATE OR REPLACE FUNCTION public.company_flashing_count(p_company_id uuid)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.flashing_library
   WHERE company_id = p_company_id;
$$;

COMMENT ON FUNCTION public.company_flashing_count IS
  'Lifetime flashing-library count for tier-cap enforcement.';

-- ---------------------------------------------------------------------
-- 4. Slot-acquisition enforcers
-- ---------------------------------------------------------------------
-- These RAISE on miss with SQLSTATE codes the app maps to typed errors:
--   P0010 = component_limit_reached
--   P0011 = flashing_limit_reached
--   P0012 = feature_not_available  (caller asked to consume a slot for a
--                                   feature the plan doesn't include)
--
-- Both functions use SECURITY DEFINER so RLS on subscription_plans /
-- companies doesn't matter to the lookup.
--
-- They DO NOT insert anything — they just validate. The caller follows
-- up with the actual INSERT in the same transaction. We rely on the
-- per-company advisory lock to prevent two parallel creates squeezing
-- through the cap; component/flashing creates are low-frequency enough
-- that we don't bother with a dedicated lock — the small race window
-- (under load, two simultaneous creates could both pass) is acceptable
-- for now.

CREATE OR REPLACE FUNCTION public.require_component_slot(p_company_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_used  integer;
  v_limit integer;
  v_code  text;
  v_active boolean;
BEGIN
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.component_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  -- NULL limit = unlimited.
  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  v_used := public.company_component_count(p_company_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'component_limit_reached'
      USING ERRCODE = 'P0010',
            DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.require_flashing_slot(p_company_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_used  integer;
  v_limit integer;
  v_code  text;
  v_active boolean;
  v_has_feature boolean;
BEGIN
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- Flashings is a gated FEATURE (not a numeric cap below trial). Block
  -- early if the plan doesn't include it at all.
  v_has_feature := public.company_has_feature(p_company_id, 'flashings');
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'feature_not_available:flashings'
      USING ERRCODE = 'P0012';
  END IF;

  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.flashing_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  v_used := public.company_flashing_count(p_company_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'flashing_limit_reached'
      USING ERRCODE = 'P0011',
            DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
  END IF;
END $$;

COMMENT ON FUNCTION public.require_component_slot IS
  'Raises component_limit_reached (P0010) if active count would exceed cap. Call inside the same txn as the component INSERT.';
COMMENT ON FUNCTION public.require_flashing_slot IS
  'Raises feature_not_available (P0012) or flashing_limit_reached (P0011). Call before the flashing INSERT.';

-- ---------------------------------------------------------------------
-- 5. Permissions
-- ---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.company_component_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.company_flashing_count(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.require_component_slot(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.require_flashing_slot(uuid)   TO authenticated, service_role;

COMMIT;
