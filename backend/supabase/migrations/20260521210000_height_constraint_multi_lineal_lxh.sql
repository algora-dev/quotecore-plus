-- Extend ck_component_library_height_for_lxh to cover multi_lineal_lxh.
--
-- Original constraint required height_value_mm IS NOT NULL only for
-- length_x_height and forced it NULL for all other types.
-- multi_lineal_lxh also needs height_value_mm (area = total_length x height).
--
BEGIN;
ALTER TABLE public.component_library
  DROP CONSTRAINT ck_component_library_height_for_lxh;

ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_height_for_lxh CHECK (
    (
      measurement_type IN ('length_x_height'::measurement_type, 'multi_lineal_lxh'::measurement_type)
      AND height_value_mm IS NOT NULL
    ) OR (
      measurement_type NOT IN ('length_x_height'::measurement_type, 'multi_lineal_lxh'::measurement_type)
      AND height_value_mm IS NULL
    )
  ) NOT VALID;
COMMIT;
