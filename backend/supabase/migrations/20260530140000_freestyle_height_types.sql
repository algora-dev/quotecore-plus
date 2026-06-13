-- Add length_x_height_freestyle and multi_lineal_lxh_freestyle measurement types.
-- These are "freestyle" variants where the user enters the height at measurement
-- time (canvas prompt or manual builder), rather than having a preset height
-- stored on the component_library row (height_value_mm).
--
-- Also extends quote_takeoff_measurements.measurement_type_check to include
-- volume_3d (was missing) plus the two new freestyle types.

-- 1. Add enum values for component_library.measurement_type
ALTER TYPE public.measurement_type ADD VALUE IF NOT EXISTS 'length_x_height_freestyle';
ALTER TYPE public.measurement_type ADD VALUE IF NOT EXISTS 'multi_lineal_lxh_freestyle';

-- 2. Extend the text CHECK constraint on quote_takeoff_measurements.measurement_type
--    (this is a text column, not the enum - it uses a CHECK constraint).
ALTER TABLE public.quote_takeoff_measurements
  DROP CONSTRAINT IF EXISTS quote_takeoff_measurements_measurement_type_check;

ALTER TABLE public.quote_takeoff_measurements
  ADD CONSTRAINT quote_takeoff_measurements_measurement_type_check
  CHECK (measurement_type = ANY (ARRAY[
    'line'::text,
    'area'::text,
    'point'::text,
    'multi_lineal'::text,
    'multi_lineal_lxh'::text,
    'volume_3d'::text,
    'length_x_height_freestyle'::text,
    'multi_lineal_lxh_freestyle'::text
  ]));
