-- Migration: 20260801130000_supplier_location_ranking.sql
-- Adds location, delivery, and coverage fields to supplier_profiles
-- for ranked supplier matching (not strict filtering).

ALTER TABLE public.supplier_profiles
  -- Branch/location fields
  ADD COLUMN IF NOT EXISTS branch_city text,
  ADD COLUMN IF NOT EXISTS branch_region text,
  ADD COLUMN IF NOT EXISTS branch_postcode text,
  ADD COLUMN IF NOT EXISTS branch_country text DEFAULT 'NZ',

  -- Coverage areas (arrays)
  ADD COLUMN IF NOT EXISTS local_service_areas text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS regional_coverage text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS national_coverage boolean DEFAULT false,

  -- Delivery fields
  ADD COLUMN IF NOT EXISTS delivery_coverage text DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS freight_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS excluded_delivery_regions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delivery_requires_confirmation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_excludes_freight boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS out_of_area_pricing_allowed boolean DEFAULT true;

-- delivery_coverage values: 'local', 'regional', 'national', 'international'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_profiles_delivery_coverage_chk') THEN
    ALTER TABLE public.supplier_profiles
      ADD CONSTRAINT supplier_profiles_delivery_coverage_chk
      CHECK (delivery_coverage IN ('local', 'regional', 'national', 'international'));
  END IF;
END $$;

-- Index for city/region lookups
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_branch_city
  ON public.supplier_profiles (branch_city)
  WHERE branch_city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_profiles_branch_region
  ON public.supplier_profiles (branch_region)
  WHERE branch_region IS NOT NULL;

-- Update Apex Roofing with location data
UPDATE public.supplier_profiles
  SET branch_city = 'Christchurch',
      branch_region = 'Canterbury',
      branch_postcode = '8011',
      branch_country = 'NZ',
      local_service_areas = ARRAY['Christchurch', 'Canterbury'],
      regional_coverage = ARRAY['Canterbury', 'West Coast', 'Otago'],
      national_coverage = true,
      delivery_coverage = 'national',
      freight_available = true,
      pickup_available = true,
      delivery_requires_confirmation = true,
      pricing_excludes_freight = true,
      out_of_area_pricing_allowed = true
  WHERE slug = 'apex-roofing';
