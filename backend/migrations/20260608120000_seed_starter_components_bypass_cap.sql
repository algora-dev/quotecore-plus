-- ============================================================================
-- Trade-aware starter-component seeding that bypasses the tier component cap.
--
-- PROBLEM (root cause of "no test components on signup"):
--   The per-row trigger tg_enforce_component_cap -> require_component_slot()
--   enforces the subscription tier's component_limit (Starter/trial = 10).
--   Signup seeds the starter set as a bulk insert; once the running count hits
--   the limit, require_component_slot RAISEs and the WHOLE insert rolls back —
--   the new company ends up with ZERO seeded components. Seeding is a SYSTEM
--   action, not a user mutation, so it should not be gated by the user's cap.
--
-- FIX:
--   1. require_component_slot() early-returns when the transaction-local GUC
--      app.bypass_component_cap = 'on'. Normal user inserts are unaffected
--      (the GUC is unset for them, so the cap still applies exactly as before).
--   2. seed_starter_components() is a SECURITY DEFINER RPC that sets that GUC
--      LOCAL (transaction-scoped) and inserts the rows. The app calls this
--      instead of a direct table insert so the seed can never be capped.
--
-- Idempotent: CREATE OR REPLACE only; no data writes here.
-- ============================================================================

-- 1) Teach the cap check to honour the seed bypass flag. -----------------------
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

-- 2) System seed RPC: inserts starter components with the cap bypassed. --------
--    p_rows is a JSONB array of component objects (keys match column names).
--    Only an explicit allow-list of columns is read, so unknown keys are
--    ignored. Returns the number of rows inserted.
CREATE OR REPLACE FUNCTION public.seed_starter_components(
  p_company_id   uuid,
  p_collection_id uuid,
  p_rows         jsonb
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN 0;
  END IF;

  -- Transaction-local: applies only to this function's statements, auto-clears
  -- at COMMIT/ROLLBACK. require_component_slot() reads this to skip the cap.
  PERFORM set_config('app.bypass_component_cap', 'on', true);

  INSERT INTO public.component_library (
    company_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate,
    default_waste_type, default_waste_percent, default_waste_fixed,
    default_pitch_type, eligible_for_orders, is_active, sort_order,
    pricing_strategy, pack_price, pack_size, pack_coverage_m2,
    height_value_mm, depth_value_mm, waste_unit, notes, collection_id
  )
  SELECT
    p_company_id,
    r->>'name',
    COALESCE((r->>'component_type')::component_type, 'main'),
    (r->>'measurement_type')::measurement_type,
    COALESCE((r->>'default_material_rate')::numeric, 0),
    COALESCE((r->>'default_labour_rate')::numeric, 0),
    COALESCE((r->>'default_waste_type')::waste_type, 'none'),
    COALESCE((r->>'default_waste_percent')::numeric, 0),
    COALESCE((r->>'default_waste_fixed')::numeric, 0),
    COALESCE((r->>'default_pitch_type')::pitch_type, 'none'),
    COALESCE((r->>'eligible_for_orders')::boolean, true),
    true,
    COALESCE((r->>'sort_order')::integer, (ord.idx - 1)),
    COALESCE((r->>'pricing_strategy')::pricing_strategy, 'per_unit'),
    NULLIF(r->>'pack_price', '')::numeric,
    NULLIF(r->>'pack_size', '')::numeric,
    NULLIF(r->>'pack_coverage_m2', '')::numeric,
    NULLIF(r->>'height_value_mm', '')::integer,
    NULLIF(r->>'depth_value_mm', '')::integer,
    COALESCE((r->>'waste_unit')::waste_unit, 'percent'),
    NULLIF(r->>'notes', ''),
    p_collection_id
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS ord(r, idx);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $function$;

-- Allow the service role (used by the signup/onboarding server actions) to call
-- the seed RPC. SECURITY DEFINER already runs it as owner; this just grants
-- EXECUTE visibility.
GRANT EXECUTE ON FUNCTION public.seed_starter_components(uuid, uuid, jsonb)
  TO service_role;
