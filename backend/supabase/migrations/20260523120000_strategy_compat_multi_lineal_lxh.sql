-- Migration: Extend ck_component_library_strategy_compat to include multi_lineal_lxh
-- Reason: multi_lineal_lxh produces an area value (total_length × height = m²), so it is
-- compatible with per_pack_area and per_pack_coverage strategies, same as length_x_height.
-- Gerald round-6 H-02 fix.

ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_strategy_compat;

ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_strategy_compat CHECK (
    pricing_strategy = 'per_unit'  -- per_unit works for ANY measurement type
    OR (pricing_strategy = 'per_pack_length'
        AND measurement_type IN ('lineal', 'multi_lineal', 'curved_line'))
    OR (pricing_strategy = 'per_pack_area'
        AND measurement_type IN ('area', 'length_x_height', 'multi_lineal_lxh', 'irregular_area'))
    OR (pricing_strategy = 'per_pack_coverage'
        AND measurement_type IN ('area', 'length_x_height', 'multi_lineal_lxh', 'irregular_area'))
    OR (pricing_strategy = 'per_pack_volume'
        AND measurement_type = 'volume')
    -- Note: rafter/valley_hip are values of the pitch_type enum, NOT measurement_type.
    -- Earlier drafts of this CHECK referenced them by mistake; corrected before apply.
  ) NOT VALID;

COMMENT ON CONSTRAINT ck_component_library_strategy_compat ON public.component_library IS
  'Pricing strategy / measurement_type compatibility matrix. multi_lineal_lxh added to area-based pack strategies (round-6 H-02): it produces area (length × height = m²), same semantics as length_x_height.';
