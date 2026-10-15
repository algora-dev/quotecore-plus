-- Quantity by Spacing and optional units-per-area display metadata.
-- Additive only. Existing components retain their current behaviour.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'measurement_type' AND e.enumlabel = 'quantity_by_spacing'
  ) THEN
    ALTER TYPE public.measurement_type ADD VALUE 'quantity_by_spacing';
  END IF;
END $$;

ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS quantity_spacing_m numeric(12,6) NULL,
  ADD COLUMN IF NOT EXISTS quantity_spacing_allowance_percent numeric(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_spacing_round_up smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS units_per_area_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS units_per_area numeric(12,6) NULL;

ALTER TABLE public.quote_components
  ADD COLUMN IF NOT EXISTS quantity_spacing_m numeric(12,6) NULL,
  ADD COLUMN IF NOT EXISTS quantity_spacing_allowance_percent numeric(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_spacing_round_up smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS units_per_area_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS units_per_area numeric(12,6) NULL,
  ADD COLUMN IF NOT EXISTS required_units numeric(14,3) NULL;

ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_quantity_spacing;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_quantity_spacing CHECK (
    (measurement_type = 'quantity_by_spacing'
      AND quantity_spacing_m IS NOT NULL
      AND quantity_spacing_m > 0
      AND quantity_spacing_allowance_percent >= 0
      AND quantity_spacing_round_up IN (1, 5, 10))
    OR measurement_type <> 'quantity_by_spacing'
  ) NOT VALID;

ALTER TABLE public.component_library
  DROP CONSTRAINT IF EXISTS ck_component_library_units_per_area;
ALTER TABLE public.component_library
  ADD CONSTRAINT ck_component_library_units_per_area CHECK (
    (units_per_area_enabled = false AND units_per_area IS NULL)
    OR (units_per_area_enabled = true AND units_per_area IS NOT NULL AND units_per_area >= 0)
  ) NOT VALID;

COMMENT ON COLUMN public.component_library.units_per_area IS
  'Canonical units per m². UI converts from the quote measurement system.';
COMMENT ON COLUMN public.quote_components.required_units IS
  'Calculated supplementary units for area components; pricing remains area-based.';
