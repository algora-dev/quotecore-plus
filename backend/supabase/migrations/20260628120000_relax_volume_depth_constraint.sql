-- Relax ck_component_library_depth_for_volume: depth_value_mm is now OPTIONAL
-- for volume type. The "Volume" toggle in the quote builder bypasses the preset
-- depth entirely (direct m³ entry), so a component can be created without a
-- preset depth. The Area and W×H toggles still use depth if it's set; if it's
-- NULL, those toggles produce 0 volume (handled gracefully in server code).
-- Non-volume types must still NOT have depth_value_mm set.

ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_depth_for_volume;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_depth_for_volume CHECK (
    measurement_type <> 'volume' AND depth_value_mm IS NULL
  ) NOT VALID;
