-- 2026-10-18 quota directive (owner 15:22): custom-setup (V5) accounts have NO
-- slot quotas. The only metered limits are quotes (creation count, 5/20/100 by
-- capacity tier), storage bytes, scan tokens and assistant tasks. Legacy plans
-- keep their sold caps unchanged. Minimal diffs from the live definitions
-- (dumped 2026-10-18): a custom_setup early-return inserted after the
-- active/feature gates, before the plan-limit lookup.

CREATE OR REPLACE FUNCTION public.require_component_slot(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_used  integer;
  v_limit integer;
  v_code  text;
  v_active boolean;
BEGIN
  -- System seed bypass: when seeding canonical starter components we insert as
  -- a system action, not a user mutation, so the tier cap does not apply. The
  -- flag is set LOCAL inside seed_starter_components() and never leaks to normal
  -- requests. current_setting(..., true) returns NULL when unset (no error).
  IF current_setting('app.bypass_component_cap', true) = 'on' THEN
    RETURN;
  END IF;

  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- Custom-setup (V5) accounts: slot quotas lifted (owner 2026-10-18).
  -- Only quotes, storage, scan tokens and assistant tasks are metered.
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND billing_model = 'custom_setup') THEN
    RETURN;
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
END $function$;

CREATE OR REPLACE FUNCTION public.require_flashing_slot(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Custom-setup (V5) accounts: slot quotas lifted (owner 2026-10-18).
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND billing_model = 'custom_setup') THEN
    RETURN;
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
END $function$;

CREATE OR REPLACE FUNCTION public.require_catalog_slot(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  v_has_feature := public.company_has_feature(p_company_id, 'catalogs');
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'feature_not_available:catalogs'
      USING ERRCODE = 'P0012';
  END IF;

  -- Custom-setup (V5) accounts: slot quotas lifted (owner 2026-10-18).
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND billing_model = 'custom_setup') THEN
    RETURN;
  END IF;

  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.catalog_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  -- NULL = unlimited
  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  v_used := public.company_catalog_count(p_company_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'catalog_limit_reached'
      USING ERRCODE = 'P0013',
            DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.require_attachment_slot(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  v_has_feature := public.company_has_feature(p_company_id, 'attachment_library');
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'feature_not_available:attachment_library'
      USING ERRCODE = 'P0012';
  END IF;

  -- Custom-setup (V5) accounts: slot quotas lifted (owner 2026-10-18).
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND billing_model = 'custom_setup') THEN
    RETURN;
  END IF;

  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.attachment_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  -- NULL = unlimited
  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  v_used := public.company_attachment_count(p_company_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'attachment_limit_reached'
      USING ERRCODE = 'P0014',
            DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.require_invoice_slot(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Custom-setup (V5) accounts: slot quotas lifted (owner 2026-10-18).
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND billing_model = 'custom_setup') THEN
    RETURN;
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
END $function$;

CREATE OR REPLACE FUNCTION public.require_order_slot(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Custom-setup (V5) accounts: slot quotas lifted (owner 2026-10-18).
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND billing_model = 'custom_setup') THEN
    RETURN;
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
END $function$;
