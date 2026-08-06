-- Update unit_system and component units/pricing for US suppliers
-- Pacific Roofing (LA) -> imperial (sq ft / ft)
-- Empire Roofing (NY) -> squares
-- Thames Slate & Tile (London) -> metric (already correct)
-- Harbour Metal Roofing (Sydney) -> metric (already correct)

BEGIN;

-- ============================================================
-- 1. Pacific Roofing Supplies (LA) -> imperial
-- ============================================================
UPDATE component_collections
  SET unit_system = 'imperial'
  WHERE public_slug = 'pacific-roofing-supplies';

-- Update pricing to per-sqft / per-ft (realistic US pricing)
-- Clay tile: ~$3.00/sqft material, $0.75/sqft labour
UPDATE component_library
  SET default_material_rate = 3.00, default_labour_rate = 0.75
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies')
    AND takeoff_slot = 'roof_area';

-- Ridge cap: ~$1.50/ft material, $0.35/ft labour
UPDATE component_library
  SET default_material_rate = 1.50, default_labour_rate = 0.35
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies')
    AND takeoff_slot = 'ridge';

-- Hip capping: ~$1.40/ft material, $0.35/ft labour
UPDATE component_library
  SET default_material_rate = 1.40, default_labour_rate = 0.35
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies')
    AND takeoff_slot = 'hip';

-- Valley flashing: ~$1.80/ft material, $0.45/ft labour
UPDATE component_library
  SET default_material_rate = 1.80, default_labour_rate = 0.45
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies')
    AND takeoff_slot = 'valley';

-- Barge flashing: ~$1.25/ft material, $0.30/ft labour
UPDATE component_library
  SET default_material_rate = 1.25, default_labour_rate = 0.30
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies')
    AND takeoff_slot = 'barge';

-- Gutter: ~$2.20/ft material, $0.45/ft labour
UPDATE component_library
  SET default_material_rate = 2.20, default_labour_rate = 0.45
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies')
    AND takeoff_slot = 'spouting';

-- Underlay: ~$0.30/sqft material, $0.12/sqft labour
UPDATE component_library
  SET default_material_rate = 0.30, default_labour_rate = 0.12
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies')
    AND takeoff_slot = 'underlay';

-- Fixings: ~$0.20/sqft material, $0.08/sqft labour
UPDATE component_library
  SET default_material_rate = 0.20, default_labour_rate = 0.08
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies')
    AND takeoff_slot = 'fixings';

-- ============================================================
-- 2. Empire Roofing Materials (NY) -> squares
-- ============================================================
UPDATE component_collections
  SET unit_system = 'squares'
  WHERE public_slug = 'empire-roofing-materials';

-- Update pricing to per-square / per-ft (realistic US asphalt shingle pricing)
-- Architectural shingle: ~$100/square material, ~$35/square labour
UPDATE component_library
  SET default_material_rate = 100.00, default_labour_rate = 35.00
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials')
    AND takeoff_slot = 'roof_area';

-- Ridge cap: ~$2.50/ft material, $0.80/ft labour
UPDATE component_library
  SET default_material_rate = 2.50, default_labour_rate = 0.80
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials')
    AND takeoff_slot = 'ridge';

-- Hip capping: ~$2.20/ft material, $0.80/ft labour
UPDATE component_library
  SET default_material_rate = 2.20, default_labour_rate = 0.80
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials')
    AND takeoff_slot = 'hip';

-- Valley flashing: ~$3.20/ft material, $1.00/ft labour
UPDATE component_library
  SET default_material_rate = 3.20, default_labour_rate = 1.00
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials')
    AND takeoff_slot = 'valley';

-- Drip edge (barge): ~$1.60/ft material, $0.50/ft labour
UPDATE component_library
  SET default_material_rate = 1.60, default_labour_rate = 0.50
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials')
    AND takeoff_slot = 'barge';

-- Gutter: ~$4.00/ft material, $0.90/ft labour
UPDATE component_library
  SET default_material_rate = 4.00, default_labour_rate = 0.90
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials')
    AND takeoff_slot = 'spouting';

-- Underlayment: ~$15/square material, $5/square labour
UPDATE component_library
  SET default_material_rate = 15.00, default_labour_rate = 5.00
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials')
    AND takeoff_slot = 'underlay';

-- Nails: ~$8/square material, $3/square labour
UPDATE component_library
  SET default_material_rate = 8.00, default_labour_rate = 3.00
  WHERE supplier_profile_id = (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials')
    AND takeoff_slot = 'fixings';

-- ============================================================
-- 3. Refresh snapshots for both updated suppliers
-- ============================================================
-- Delete old snapshots
DELETE FROM supplier_takeoff_library_snapshots
  WHERE collection_id IN ('c2e00000-0000-0000-0000-000000000001', 'd3e00000-0000-0000-0000-000000000001');

-- Re-insert Pacific snapshot (imperial)
INSERT INTO supplier_takeoff_library_snapshots (supplier_profile_id, collection_id, published_version, currency, components_json)
SELECT sp.id, 'c2e00000-0000-0000-0000-000000000001', 1, 'USD',
  jsonb_agg(jsonb_build_object('id', cl.id, 'name', cl.name, 'sku', cl.sku, 'takeoff_slot', cl.takeoff_slot, 'pricing_strategy', cl.pricing_strategy, 'default_material_rate', cl.default_material_rate, 'default_labour_rate', cl.default_labour_rate, 'default_waste_percent', cl.default_waste_percent, 'default_pitch_type', cl.default_pitch_type, 'is_takeoff_default', cl.is_takeoff_default, 'is_active', cl.is_active, 'sort_order', cl.sort_order))
FROM component_library cl, supplier_profiles sp
WHERE cl.supplier_profile_id = sp.id AND sp.slug = 'pacific-roofing-supplies' AND cl.takeoff_slot IS NOT NULL AND cl.is_active = true
GROUP BY sp.id;

-- Re-insert Empire snapshot (squares)
INSERT INTO supplier_takeoff_library_snapshots (supplier_profile_id, collection_id, published_version, currency, components_json)
SELECT sp.id, 'd3e00000-0000-0000-0000-000000000001', 1, 'USD',
  jsonb_agg(jsonb_build_object('id', cl.id, 'name', cl.name, 'sku', cl.sku, 'takeoff_slot', cl.takeoff_slot, 'pricing_strategy', cl.pricing_strategy, 'default_material_rate', cl.default_material_rate, 'default_labour_rate', cl.default_labour_rate, 'default_waste_percent', cl.default_waste_percent, 'default_pitch_type', cl.default_pitch_type, 'is_takeoff_default', cl.is_takeoff_default, 'is_active', cl.is_active, 'sort_order', cl.sort_order))
FROM component_library cl, supplier_profiles sp
WHERE cl.supplier_profile_id = sp.id AND sp.slug = 'empire-roofing-materials' AND cl.takeoff_slot IS NOT NULL AND cl.is_active = true
GROUP BY sp.id;

COMMIT;
