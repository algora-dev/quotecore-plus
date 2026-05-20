-- ============================================================================
-- Generic Trades Expansion — Phase 2a: ENUMS ONLY (UNAPPLIED)
-- ============================================================================
--
-- Status: UNAPPLIED. Awaiting Shaun signoff after Gerald round-3 patch.
--
-- WHY THIS FILE EXISTS SEPARATELY (Gerald round-3 H-01):
--   PostgreSQL prohibits using a newly-added enum value in the SAME
--   transaction the value was added in (PG docs: "before PostgreSQL 12, an
--   ALTER TYPE ... ADD VALUE command never had any transactional effect... a
--   newly added value cannot be used in the same transaction"). Even on
--   PG 14+, ADD VALUE flushes to the catalog but the new label cannot be
--   referenced by other statements in the same transaction.
--
--   Phase 2 needs to (a) add `multi_lineal` + 7 other values to the
--   measurement_type enum, then (b) reference those values in CHECK
--   constraints on component_library. That must happen across TWO
--   committed transactions, not one.
--
--   This file commits the enum work. The next file
--   (`20260520120010_generic_trades_phase_2_dark_schema.sql`) does
--   everything else and depends on this one having committed first.
--
-- Apply order (when Shaun greenlights):
--   1. Apply THIS file (enums) via the Supabase database/query API.
--      It is intentionally NOT wrapped in BEGIN/COMMIT so each statement
--      commits independently.
--   2. Apply `20260520120010_generic_trades_phase_2_dark_schema.sql` in a
--      separate API call. That file IS transactional.
--
-- Idempotency: every CREATE TYPE is wrapped in IF NOT EXISTS guards, and
-- every ADD VALUE check uses pg_enum lookup so re-applying is safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NEW enums
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
-- NOT the killed Gerald M-04 pricing_mode. Orthogonal to measurement_type:
-- captures how the user PURCHASES the material (rolls by length, rolls by
-- area, paint-style coverage, volume-pack, or per-unit). Compatibility with
-- measurement_type is enforced by CHECK constraint in the dark-schema file.
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

-- ----------------------------------------------------------------------------
-- 2. EXTEND existing measurement_type enum
-- ----------------------------------------------------------------------------

-- Add 8 new values to the existing measurement_type enum.
-- Each ADD VALUE is wrapped in IF NOT EXISTS via pg_enum so reapplication
-- is safe. NB: AddType/AddValue statements implicitly auto-commit when run
-- without an explicit transaction block — exactly what we want here so the
-- dark-schema migration in the next file can reference the labels.
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

-- ============================================================================
-- End of enum migration. Apply `20260520120010_generic_trades_phase_2_dark_schema.sql`
-- in a SEPARATE database/query API call to land the tables, columns, and
-- CHECK constraints that reference the values above.
-- ============================================================================
