-- Add Prime Roofing as a test/global demo supplier for the .com site
-- This supplier uses USD pricing and is clearly marked as a TEST supplier
-- so nobody mistakes it for real pricing.

BEGIN;

-- 1. Create a company for Prime Roofing (test supplier)
INSERT INTO companies (id, name, is_supplier, default_currency)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Prime Roofing (TEST)',
  true,
  'USD'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create the supplier profile
INSERT INTO supplier_profiles (
  company_id,
  supplier_name,
  slug,
  status,
  country,
  currency,
  tax_treatment,
  default_trade,
  instant_pricing_available,
  pricing_updated_at,
  price_valid_until,
  price_type,
  delivery_assumptions,
  exclusions,
  service_areas,
  description,
  branch_city,
  branch_region,
  branch_country,
  national_coverage,
  delivery_coverage,
  freight_available,
  pickup_available,
  delivery_requires_confirmation,
  pricing_excludes_freight,
  out_of_area_pricing_allowed,
  approved_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Prime Roofing (TEST)',
  'prime-roofing',
  'approved',
  'US',
  'USD',
  'exclusive',
  'roofing',
  true,
  NOW(),
  NOW() + INTERVAL '90 days',
  'indicative',
  'TEST DATA - delivery assumptions are illustrative only',
  'TEST DATA - no real products or services are offered. Prices are illustrative for demonstration purposes only.',
  ARRAY['Demo'],
  'TEST SUPPLIER - Prices are illustrative only and not for real quoting. This supplier exists for demonstration of the roof takeoff calculator.',
  'Auckland',  -- using a generic city name that works globally
  'Demo Region',
  'US',
  true,
  'national',
  true,
  true,
  false,
  true,
  true,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  supplier_name = EXCLUDED.supplier_name,
  status = EXCLUDED.status,
  country = EXCLUDED.country,
  currency = EXCLUDED.currency,
  instant_pricing_available = EXCLUDED.instant_pricing_available,
  pricing_updated_at = EXCLUDED.pricing_updated_at,
  price_valid_until = EXCLUDED.price_valid_until,
  description = EXCLUDED.description,
  branch_city = EXCLUDED.branch_city,
  branch_region = EXCLUDED.branch_region,
  branch_country = EXCLUDED.branch_country,
  national_coverage = EXCLUDED.national_coverage,
  delivery_coverage = EXCLUDED.delivery_coverage,
  delivery_requires_confirmation = EXCLUDED.delivery_requires_confirmation,
  pricing_excludes_freight = EXCLUDED.pricing_excludes_freight;

-- 3. Get the supplier profile ID
DO $$
DECLARE
  v_supplier_id UUID;
BEGIN
  SELECT id INTO v_supplier_id FROM supplier_profiles WHERE slug = 'prime-roofing';

  -- Delete existing components if re-running
  DELETE FROM component_library WHERE supplier_profile_id = v_supplier_id;

  -- 4. Insert 8 components matching the takeoff slots (same structure as Apex Roofing, USD prices)
  -- roof_area
  INSERT INTO component_library (
    company_id, supplier_profile_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
    pricing_strategy, takeoff_slot, sku, is_active, sort_order
  ) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_supplier_id,
    'Corrugated Metal Roofing (TEST)', 'main', 'area',
    18.50, 4.50, 10.0, 'rafter',
    'per_unit', 'roof_area', 'PR-CORR-040', true, 0
  );

  -- ridge
  INSERT INTO component_library (
    company_id, supplier_profile_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
    pricing_strategy, takeoff_slot, sku, is_active, sort_order
  ) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_supplier_id,
    'Ridge Cap (TEST)', 'main', 'lineal',
    16.00, 3.50, 5.0, 'none',
    'per_unit', 'ridge', 'PR-RTR-001', true, 1
  );

  -- hip
  INSERT INTO component_library (
    company_id, supplier_profile_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
    pricing_strategy, takeoff_slot, sku, is_active, sort_order
  ) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_supplier_id,
    'Hip Capping (TEST)', 'main', 'lineal',
    15.00, 3.50, 5.0, 'valley_hip',
    'per_unit', 'hip', 'PR-HIP-3W', true, 2
  );

  -- valley
  INSERT INTO component_library (
    company_id, supplier_profile_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
    pricing_strategy, takeoff_slot, sku, is_active, sort_order
  ) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_supplier_id,
    'Valley Flashing (TEST)', 'main', 'lineal',
    20.00, 4.00, 5.0, 'valley_hip',
    'per_unit', 'valley', 'PR-VAL-001', true, 3
  );

  -- barge
  INSERT INTO component_library (
    company_id, supplier_profile_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
    pricing_strategy, takeoff_slot, sku, is_active, sort_order
  ) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_supplier_id,
    'Barge Flashing (TEST)', 'main', 'lineal',
    14.00, 3.00, 5.0, 'rafter',
    'per_unit', 'barge', 'PR-BAR-001', true, 4
  );

  -- spouting
  INSERT INTO component_library (
    company_id, supplier_profile_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
    pricing_strategy, takeoff_slot, sku, is_active, sort_order
  ) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_supplier_id,
    'Gutter System (TEST)', 'main', 'lineal',
    24.00, 4.50, 5.0, 'none',
    'per_unit', 'spouting', 'PR-GUT-HR', true, 5
  );

  -- underlay
  INSERT INTO component_library (
    company_id, supplier_profile_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
    pricing_strategy, takeoff_slot, sku, is_active, sort_order
  ) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_supplier_id,
    'Roofing Underlay (TEST)', 'main', 'area',
    2.50, 1.00, 10.0, 'rafter',
    'per_unit', 'underlay', 'PR-UND-001', true, 6
  );

  -- fixings
  INSERT INTO component_library (
    company_id, supplier_profile_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
    pricing_strategy, takeoff_slot, sku, is_active, sort_order
  ) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_supplier_id,
    'Roofing Screws (TEST)', 'main', 'area',
    1.80, 0.80, 5.0, 'rafter',
    'per_unit', 'fixings', 'PR-TEK-50', true, 7
  );
END $$;

COMMIT;
