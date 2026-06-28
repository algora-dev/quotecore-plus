-- Fix ck_component_library_depth_for_volume: the previous relaxation
-- (20260628120000) had wrong logic — CHECK (measurement_type <> 'volume'
-- AND depth_value_mm IS NULL) fails for volume rows because the first
-- condition is false. The correct logic: volume type can have any depth
-- (including NULL), non-volume types must have NULL depth.

ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_depth_for_volume;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_depth_for_volume CHECK (
    measurement_type = 'volume' OR depth_value_mm IS NULL
  ) NOT VALID;
