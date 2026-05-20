-- ============================================================================
-- Generic Trades Expansion — Phase 2b: Dark Schema (UNAPPLIED)
-- ============================================================================
--
-- Status: UNAPPLIED. Awaiting Shaun signoff. Gerald round-3 patches applied
--         in-place (see "Round-3 fixes" section below).
--
-- Source plan: docs/generic-trades/C2-implementation-plan.md (patched)
-- Schema spec: docs/generic-trades/A-schema-delta.md (v2.1)
-- UX spec:     docs/generic-trades/B-ux-walkthrough.md (v2.1)
-- Audit:       docs/generic-trades/D-read-site-audit.md
-- Round-3:     C:\Users\Jimmy\.openclaw\workspace-gerald\audits\
--              quotecore-plus-generic-trades-round-3-2026-05-20\04-report.md
--
-- ----------------------------------------------------------------------------
-- Apply order
-- ----------------------------------------------------------------------------
-- This file depends on `20260520120000_generic_trades_phase_2_enums.sql`
-- having committed first. The enum split is Gerald H-01: PostgreSQL refuses
-- to use a newly-added enum value in the same transaction the value was
-- added in, so the CHECK constraints below would fail if enum extension
-- ran in the same transaction. See the enums file header for the full
-- explanation.
--
-- ----------------------------------------------------------------------------
-- Round-3 fixes applied in this file
-- ----------------------------------------------------------------------------
-- H-01: Split enum statements into a separate migration file (above).
-- H-02: component_collections RLS no longer lets authenticated users
--       create/update/delete is_bootstrap rows. Toggling, clearing, or
--       deleting bootstrap markers is service-role only.
-- H-03: Composite FKs from quotes(company_id, component_collection_id) and
--       component_library(company_id, collection_id) reference
--       component_collections(company_id, id) so cross-company links are
--       impossible at the DB layer.
-- H-04: takeoff_pages.image_storage_path UPDATE revoked from authenticated.
--       INSERT-time RLS allows NULL only; service-role finaliser writes the
--       path after verifying the uploaded object.
-- M-01: Composite FK from takeoff_pages(session_id, quote_id) to
--       takeoff_sessions(id, quote_id) so a page cannot point at one
--       session and a different quote.
-- M-02: UNIQUE(quote_id) on takeoff_sessions enforces the v1
--       "one session per quote" invariant.
-- M-05: CHECK constraints on pack_price (>= 0), pack_size (> 0), and
--       pack_coverage_m2 (> 0) prevent zero / negative pricing inputs.
--
-- ----------------------------------------------------------------------------
-- Note on `pricing_strategy` vs Gerald M-04's killed `pricing_mode`
-- ----------------------------------------------------------------------------
-- Gerald M-04 killed a proposed `pricing_mode` column that would have
-- duplicated `measurement_type` with no business use case. The new
-- `pricing_strategy` enum (defined in the companion enums file) is a
-- DIFFERENT concern: orthogonal to `measurement_type`, captures how the
-- user PURCHASES the material. See ck_component_library_strategy_compat
-- below for the compatibility matrix.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. New tables
-- ----------------------------------------------------------------------------

-- 1.1 component_collections — user-managed containers for component libraries.
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
-- company. Combined with the per-company advisory lock in the SECDEF RPC and
-- the RLS lockdown on is_bootstrap below, this is the M-02 fix.
CREATE UNIQUE INDEX IF NOT EXISTS uq_component_collections_one_bootstrap_per_company
  ON public.component_collections(company_id)
  WHERE is_bootstrap = true;

-- Composite key required by H-03 (composite FKs from quotes + component_library
-- to enforce same-company links at the DB layer).
ALTER TABLE public.component_collections
  DROP CONSTRAINT IF EXISTS uq_component_collections_company_id_pk;
ALTER TABLE public.component_collections
  ADD CONSTRAINT uq_component_collections_company_id_pk UNIQUE (company_id, id);

-- Hook into the existing updated_at trigger.
DROP TRIGGER IF EXISTS trg_component_collections_updated_at ON public.component_collections;
CREATE TRIGGER trg_component_collections_updated_at
  BEFORE UPDATE ON public.component_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 1.2 takeoff_sessions — one row per quote for v1 (multi-session deferred).
