-- Add flat_per_segment to waste_unit enum (Phase 7 multi-lineal per-segment waste).
--
-- flat_per_segment: for multi_lineal components with waste_type='fixed',
-- the fixed waste amount is multiplied by the number of segments in the
-- polyline (points.length - 1) rather than being applied once to the total.
-- This is useful for cable/conduit where each join or termination needs
-- its own tail allowance.
--
-- Applied independently (ADD VALUE auto-commits outside a transaction block).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'waste_unit' AND e.enumlabel = 'flat_per_segment'
  ) THEN
    ALTER TYPE public.waste_unit ADD VALUE 'flat_per_segment';
  END IF;
END$$;
