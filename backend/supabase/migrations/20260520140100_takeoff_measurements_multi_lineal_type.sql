-- Extend quote_takeoff_measurements.measurement_type CHECK to include
-- 'multi_lineal' (Phase 7 polyline tool). Previously only 'line', 'area',
-- 'point' were accepted.
ALTER TABLE public.quote_takeoff_measurements
  DROP CONSTRAINT quote_takeoff_measurements_measurement_type_check;

ALTER TABLE public.quote_takeoff_measurements
  ADD CONSTRAINT quote_takeoff_measurements_measurement_type_check
  CHECK (measurement_type = ANY (ARRAY[
    'line'::text,
    'area'::text,
    'point'::text,
    'multi_lineal'::text   -- Phase 7: polyline tool
  ]));