-- Round-3 M-02: UNIQUE(quote_id) enforces the one-session-per-quote invariant.
-- Round-3 M-01: UNIQUE(id, quote_id) is the composite key takeoff_pages references.
CREATE TABLE IF NOT EXISTS public.takeoff_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid        NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.takeoff_sessions
  DROP CONSTRAINT IF EXISTS uq_takeoff_sessions_quote;
ALTER TABLE public.takeoff_sessions
  ADD CONSTRAINT uq_takeoff_sessions_quote UNIQUE (quote_id);

ALTER TABLE public.takeoff_sessions
  DROP CONSTRAINT IF EXISTS uq_takeoff_sessions_id_quote;
ALTER TABLE public.takeoff_sessions
  ADD CONSTRAINT uq_takeoff_sessions_id_quote UNIQUE (id, quote_id);

-- 1.3 takeoff_pages — many pages per session. Each page is its own storage
-- object (uses the existing signed-upload finaliser flow for quota accounting).
-- Round-3 M-01: composite FK to takeoff_sessions(id, quote_id) instead of just
-- (id) so a page cannot point to session A while quote_id says B.
CREATE TABLE IF NOT EXISTS public.takeoff_pages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid        NOT NULL,
  quote_id            uuid        NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  image_storage_path  text        NULL,
  page_order          integer     NOT NULL DEFAULT 1,
  page_name           text        NULL CHECK (page_name IS NULL OR length(page_name) BETWEEN 1 AND 120),
  scale_calibration   jsonb       NULL,
  pan_zoom_state      jsonb       NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- Composite FK enforces session ↔ quote consistency at the DB layer.
  CONSTRAINT fk_takeoff_pages_session_quote
    FOREIGN KEY (session_id, quote_id)
    REFERENCES public.takeoff_sessions (id, quote_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_takeoff_pages_session_order
  ON public.takeoff_pages(session_id, page_order);

CREATE INDEX IF NOT EXISTS idx_takeoff_pages_quote
  ON public.takeoff_pages(quote_id);

-- ----------------------------------------------------------------------------
-- 2. New columns on existing tables
-- ----------------------------------------------------------------------------

-- 2.1 companies.default_trade
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_trade public.trade NOT NULL DEFAULT 'roofing';

-- 2.2 quotes.trade + quotes.component_collection_id
-- Round-3 H-03: composite FK on (company_id, component_collection_id) so a
-- buggy or malicious caller cannot link a quote to another company's collection.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS trade public.trade NOT NULL DEFAULT 'roofing',
  ADD COLUMN IF NOT EXISTS component_collection_id uuid NULL;

-- Drop simple FK if it exists (left over from any earlier draft of this file).
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_component_collection_id_fkey;

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS fk_quotes_component_collection_same_company;
ALTER TABLE public.quotes
  ADD CONSTRAINT fk_quotes_component_collection_same_company
    FOREIGN KEY (company_id, component_collection_id)
    REFERENCES public.component_collections (company_id, id)
    ON DELETE RESTRICT
    NOT VALID;
-- NOT VALID: every existing row has component_collection_id IS NULL, so the
-- constraint is trivially satisfied. New INSERTs / UPDATEs are checked
-- immediately. VALIDATE in Phase 3 after backfill.

CREATE INDEX IF NOT EXISTS idx_quotes_component_collection
  ON public.quotes(component_collection_id) WHERE component_collection_id IS NOT NULL;

-- 2.3 component_library new columns
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS collection_id uuid NULL,
  ADD COLUMN IF NOT EXISTS height_value_mm integer NULL,
  ADD COLUMN IF NOT EXISTS depth_value_mm integer NULL,
  ADD COLUMN IF NOT EXISTS waste_unit public.waste_unit NOT NULL DEFAULT 'percent',
  -- Shaun addition: material pricing strategies.
  -- Default 'per_unit' keeps every existing component behaviour-equivalent.
  ADD COLUMN IF NOT EXISTS pricing_strategy public.pricing_strategy NOT NULL DEFAULT 'per_unit',
  ADD COLUMN IF NOT EXISTS pack_price numeric(12,4) NULL,
  ADD COLUMN IF NOT EXISTS pack_size numeric(12,4) NULL,
  ADD COLUMN IF NOT EXISTS pack_coverage_m2 numeric(12,4) NULL;

-- Drop simple FK if present.
ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS component_library_collection_id_fkey;

-- Round-3 H-03: composite FK on (company_id, collection_id).
ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS fk_component_library_collection_same_company;
ALTER TABLE public.component_library
  ADD CONSTRAINT fk_component_library_collection_same_company
    FOREIGN KEY (company_id, collection_id)
    REFERENCES public.component_collections (company_id, id)
    ON DELETE RESTRICT
    NOT VALID;
-- NOT VALID: existing rows have collection_id IS NULL.

CREATE INDEX IF NOT EXISTS idx_component_library_collection
  ON public.component_library(collection_id) WHERE collection_id IS NOT NULL;

-- Round-3 M-05: positive-value CHECKs on pack columns.
-- pack_price >= 0 (zero priced sample / freebie roll is plausible; negative is not).
-- pack_size > 0 (would cause divide-by-zero in pricing engine).
-- pack_coverage_m2 > 0 (same).
ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_pack_values_positive;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_pack_values_positive CHECK (
    (pack_price IS NULL OR pack_price >= 0)
    AND (pack_size IS NULL OR pack_size > 0)
    AND (pack_coverage_m2 IS NULL OR pack_coverage_m2 > 0)
  );

-- Constraint: height_value_mm nullability is tied to measurement_type.
ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_height_for_lxh;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_height_for_lxh CHECK (
    (measurement_type = 'length_x_height' AND height_value_mm IS NOT NULL)
    OR
    (measurement_type <> 'length_x_height' AND height_value_mm IS NULL)
  ) NOT VALID;
-- NOT VALID: no existing row has measurement_type='length_x_height'.

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
-- NOT VALID: every existing row has pricing_strategy='per_unit' (the default),
-- which is always compatible. The constraint is enforced on new INSERTs /
-- UPDATEs immediately.

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

-- 2.4 quote_component_entries: combined-entry support (Shaun addition).
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

-- 2.5 quote_takeoff_measurements: per-page tracking + draft flag.
-- page_id is nullable for backfill. Phase 7 tightens to NOT NULL AFTER
-- save_takeoff_atomic learns the page_id parameter (Gerald round-2 M-01).
ALTER TABLE public.quote_takeoff_measurements
  ADD COLUMN IF NOT EXISTS page_id uuid NULL
    REFERENCES public.takeoff_pages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unassigned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quote_takeoff_measurements_page
  ON public.quote_takeoff_measurements(page_id) WHERE page_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Column-level GRANTs (Round-3 H-04: image_storage_path lockdown)
-- ----------------------------------------------------------------------------
-- Authenticated users must NOT be able to write image_storage_path directly.
-- The path is set by the existing signed-upload finaliser flow (service role)
-- after verifying ownership and stored size. The matching INSERT RLS policy
-- (below) only permits NULL image_storage_path; the finaliser updates the
-- row via service role, bypassing both column GRANT and RLS.
-- ----------------------------------------------------------------------------

REVOKE UPDATE ON public.takeoff_pages FROM authenticated;
GRANT  UPDATE (page_name, page_order, scale_calibration, pan_zoom_state, session_id)
       ON public.takeoff_pages
       TO authenticated;
-- image_storage_path, quote_id, id, created_at intentionally NOT in the
-- column whitelist. Mirrors the column-level GRANT pattern Gerald round-1
-- established on companies and support_tickets.

-- Same defensive posture on quote_id (it is set on INSERT and must never be
-- moved between quotes from user context). session_id IS whitelisted because
-- reordering pages between sessions is a legitimate user-driven action,
-- protected by the composite FK to takeoff_sessions(id, quote_id).

-- ----------------------------------------------------------------------------
-- 4. RLS — new tables follow the existing company-scoped pattern
-- ----------------------------------------------------------------------------

-- 4.1 component_collections
-- Round-3 H-02: is_bootstrap is service-role only. Authenticated users can
-- create non-bootstrap collections and rename them, but cannot toggle the
-- flag, create a row with is_bootstrap=true, delete a bootstrap row, or
-- clear the flag on an existing bootstrap row.
ALTER TABLE public.component_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "component_collections_select" ON public.component_collections;
CREATE POLICY "component_collections_select"
  ON public.component_collections FOR SELECT
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "component_collections_insert" ON public.component_collections;
CREATE POLICY "component_collections_insert"
  ON public.component_collections FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND is_bootstrap = false              -- H-02: cannot insert a bootstrap row from user context
  );

