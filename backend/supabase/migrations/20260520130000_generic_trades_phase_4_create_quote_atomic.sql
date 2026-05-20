-- ============================================================================
-- Generic Trades Expansion — Phase 4: extend create_quote_atomic
-- ============================================================================
--
-- Source plan: docs/generic-trades/C2-implementation-plan.md Phase 4
--
-- Adds `trade` and `component_collection_id` to the projected column list of
-- create_quote_atomic. Every other behaviour preserved:
--   - SECURITY DEFINER, advisory-lock per company-per-month, subscription
--     check, monthly limit check, single transaction (Gerald H-02).
--   - P0001/P0002/P0003 error codes unchanged.
--   - Existing whitelisted payload fields unchanged.
--
-- Feature flag posture:
--   - When NEITHER `trade` NOR `component_collection_id` is supplied in the
--     payload, the row defaults to `trade='roofing'` (column default) and
--     `component_collection_id=NULL` (column default) — behaviour-identical
--     to pre-Phase-4 callers.
--   - The TS-layer feature flag (GENERIC_TRADES_V1_ENABLED) gates whether
--     callers MUST supply these fields. The RPC stays simple and just
--     projects whatever it receives.
--   - `component_collection_id` is FK-constrained at the table level
--     (composite FK to component_collections(company_id, id), round-3 H-03)
--     so a bad uuid still fails loudly. `trade` is enum-typed so junk
--     values still fail loudly.
--
-- The trade column has NOT NULL DEFAULT 'roofing' from Phase 2, so any
-- payload that omits it keeps producing roofing quotes — protecting every
-- existing caller during the staged rollout.
--
-- NOT YET APPLIED. Apply via the v1/projects/{ref}/database/query API.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_quote_atomic(
  p_company_id uuid,
  p_user_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_period date := date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
  v_used   integer;
  v_limit  integer;
  v_active boolean;
  v_effective_code text;
  v_quote_id uuid;
  v_company_exists boolean;
BEGIN
  -- Validate the company exists at all (defends against a stale UI passing
  -- a deleted company id).
  SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = p_company_id) INTO v_company_exists;
  IF NOT v_company_exists THEN
    RAISE EXCEPTION 'unknown_company' USING ERRCODE = 'P0003';
  END IF;

  -- Advisory lock: serialise quote creation per company. 64-bit lock key
  -- derived from the company uuid. Released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text)::bigint);

  -- Active-subscription check.
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- Monthly limit check (always; clones included).
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.monthly_quote_limit
    INTO v_limit
    FROM public.subscription_plans sp
    WHERE sp.code = v_effective_code;

  IF v_limit IS NULL THEN
    -- Defensive: effective code resolved to something not in the catalogue.
    -- Should never happen since plan_code is FK-constrained, but bail loudly
    -- rather than letting it silently succeed.
    RAISE EXCEPTION 'plan_not_found:%', v_effective_code USING ERRCODE = 'P0003';
  END IF;

  SELECT COALESCE(quotes_created, 0)
    INTO v_used
    FROM public.company_quote_usage
    WHERE company_id = p_company_id AND period_start = v_period;

  IF v_used IS NULL THEN v_used := 0; END IF;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'quote_limit_reached'
      USING ERRCODE = 'P0002',
            DETAIL = format('used=%s limit=%s period_start=%s plan=%s',
                            v_used, v_limit, v_period, v_effective_code);
  END IF;

  -- Insert the quote. We explicitly project columns from p_payload so callers
  -- can't sneak in (for example) company_id overrides or quote_number values.
  -- Any field the caller doesn't supply uses the column default.
  --
  -- Phase 4 (generic trades): adds `trade` and `component_collection_id` to
  -- the projection. Both default-safe: `trade` has NOT NULL DEFAULT 'roofing'
  -- from Phase 2; `component_collection_id` is nullable. The composite FK
  -- (company_id, component_collection_id) -> component_collections
  -- (company_id, id) catches cross-company links at the constraint layer
  -- (round-3 H-03).
  INSERT INTO public.quotes (
    company_id,
    template_id,
    customer_name,
    customer_email,
    customer_phone,
    job_name,
    site_address,
    tax_rate,
    notes_internal,
    created_by_user_id,
    global_pitch_degrees,
    measurement_system,
    cq_company_name,
    cq_company_address,
    cq_company_phone,
    cq_company_email,
    cq_company_logo_url,
    cq_footer_text,
    currency,
    entry_mode,
    material_margin_percent,
    labor_margin_percent,
    material_margin_enabled,
    labor_margin_enabled,
    trade,
    component_collection_id
  )
  VALUES (
    p_company_id,
    NULLIF(p_payload->>'template_id', '')::uuid,
    p_payload->>'customer_name',
    NULLIF(p_payload->>'customer_email', ''),
    NULLIF(p_payload->>'customer_phone', ''),
    NULLIF(p_payload->>'job_name', ''),
    NULLIF(p_payload->>'site_address', ''),
    COALESCE((p_payload->>'tax_rate')::numeric, 0),
    NULLIF(p_payload->>'notes_internal', ''),
    p_user_id,
    NULLIF(p_payload->>'global_pitch_degrees', '')::numeric,
    COALESCE((p_payload->>'measurement_system')::measurement_system, 'metric'::measurement_system),
    NULLIF(p_payload->>'cq_company_name', ''),
    NULLIF(p_payload->>'cq_company_address', ''),
    NULLIF(p_payload->>'cq_company_phone', ''),
    NULLIF(p_payload->>'cq_company_email', ''),
    NULLIF(p_payload->>'cq_company_logo_url', ''),
    NULLIF(p_payload->>'cq_footer_text', ''),
    COALESCE(NULLIF(p_payload->>'currency', ''), 'NZD'),
    COALESCE(NULLIF(p_payload->>'entry_mode', ''), 'manual'),
    NULLIF(p_payload->>'material_margin_percent', '')::numeric,
    NULLIF(p_payload->>'labor_margin_percent', '')::numeric,
    COALESCE((p_payload->>'material_margin_enabled')::boolean, false),
    COALESCE((p_payload->>'labor_margin_enabled')::boolean, false),
    -- Phase 4 additions:
    COALESCE((p_payload->>'trade')::trade, 'roofing'::trade),
    NULLIF(p_payload->>'component_collection_id', '')::uuid
  )
  RETURNING id INTO v_quote_id;

  -- Increment the monthly counter. ON CONFLICT for the first-of-the-month case.
  INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
  VALUES (p_company_id, v_period, 1)
  ON CONFLICT (company_id, period_start)
    DO UPDATE SET quotes_created = company_quote_usage.quotes_created + 1;

  RETURN v_quote_id;
END $function$;

COMMENT ON FUNCTION public.create_quote_atomic(uuid, uuid, jsonb) IS
  'H-02 + Phase 4: atomic quote creation under per-company advisory lock. '
  'Projects trade + component_collection_id from payload (default ''roofing'' / NULL). '
  'Composite FK on (company_id, component_collection_id) blocks cross-company links.';

COMMIT;

-- ============================================================================
-- End of Phase 4 migration. Apply via v1/projects/{ref}/database/query.
-- ============================================================================
