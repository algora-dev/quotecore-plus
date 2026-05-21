-- ============================================================================
-- Add fixed_per_segment to waste_type enum + multi_lineal_lxh to
-- measurement_type enum.
--
-- fixed_per_segment (waste_type): applies the fixed waste amount once per
--   polyline segment rather than once to the total. Used for multi-line
--   components where each joint/termination needs its own waste allowance.
--
-- multi_lineal_lxh (measurement_type): same polyline canvas tool as
--   multi_lineal, but stores area = sum(segment_length × height_m) instead
--   of total length. Height comes from component_library.height_value_mm.
--   Used for fencing, walls, guttering — anything with fixed height runs.
--
-- Both ADD VALUE calls auto-commit (no explicit transaction), then the
-- CHECK constraint update runs in its own block.
-- ============================================================================

-- 1. Add fixed_per_segment to waste_type enum (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'waste_type' AND e.enumlabel = 'fixed_per_segment'
  ) THEN
    ALTER TYPE public.waste_type ADD VALUE 'fixed_per_segment';
  END IF;
END$$;

-- 2. Add multi_lineal_lxh to measurement_type enum (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'measurement_type' AND e.enumlabel = 'multi_lineal_lxh'
  ) THEN
    ALTER TYPE public.measurement_type ADD VALUE 'multi_lineal_lxh';
  END IF;
END$$;

-- 3. Extend quote_takeoff_measurements.measurement_type CHECK (text column).
ALTER TABLE public.quote_takeoff_measurements
  DROP CONSTRAINT quote_takeoff_measurements_measurement_type_check;

ALTER TABLE public.quote_takeoff_measurements
  ADD CONSTRAINT quote_takeoff_measurements_measurement_type_check
  CHECK (measurement_type = ANY (ARRAY[
    'line'::text,
    'area'::text,
    'point'::text,
    'multi_lineal'::text,
    'multi_lineal_lxh'::text   -- Phase 7+: polyline × height area tool
  ]));
