-- ============================================================================
-- Generic Trades Expansion — Phase 2: Dark Schema (UNAPPLIED)
-- ============================================================================
--
-- Status: UNAPPLIED. Awaiting Gerald round-3 audit + Shaun signoff before
--         posting to Supabase via the v1/projects/{ref}/database/query API.
--
-- Source plan: docs/generic-trades/C2-implementation-plan.md (patched)
-- Schema spec: docs/generic-trades/A-schema-delta.md (v2.1)
-- UX spec:     docs/generic-trades/B-ux-walkthrough.md (v2.1)
-- Audit:       docs/generic-trades/D-read-site-audit.md
--
-- Phase 2 strategy (Gerald-approved):
--   - Every new column is nullable OR default-valued.
--   - Two-layer feature flag stays OFF (server: GENERIC_TRADES_V1_ENABLED,
--     client: NEXT_PUBLIC_GENERIC_TRADES_V1). Applying this migration is
--     behaviour-equivalent for the existing roofing flow.
--   - NOT NULL tightening happens in later migrations after backfill +
--     create-path updates.
--
-- This file adds:
--   - enums: trade, waste_unit, pricing_strategy; extends measurement_type
--   - tables: component_collections, takeoff_sessions, takeoff_pages
--   - columns on companies, quotes, component_library, quote_component_entries,
--     quote_takeoff_measurements
--   - CHECK constraints on height/depth/pack-pricing nullability + strategy
--     compatibility matrix + combined-entry invariants
--   - Indexes (incl. partial unique index for bootstrap collections)
--   - RLS policies for the 3 new tables (company-scoped, matching existing patterns)
--   - SECURITY DEFINER RPC ensure_company_has_collection(p_company_id) with
--     pg_advisory_xact_lock (Gerald M-02)
--
-- ----------------------------------------------------------------------------
-- Note on `pricing_strategy` vs Gerald M-04's killed `pricing_mode`
-- ----------------------------------------------------------------------------
-- Gerald M-04 killed a proposed `pricing_mode` column that would have
-- duplicated `measurement_type` with no business use case. The new
-- `pricing_strategy` enum below is a DIFFERENT concern: it is orthogonal
-- to `measurement_type` and captures how the user PURCHASES the material
-- (rolls by length, rolls by area, paint-style coverage, volume-pack, or
-- per-unit). A single `area` component could legitimately be priced
-- `per_unit` OR `per_pack_area` OR `per_pack_coverage` depending on how
-- the user buys it. Compatibility with `measurement_type` is enforced
-- below by an explicit CHECK constraint matrix.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

-- Trade enum: v1 ships with roofing + generic. Future trades land via a
-- one-line ALTER TYPE plus a labels.ts entry.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade') THEN
    CREATE TYPE public.trade AS ENUM ('roofing', 'generic');
  END IF;
END$$;

-- Waste unit enum: percent (multiplier) or flat (additive per source segment/line).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waste_unit') THEN
    CREATE TYPE public.waste_unit AS ENUM ('percent', 'flat');
  END IF;
END$$;

-- Pricing strategy enum (Shaun addition).
-- See header note about M-04 disambiguation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_strategy') THEN
    CREATE TYPE public.pricing_strategy AS ENUM (
      'per_unit',           -- current behaviour: cost_per_unit * qty
      'per_pack_length',    -- e.g. cable in 20m rolls
      'per_pack_area',      -- e.g. underlay in 50 m² rolls
      'per_pack_coverage',  -- e.g. paint: 20L bucket covers 50 m²
      'per_pack_volume'     -- e.g. concrete in 5 m³ units
    );
  END IF;
END$$;