DROP POLICY IF EXISTS "component_collections_update" ON public.component_collections;
CREATE POLICY "component_collections_update"
  ON public.component_collections FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND is_bootstrap = false              -- H-02: cannot touch an existing bootstrap row
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND is_bootstrap = false              -- H-02: cannot flip the flag during an UPDATE
  );

DROP POLICY IF EXISTS "component_collections_delete" ON public.component_collections;
CREATE POLICY "component_collections_delete"
  ON public.component_collections FOR DELETE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND is_bootstrap = false              -- H-02: bootstrap row cannot be deleted by user
  );

-- Defensive: revoke column-level UPDATE on is_bootstrap so even if a future
-- policy is accidentally widened, the flag stays service-role only. Mirrors
-- the column-level GRANT pattern from Gerald round-1 (companies, support_tickets).
REVOKE UPDATE ON public.component_collections FROM authenticated;
GRANT  UPDATE (name)
       ON public.component_collections
       TO authenticated;
-- company_id, id, is_bootstrap, created_at, updated_at intentionally NOT
-- in the column whitelist.

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
-- Round-3 H-04: INSERT WITH CHECK enforces image_storage_path IS NULL so the
-- only way to set the path is via the service-role finaliser (which bypasses
-- RLS). The column GRANT above further blocks UPDATE on image_storage_path.
ALTER TABLE public.takeoff_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "takeoff_pages_select" ON public.takeoff_pages;
CREATE POLICY "takeoff_pages_select"
  ON public.takeoff_pages FOR SELECT
  USING (quote_id IN (
    SELECT id FROM public.quotes
    WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  ));

