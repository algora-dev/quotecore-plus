-- ============================================================================
-- P1-1b: extend quote_files file_type allowlist for takeoff canvas images
-- ============================================================================
-- The original constraint only allowed 'logo', 'plan', 'supporting'.
-- saveTakeoffMeasurements now creates quote_files records for every canvas
-- save so all takeoff snapshots appear in Files & Documents. Those records
-- use 'takeoff_canvas' and 'takeoff_lines' as file_type values.
-- ============================================================================

BEGIN;

ALTER TABLE public.quote_files
  DROP CONSTRAINT IF EXISTS quote_files_file_type_check;

ALTER TABLE public.quote_files
  ADD CONSTRAINT quote_files_file_type_check
  CHECK (file_type = ANY (ARRAY[
    'logo'::text,
    'plan'::text,
    'supporting'::text,
    'takeoff_canvas'::text,
    'takeoff_lines'::text
  ]));

COMMIT;