-- Extend the existing measurement_type enum with 8 new values (7 from the
-- original plan + multi_lineal from Shaun's addition).
-- PostgreSQL only allows ADD VALUE outside a transaction since PG 11; we
-- use a DO block per value with IF NOT EXISTS so re-runs are safe.
DO $$
DECLARE
  v_new_value text;
BEGIN
  FOR v_new_value IN SELECT unnest(ARRAY[
    'length_x_height',
    'volume',
    'hours_days',
    'count',
    'fixed',
    'curved_line',
    'irregular_area',
    'multi_lineal'         -- Shaun addition: polyline takeoff tool
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'measurement_type' AND e.enumlabel = v_new_value
    ) THEN
      EXECUTE format('ALTER TYPE public.measurement_type ADD VALUE %L', v_new_value);
    END IF;
  END LOOP;
END$$;

-- ----------------------------------------------------------------------------
-- 2. New tables
-- ----------------------------------------------------------------------------

-- 2.1 component_collections — user-managed containers for component libraries.
-- Owned by company. Collections have NO trade and NO is_default flag.
-- is_bootstrap is a guard flag for the SECDEF RPC + partial unique index.
CREATE TABLE IF NOT EXISTS public.component_collections (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name          text        NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  is_bootstrap  boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_collections_company
  ON public.component_collections(company_id);

-- Partial unique index: makes duplicate bootstrap collections impossible per
-- company. Combined with the per-company advisory lock in the SECDEF RPC,
-- this is the M-02 fix — concurrency-safe even if Supabase JS lacks an
-- app-level transaction boundary.
CREATE UNIQUE INDEX IF NOT EXISTS uq_component_collections_one_bootstrap_per_company
  ON public.component_collections(company_id)
  WHERE is_bootstrap = true;

-- Hook into the existing updated_at trigger.
DROP TRIGGER IF EXISTS trg_component_collections_updated_at ON public.component_collections;
CREATE TRIGGER trg_component_collections_updated_at
  BEFORE UPDATE ON public.component_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2.2 takeoff_sessions — one row per quote for v1 (multi-session deferred).
CREATE TABLE IF NOT EXISTS public.takeoff_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid        NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeoff_sessions_quote
  ON public.takeoff_sessions(quote_id);

-- 2.3 takeoff_pages — many pages per session. Each page is its own storage
-- object (uses the existing signed-upload finaliser flow for quota accounting).
CREATE TABLE IF NOT EXISTS public.takeoff_pages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid        NOT NULL REFERENCES public.takeoff_sessions(id) ON DELETE CASCADE,
  quote_id            uuid        NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE, -- denormalised for RLS perf
  image_storage_path  text        NULL,
  page_order          integer     NOT NULL DEFAULT 1,
  page_name           text        NULL CHECK (page_name IS NULL OR length(page_name) BETWEEN 1 AND 120),
  scale_calibration   jsonb       NULL,
  pan_zoom_state      jsonb       NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeoff_pages_session_order
  ON public.takeoff_pages(session_id, page_order);

CREATE INDEX IF NOT EXISTS idx_takeoff_pages_quote
  ON public.takeoff_pages(quote_id);

-- ----------------------------------------------------------------------------
-- 3. New columns on existing tables
-- ----------------------------------------------------------------------------

-- 3.1 companies.default_trade
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_trade public.trade NOT NULL DEFAULT 'roofing';

-- 3.2 quotes.trade + quotes.component_collection_id
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS trade public.trade NOT NULL DEFAULT 'roofing',
  ADD COLUMN IF NOT EXISTS component_collection_id uuid NULL
    REFERENCES public.component_collections(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_quotes_component_collection
  ON public.quotes(component_collection_id) WHERE component_collection_id IS NOT NULL;

-- 3.3 component_library new columns
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS collection_id uuid NULL
    REFERENCES public.component_collections(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS height_value_mm integer NULL,
  ADD COLUMN IF NOT EXISTS depth_value_mm integer NULL,
  ADD COLUMN IF NOT EXISTS waste_unit public.waste_unit NOT NULL DEFAULT 'percent',
  -- Shaun addition: material pricing strategies.
  -- Default 'per_unit' keeps every existing component behaviour-equivalent.
  ADD COLUMN IF NOT EXISTS pricing_strategy public.pricing_strategy NOT NULL DEFAULT 'per_unit',
  ADD COLUMN IF NOT EXISTS pack_price numeric(12,4) NULL,
  ADD COLUMN IF NOT EXISTS pack_size numeric(12,4) NULL,
  ADD COLUMN IF NOT EXISTS pack_coverage_m2 numeric(12,4) NULL;

CREATE INDEX IF NOT EXISTS idx_component_library_collection
  ON public.component_library(collection_id) WHERE collection_id IS NOT NULL;

-- Constraint: height_value_mm nullability is tied to measurement_type.
-- We use a single CHECK to keep the invariant in one place.
ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_height_for_lxh;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_height_for_lxh CHECK (
    (measurement_type = 'length_x_height' AND height_value_mm IS NOT NULL)
    OR
    (measurement_type <> 'length_x_height' AND height_value_mm IS NULL)
  ) NOT VALID;
-- NOT VALID: don't backfill-check existing rows. Phase 6 build path
-- VALIDATEs the constraint after the UI prevents bad input. This is
-- safe because no existing row has measurement_type='length_x_height'.

ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_depth_for_volume;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_depth_for_volume CHECK (
    (measurement_type = 'volume' AND depth_value_mm IS NOT NULL)
    OR
    (measurement_type <> 'volume' AND depth_value_mm IS NULL)
  ) NOT VALID;

-- Constraint: pricing_strategy ↔ measurement_type compatibility matrix.
-- See C2-implementation-plan.md Phase 2.4 for the rationale per row.
ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_strategy_compat;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_strategy_compat CHECK (
    pricing_strategy = 'per_unit'  -- per_unit works for ANY measurement type
    OR (pricing_strategy = 'per_pack_length'
        AND measurement_type IN ('lineal', 'multi_lineal', 'rafter', 'valley_hip', 'curved_line'))
    OR (pricing_strategy = 'per_pack_area'
        AND measurement_type IN ('area', 'length_x_height', 'irregular_area'))
    OR (pricing_strategy = 'per_pack_coverage'
        AND measurement_type IN ('area', 'length_x_height', 'irregular_area'))
    OR (pricing_strategy = 'per_pack_volume'
        AND measurement_type = 'volume')
  ) NOT VALID;
-- NOT VALID: every existing row has pricing_strategy='per_unit' (the new
-- default), which is always compatible. The constraint is enforced on new
-- INSERTs / UPDATEs immediately.

-- Constraint: pack columns nullable-in-lockstep with strategy.
ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_pack_columns;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_pack_columns CHECK (
    (pricing_strategy = 'per_unit'
      AND pack_price IS NULL AND pack_size IS NULL AND pack_coverage_m2 IS NULL)
    OR (pricing_strategy IN ('per_pack_length', 'per_pack_area', 'per_pack_volume')
      AND pack_price IS NOT NULL AND pack_size IS NOT NULL AND pack_coverage_m2 IS NULL)
    OR (pricing_strategy = 'per_pack_coverage'
      AND pack_price IS NOT NULL AND pack_size IS NOT NULL AND pack_coverage_m2 IS NOT NULL)
  ) NOT VALID;

-- 3.4 quote_component_entries: combined-entry support (Shaun addition).
ALTER TABLE public.quote_component_entries
  ADD COLUMN IF NOT EXISTS combined_from jsonb NULL,
  ADD COLUMN IF NOT EXISTS is_combined boolean NOT NULL DEFAULT false;

-- Invariant: a combined row must preserve its source data so split-back works.
ALTER TABLE public.quote_component_entries
  DROP CONSTRAINT IF EXISTS ck_quote_component_entries_combined_invariant;
ALTER TABLE public.quote_component_entries
  ADD CONSTRAINT ck_quote_component_entries_combined_invariant CHECK (
    is_combined = false OR combined_from IS NOT NULL
  );

-- 3.5 quote_takeoff_measurements: per-page tracking + draft flag.
-- page_id is nullable for backfill. Phase 7 tightens to NOT NULL AFTER
-- save_takeoff_atomic learns the page_id parameter (Gerald M-01 follow-up).
ALTER TABLE public.quote_takeoff_measurements
  ADD COLUMN IF NOT EXISTS page_id uuid NULL
    REFERENCES public.takeoff_pages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unassigned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quote_takeoff_measurements_page
  ON public.quote_takeoff_measurements(page_id) WHERE page_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. RLS — new tables follow the existing company-scoped pattern
-- ----------------------------------------------------------------------------

-- 4.1 component_collections
ALTER TABLE public.component_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "component_collections_select" ON public.component_collections;
CREATE POLICY "component_collections_select"
  ON public.component_collections FOR SELECT
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "component_collections_insert" ON public.component_collections;
CREATE POLICY "component_collections_insert"
  ON public.component_collections FOR INSERT
  WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "component_collections_update" ON public.component_collections;
CREATE POLICY "component_collections_update"
  ON public.component_collections FOR UPDATE
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "component_collections_delete" ON public.component_collections;
CREATE POLICY "component_collections_delete"
  ON public.component_collections FOR DELETE
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- 4.2 takeoff_sessions
ALTER TABLE public.takeoff_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "takeoff_sessions_company_access" ON public.takeoff_sessions;
CREATE POLICY "takeoff_sessions_company_access"
  ON public.takeoff_sessions FOR ALL
  USING (quote_id IN (
    SELECT id FROM public.quotes
    WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  ))
  WITH CHECK (quote_id IN (
    SELECT id FROM public.quotes
    WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  ));

-- 4.3 takeoff_pages
ALTER TABLE public.takeoff_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "takeoff_pages_company_access" ON public.takeoff_pages;
CREATE POLICY "takeoff_pages_company_access"
  ON public.takeoff_pages FOR ALL
  USING (quote_id IN (
    SELECT id FROM public.quotes
    WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  ))
  WITH CHECK (quote_id IN (
    SELECT id FROM public.quotes
    WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  ));

-- Open question for Gerald round-3: column-level GRANT REVOKE on
-- takeoff_pages.image_storage_path so only the SECDEF finaliser writes it?
-- Documented in D-read-site-audit.md Step 2.5.

-- ----------------------------------------------------------------------------
-- 5. Bootstrap RPC (Gerald M-02 fix)
-- ----------------------------------------------------------------------------
-- DB-concurrency-safe bootstrap. Per-company advisory lock + partial unique
-- index above mean concurrent calls cannot create duplicate bootstrap rows.
-- Service-role-only: REVOKE ALL from PUBLIC/anon/authenticated.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_company_has_collection(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collection_id uuid;
BEGIN
  -- Per-company advisory lock; released at end of transaction.
  -- hashtext is stable per session; safe to share key namespace with
  -- other per-company advisory locks because the keyspace is large.
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

  -- Re-check inside the lock.
  SELECT id INTO v_collection_id
  FROM public.component_collections
  WHERE company_id = p_company_id AND is_bootstrap = true
  LIMIT 1;

  IF v_collection_id IS NULL THEN
    INSERT INTO public.component_collections (company_id, name, is_bootstrap)
    VALUES (p_company_id, 'My Components', true)
    RETURNING id INTO v_collection_id;
  END IF;

  RETURN v_collection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_company_has_collection(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_company_has_collection(uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_company_has_collection IS
  'Generic Trades Phase 3: idempotent, DB-concurrency-safe bootstrap helper. '
  'Service-role only - call via admin client. Returns the company''s "My Components" '
  'bootstrap collection, creating it if absent under a per-company advisory lock + '
  'partial unique index on (company_id) WHERE is_bootstrap = true.';

-- ----------------------------------------------------------------------------
-- 6. Documentation comments on new tables/columns
-- ----------------------------------------------------------------------------

COMMENT ON TABLE  public.component_collections IS
  'User-managed containers for component libraries. v1: collections have NO trade and NO is_default flag. Trades and collections are picked independently at quote-create time.';
COMMENT ON COLUMN public.component_collections.is_bootstrap IS
  'True only for the auto-created "My Components" row per company. Partial unique index on (company_id) WHERE is_bootstrap = true blocks duplicates.';

COMMENT ON TABLE  public.takeoff_sessions IS
  'One session per quote (v1). takeoff_pages hangs off this for the multi-image takeoff feature.';
COMMENT ON TABLE  public.takeoff_pages IS
  'Per-page calibration + image. Each page is its own storage object (uses the existing signed-upload finaliser for quota accounting).';

COMMENT ON COLUMN public.companies.default_trade IS
  'Generic Trades Phase 2: seeds the trade dropdown on the create-quote form. NOT a per-company restriction.';
COMMENT ON COLUMN public.quotes.trade IS
  'Generic Trades Phase 2: drives terminology + measurement-type allowlist for this quote''s components.';
COMMENT ON COLUMN public.quotes.component_collection_id IS
  'Generic Trades Phase 2: the collection this quote draws components from. Nullable in Phase 2; tightened to NOT NULL in Phase 3 after every quote-create path is updated.';

COMMENT ON COLUMN public.component_library.collection_id IS
  'Generic Trades Phase 2: the collection this component belongs to. Nullable in Phase 2; tightened to NOT NULL in Phase 4 after bootstrap + backfill.';
COMMENT ON COLUMN public.component_library.pricing_strategy IS
  'Shaun addition: how this material is purchased. NOT the killed M-04 pricing_mode; orthogonal to measurement_type. See ck_component_library_strategy_compat for the compatibility matrix.';

COMMENT ON COLUMN public.quote_component_entries.combined_from IS
  'Shaun addition: source rows preserved when N entries are collapsed into one total-length-plus-waste entry, so the operation is reversible (split-back).';
COMMENT ON COLUMN public.quote_component_entries.is_combined IS
  'Shaun addition: UI flag. CHECK constraint ensures combined rows always have combined_from populated.';

COMMENT ON COLUMN public.quote_takeoff_measurements.page_id IS
  'Generic Trades Phase 2: which takeoff page this measurement was drawn on. Nullable in Phase 2; tightened to NOT NULL in Phase 7 AFTER save_takeoff_atomic learns the page_id parameter (Gerald M-01 follow-up).';
COMMENT ON COLUMN public.quote_takeoff_measurements.unassigned IS
  'Generic Trades Phase 2: draft-measurement flag. True when the user drew a measurement but hasn''t picked a component yet. Unassigned measurements do NOT contribute to quote totals.';

-- ----------------------------------------------------------------------------
-- 7. Acceptance smoke (commented — to be a runnable script in Phase 2 build)
-- ----------------------------------------------------------------------------
-- After applying:
--   1. existing roofing flow still works with both flags OFF.
--   2. new test-dark-schema-smoke.mjs creates a company -> bootstrap RPC ->
--      creates a quote via existing create_quote_atomic -> asserts:
--        quotes.trade = 'roofing'
--        quotes.component_collection_id IS NULL
--        component_collections (company_id, is_bootstrap=true) exists exactly once
--   3. test-bootstrap-concurrency.mjs spawns 5 concurrent ensure_company_has_collection
--      calls and asserts exactly one bootstrap row.
-- ----------------------------------------------------------------------------

COMMIT;

-- ============================================================================
-- End of migration. DO NOT APPLY until Gerald round-3 + Shaun signoff.
-- ============================================================================