DROP POLICY IF EXISTS "takeoff_pages_insert" ON public.takeoff_pages;
CREATE POLICY "takeoff_pages_insert"
  ON public.takeoff_pages FOR INSERT
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes
      WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
    AND image_storage_path IS NULL        -- H-04: path is set by service-role finaliser
  );

DROP POLICY IF EXISTS "takeoff_pages_update" ON public.takeoff_pages;
CREATE POLICY "takeoff_pages_update"
  ON public.takeoff_pages FOR UPDATE
  USING (quote_id IN (
    SELECT id FROM public.quotes
    WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  ))
  WITH CHECK (quote_id IN (
    SELECT id FROM public.quotes
    WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  ));
-- Note: column-level GRANT above further restricts which columns the
-- authenticated UPDATE can touch (image_storage_path/quote_id excluded).

DROP POLICY IF EXISTS "takeoff_pages_delete" ON public.takeoff_pages;
CREATE POLICY "takeoff_pages_delete"
  ON public.takeoff_pages FOR DELETE
  USING (quote_id IN (
    SELECT id FROM public.quotes
    WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  ));

-- ----------------------------------------------------------------------------
-- 5. Bootstrap RPC (Gerald round-2 M-02 fix)
-- ----------------------------------------------------------------------------
-- DB-concurrency-safe bootstrap. Per-company advisory lock + partial unique
-- index above mean concurrent calls cannot create duplicate bootstrap rows.
-- The is_bootstrap RLS lockdown (round-3 H-02) means this is the ONLY path
-- that can create or touch a bootstrap collection.
-- Service-role only: REVOKE ALL from PUBLIC/anon/authenticated.
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
  'partial unique index on (company_id) WHERE is_bootstrap = true. This is the ONLY '
  'path that can create or modify a bootstrap collection (round-3 H-02 enforces this '
  'via RLS).';

-- ----------------------------------------------------------------------------
-- 6. Documentation comments on new tables/columns
-- ----------------------------------------------------------------------------

COMMENT ON TABLE  public.component_collections IS
  'User-managed containers for component libraries. v1: collections have NO trade and NO is_default flag. Trades and collections are picked independently at quote-create time.';
COMMENT ON COLUMN public.component_collections.is_bootstrap IS
  'True only for the auto-created "My Components" row per company. Partial unique index on (company_id) WHERE is_bootstrap = true blocks duplicates. RLS + column GRANT lock this to service-role only (round-3 H-02).';

COMMENT ON TABLE  public.takeoff_sessions IS
  'One session per quote (v1, enforced by UNIQUE(quote_id) — round-3 M-02). takeoff_pages hangs off this for the multi-image takeoff feature.';
COMMENT ON TABLE  public.takeoff_pages IS
  'Per-page calibration + image. Each page is its own storage object (uses the existing signed-upload finaliser for quota accounting). image_storage_path is set by the service-role finaliser only (round-3 H-04).';

COMMENT ON COLUMN public.companies.default_trade IS
  'Generic Trades Phase 2: seeds the trade dropdown on the create-quote form. NOT a per-company restriction.';
COMMENT ON COLUMN public.quotes.trade IS
  'Generic Trades Phase 2: drives terminology + measurement-type allowlist for this quote''s components.';
COMMENT ON COLUMN public.quotes.component_collection_id IS
  'Generic Trades Phase 2: the collection this quote draws components from. Nullable in Phase 2; tightened to NOT NULL in Phase 3 after every quote-create path is updated. Composite FK to (company_id, id) prevents cross-company links (round-3 H-03).';

COMMENT ON COLUMN public.component_library.collection_id IS
  'Generic Trades Phase 2: the collection this component belongs to. Nullable in Phase 2; tightened to NOT NULL in Phase 4 after bootstrap + backfill. Composite FK to (company_id, id) prevents cross-company links (round-3 H-03).';
COMMENT ON COLUMN public.component_library.pricing_strategy IS
  'Shaun addition: how this material is purchased. NOT the killed M-04 pricing_mode; orthogonal to measurement_type. See ck_component_library_strategy_compat for the compatibility matrix.';

COMMENT ON COLUMN public.quote_component_entries.combined_from IS
  'Shaun addition: source rows preserved when N entries are collapsed into one total-length-plus-waste entry, so the operation is reversible (split-back). Server-side shape validation enforced in Phase 6 (round-3 L-01).';
COMMENT ON COLUMN public.quote_component_entries.is_combined IS
  'Shaun addition: UI flag. CHECK constraint ensures combined rows always have combined_from populated.';

COMMENT ON COLUMN public.quote_takeoff_measurements.page_id IS
  'Generic Trades Phase 2: which takeoff page this measurement was drawn on. Nullable in Phase 2; tightened to NOT NULL in Phase 7 AFTER save_takeoff_atomic learns the page_id parameter (Gerald round-2 M-01 follow-up).';
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
--   4. NEW (round-3 H-02): test-bootstrap-rls.mjs attempts to:
--        a. INSERT a row with is_bootstrap=true from user context -> REJECTED.
--        b. UPDATE an existing bootstrap row's name from user context -> REJECTED.
--        c. UPDATE is_bootstrap=false on an existing bootstrap row -> REJECTED.
--        d. DELETE a bootstrap row from user context -> REJECTED.
--        e. SECDEF RPC call as service-role -> ACCEPTED, returns same id idempotently.
--   5. NEW (round-3 H-03): test-cross-company-collection-link.mjs attempts to:
--        INSERT a quote with company_id=A and component_collection_id pointing at
--        a collection in company_id=B -> REJECTED by composite FK.
--   6. NEW (round-3 H-04): test-takeoff-page-storage-path.mjs attempts to:
--        a. INSERT with image_storage_path=somethingArbitrary -> REJECTED by RLS.
--        b. UPDATE image_storage_path from user context -> REJECTED by column GRANT.
--        c. service-role finaliser SET image_storage_path -> ACCEPTED.
--   7. NEW (round-3 M-01): test-takeoff-page-session-mismatch.mjs attempts to:
--        INSERT a page with session_id=X (belonging to quote A) and quote_id=B
--        -> REJECTED by composite FK.
--   8. NEW (round-3 M-02): test-takeoff-session-uniqueness.mjs attempts to:
--        INSERT two takeoff_sessions rows for the same quote_id -> second REJECTED.
--   9. NEW (round-3 M-05): test-pack-pricing-bounds.mjs attempts to:
--        a. UPDATE pack_size=0 -> REJECTED.
--        b. UPDATE pack_size=-5 -> REJECTED.
--        c. UPDATE pack_price=-1 -> REJECTED.
--        d. UPDATE pack_coverage_m2=0 -> REJECTED.
-- ----------------------------------------------------------------------------

COMMIT;

-- ============================================================================
-- End of dark-schema migration. Apply ENUMS file first, then THIS file.
-- DO NOT APPLY until Shaun signoff.
-- ============================================================================
