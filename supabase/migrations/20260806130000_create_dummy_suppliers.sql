-- Create 4 dummy/test suppliers across different global regions
-- Each specialises in different roofing materials
-- All clearly marked as TEST suppliers with placeholder pricing
-- Pattern follows Prime Roofing migration (20260802130000)

BEGIN;

-- ============================================================
-- 1. Thames Slate & Tile (TEST) — London, UK
--    Speciality: Slate and tile roofing
--    Currency: GBP
-- ============================================================

INSERT INTO companies (id, name, is_supplier, default_currency)
VALUES ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', 'Thames Slate & Tile (TEST)', true, 'GBP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO supplier_profiles (
  company_id, supplier_name, slug, status,
  country, currency, tax_treatment, default_trade,
  instant_pricing_available, pricing_updated_at, price_valid_until, price_type,
  delivery_assumptions, exclusions,
  service_areas, roofing_types,
  description,
  branch_city, branch_region, branch_country, branch_postcode,
  national_coverage, delivery_coverage, freight_available, pickup_available,
  delivery_requires_confirmation, pricing_excludes_freight, out_of_area_pricing_allowed,
  contact_email, phone_number, website_url,
  enquiry_email, enquiries_enabled,
  publication_state, public_page_enabled, public_price_visibility,
  public_contact_visibility, public_catalogue_enabled, search_indexing_enabled,
  takeoff_builder_enabled,
  approved_at
) VALUES (
  'b1c2d3e4-f5a6-7890-abcd-ef2345678901',
  'Thames Slate & Tile (TEST)',
  'thames-slate-tile',
  'approved',
  'GB', 'GBP', 'inclusive', 'roofing',
  true, NOW(), NOW() + INTERVAL '90 days', 'indicative',
  'TEST DATA - delivery assumptions are illustrative only',
  'TEST DATA - no real products or services are offered. Prices are illustrative for demonstration purposes only.',
  ARRAY['London', 'South East', 'Home Counties'],
  ARRAY['Slate', 'Concrete Tile', 'Clay Tile'],
  'TEST SUPPLIER - Slate and tile roofing specialist serving London and the South East. Prices are illustrative only and not for real quoting. This supplier exists for demonstration of the roof takeoff calculator.',
  'London', 'Greater London', 'GB', 'EC1A 1BB',
  true, ARRAY['nationwide'], true, true,
  false, true, true,
  'test-thames@example.com', '+44 20 7946 0000', 'https://example.com',
  'test-thames@example.com', true,
  'published', true, 'web_only',
  'page_only', true, true,
  true,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  supplier_name = EXCLUDED.supplier_name,
  status = EXCLUDED.status,
  country = EXCLUDED.country,
  currency = EXCLUDED.currency,
  description = EXCLUDED.description,
  branch_city = EXCLUDED.branch_city,
  branch_region = EXCLUDED.branch_region,
  branch_country = EXCLUDED.branch_country,
  branch_postcode = EXCLUDED.branch_postcode,
  national_coverage = EXCLUDED.national_coverage,
  delivery_coverage = EXCLUDED.delivery_coverage,
  instant_pricing_available = EXCLUDED.instant_pricing_available,
  pricing_updated_at = EXCLUDED.pricing_updated_at,
  price_valid_until = EXCLUDED.price_valid_until,
  publication_state = EXCLUDED.publication_state,
  takeoff_builder_enabled = EXCLUDED.takeoff_builder_enabled;

-- Component collection for Thames Slate & Tile
INSERT INTO component_collections (
  id, company_id, name, supplier_profile_id, visibility, publication_status,
  published_at, published_version, public_slug, takeoff_enabled,
  currency, is_default_takeoff_library, public_title, public_description
) VALUES (
  'b1e00000-0000-0000-0000-000000000001',
  'b1c2d3e4-f5a6-7890-abcd-ef2345678901',
  'Thames Slate & Tile - Standard Roofing Library',
  (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'),
  'published', 'published',
  NOW(), 1, 'thames-slate-tile', true,
  'GBP', true,
  'Thames Slate & Tile Standard Library',
  'TEST DATA - Slate and tile roofing components. Prices are illustrative only.'
) ON CONFLICT (id) DO NOTHING;

UPDATE supplier_profiles
  SET default_takeoff_collection_id = 'b1e00000-0000-0000-0000-000000000001'
  WHERE slug = 'thames-slate-tile';

-- Components for Thames Slate & Tile (8 takeoff slots, GBP pricing)
INSERT INTO component_library (
  company_id, supplier_profile_id, collection_id, name, component_type, measurement_type,
  default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
  pricing_strategy, takeoff_slot, sku, is_active, sort_order, is_takeoff_default
) VALUES
  ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'), 'b1e00000-0000-0000-0000-000000000001', 'Welsh Slate (TEST)', 'main', 'area', 45.00, 12.00, 10.0, 'rafter', 'per_unit', 'roof_area', 'TST-SLA-001', true, 0, true),
  ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'), 'b1e00000-0000-0000-0000-000000000001', 'Ridge Cap (TEST)', 'main', 'lineal', 22.00, 6.00, 5.0, 'none', 'per_unit', 'ridge', 'TST-RDG-001', true, 1, true),
  ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'), 'b1e00000-0000-0000-0000-000000000001', 'Hip Capping (TEST)', 'main', 'lineal', 20.00, 6.00, 5.0, 'valley_hip', 'per_unit', 'hip', 'TST-HIP-001', true, 2, true),
  ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'), 'b1e00000-0000-0000-0000-000000000001', 'Valley Flashing (TEST)', 'main', 'lineal', 28.00, 7.00, 5.0, 'valley_hip', 'per_unit', 'valley', 'TST-VAL-001', true, 3, true),
  ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'), 'b1e00000-0000-0000-0000-000000000001', 'Barge Flashing (TEST)', 'main', 'lineal', 18.00, 5.00, 5.0, 'rafter', 'per_unit', 'barge', 'TST-BAR-001', true, 4, true),
  ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'), 'b1e00000-0000-0000-0000-000000000001', 'Gutter System (TEST)', 'main', 'lineal', 32.00, 8.00, 5.0, 'none', 'per_unit', 'spouting', 'TST-GUT-001', true, 5, true),
  ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'), 'b1e00000-0000-0000-0000-000000000001', 'Roofing Underlay (TEST)', 'main', 'area', 4.50, 1.50, 10.0, 'rafter', 'per_unit', 'underlay', 'TST-UND-001', true, 6, true),
  ('b1c2d3e4-f5a6-7890-abcd-ef2345678901', (SELECT id FROM supplier_profiles WHERE slug = 'thames-slate-tile'), 'b1e00000-0000-0000-0000-000000000001', 'Roofing Nails (TEST)', 'main', 'area', 2.20, 1.00, 5.0, 'rafter', 'per_unit', 'fixings', 'TST-NIL-001', true, 7, true);

-- Snapshot for Thames Slate & Tile
INSERT INTO supplier_takeoff_library_snapshots (supplier_profile_id, collection_id, published_version, currency, components_json)
SELECT sp.id, 'b1e00000-0000-0000-0000-000000000001', 1, 'GBP',
  jsonb_agg(jsonb_build_object('id', cl.id, 'name', cl.name, 'sku', cl.sku, 'takeoff_slot', cl.takeoff_slot, 'pricing_strategy', cl.pricing_strategy, 'default_material_rate', cl.default_material_rate, 'default_labour_rate', cl.default_labour_rate, 'default_waste_percent', cl.default_waste_percent, 'default_pitch_type', cl.default_pitch_type, 'is_takeoff_default', cl.is_takeoff_default, 'is_active', cl.is_active, 'sort_order', cl.sort_order))
FROM component_library cl, supplier_profiles sp
WHERE cl.supplier_profile_id = sp.id AND sp.slug = 'thames-slate-tile' AND cl.takeoff_slot IS NOT NULL AND cl.is_active = true
GROUP BY sp.id
ON CONFLICT (collection_id, published_version) DO NOTHING;

-- ============================================================
-- 2. Pacific Roofing Supplies (TEST) — Los Angeles, USA
--    Speciality: Clay and concrete tile, flat roofing
--    Currency: USD
-- ============================================================

INSERT INTO companies (id, name, is_supplier, default_currency)
VALUES ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', 'Pacific Roofing Supplies (TEST)', true, 'USD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO supplier_profiles (
  company_id, supplier_name, slug, status,
  country, currency, tax_treatment, default_trade,
  instant_pricing_available, pricing_updated_at, price_valid_until, price_type,
  delivery_assumptions, exclusions,
  service_areas, roofing_types,
  description,
  branch_city, branch_region, branch_country, branch_postcode,
  national_coverage, delivery_coverage, freight_available, pickup_available,
  delivery_requires_confirmation, pricing_excludes_freight, out_of_area_pricing_allowed,
  contact_email, phone_number, website_url,
  enquiry_email, enquiries_enabled,
  publication_state, public_page_enabled, public_price_visibility,
  public_contact_visibility, public_catalogue_enabled, search_indexing_enabled,
  takeoff_builder_enabled,
  approved_at
) VALUES (
  'c2d3e4f5-a6b7-7890-abcd-ef3456789012',
  'Pacific Roofing Supplies (TEST)',
  'pacific-roofing-supplies',
  'approved',
  'US', 'USD', 'exclusive', 'roofing',
  true, NOW(), NOW() + INTERVAL '90 days', 'indicative',
  'TEST DATA - delivery assumptions are illustrative only',
  'TEST DATA - no real products or services are offered. Prices are illustrative for demonstration purposes only.',
  ARRAY['Los Angeles', 'Southern California', 'Orange County'],
  ARRAY['Clay Tile', 'Concrete Tile', 'Flat Roofing', 'TPO'],
  'TEST SUPPLIER - Clay and concrete tile roofing specialist serving Southern California. Prices are illustrative only and not for real quoting. This supplier exists for demonstration of the roof takeoff calculator.',
  'Los Angeles', 'CA', 'US', '90001',
  true, ARRAY['nationwide'], true, true,
  false, true, true,
  'test-pacific@example.com', '+1 213 555 0100', 'https://example.com',
  'test-pacific@example.com', true,
  'published', true, 'web_only',
  'page_only', true, true,
  true,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  supplier_name = EXCLUDED.supplier_name,
  status = EXCLUDED.status,
  country = EXCLUDED.country,
  currency = EXCLUDED.currency,
  description = EXCLUDED.description,
  branch_city = EXCLUDED.branch_city,
  branch_region = EXCLUDED.branch_region,
  branch_country = EXCLUDED.branch_country,
  branch_postcode = EXCLUDED.branch_postcode,
  national_coverage = EXCLUDED.national_coverage,
  delivery_coverage = EXCLUDED.delivery_coverage,
  instant_pricing_available = EXCLUDED.instant_pricing_available,
  pricing_updated_at = EXCLUDED.pricing_updated_at,
  price_valid_until = EXCLUDED.price_valid_until,
  publication_state = EXCLUDED.publication_state,
  takeoff_builder_enabled = EXCLUDED.takeoff_builder_enabled;

INSERT INTO component_collections (
  id, company_id, name, supplier_profile_id, visibility, publication_status,
  published_at, published_version, public_slug, takeoff_enabled,
  currency, is_default_takeoff_library, public_title, public_description
) VALUES (
  'c2e00000-0000-0000-0000-000000000001',
  'c2d3e4f5-a6b7-7890-abcd-ef3456789012',
  'Pacific Roofing Supplies - Standard Roofing Library',
  (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'),
  'published', 'published',
  NOW(), 1, 'pacific-roofing-supplies', true,
  'USD', true,
  'Pacific Roofing Supplies Standard Library',
  'TEST DATA - Clay and concrete tile roofing components. Prices are illustrative only.'
) ON CONFLICT (id) DO NOTHING;

UPDATE supplier_profiles
  SET default_takeoff_collection_id = 'c2e00000-0000-0000-0000-000000000001'
  WHERE slug = 'pacific-roofing-supplies';

INSERT INTO component_library (
  company_id, supplier_profile_id, collection_id, name, component_type, measurement_type,
  default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
  pricing_strategy, takeoff_slot, sku, is_active, sort_order, is_takeoff_default
) VALUES
  ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'), 'c2e00000-0000-0000-0000-000000000001', 'Clay Roofing Tile (TEST)', 'main', 'area', 32.00, 8.00, 10.0, 'rafter', 'per_unit', 'roof_area', 'PRS-CLY-040', true, 0, true),
  ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'), 'c2e00000-0000-0000-0000-000000000001', 'Ridge Cap (TEST)', 'main', 'lineal', 18.00, 4.00, 5.0, 'none', 'per_unit', 'ridge', 'PRS-RDG-001', true, 1, true),
  ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'), 'c2e00000-0000-0000-0000-000000000001', 'Hip Capping (TEST)', 'main', 'lineal', 17.00, 4.00, 5.0, 'valley_hip', 'per_unit', 'hip', 'PRS-HIP-3W', true, 2, true),
  ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'), 'c2e00000-0000-0000-0000-000000000001', 'Valley Flashing (TEST)', 'main', 'lineal', 22.00, 5.00, 5.0, 'valley_hip', 'per_unit', 'valley', 'PRS-VAL-001', true, 3, true),
  ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'), 'c2e00000-0000-0000-0000-000000000001', 'Barge Flashing (TEST)', 'main', 'lineal', 15.00, 3.50, 5.0, 'rafter', 'per_unit', 'barge', 'PRS-BAR-001', true, 4, true),
  ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'), 'c2e00000-0000-0000-0000-000000000001', 'Gutter System (TEST)', 'main', 'lineal', 26.00, 5.00, 5.0, 'none', 'per_unit', 'spouting', 'PRS-GUT-HR', true, 5, true),
  ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'), 'c2e00000-0000-0000-0000-000000000001', 'Roofing Underlay (TEST)', 'main', 'area', 3.00, 1.20, 10.0, 'rafter', 'per_unit', 'underlay', 'PRS-UND-001', true, 6, true),
  ('c2d3e4f5-a6b7-7890-abcd-ef3456789012', (SELECT id FROM supplier_profiles WHERE slug = 'pacific-roofing-supplies'), 'c2e00000-0000-0000-0000-000000000001', 'Roofing Screws (TEST)', 'main', 'area', 2.00, 0.80, 5.0, 'rafter', 'per_unit', 'fixings', 'PRS-TEK-50', true, 7, true);

INSERT INTO supplier_takeoff_library_snapshots (supplier_profile_id, collection_id, published_version, currency, components_json)
SELECT sp.id, 'c2e00000-0000-0000-0000-000000000001', 1, 'USD',
  jsonb_agg(jsonb_build_object('id', cl.id, 'name', cl.name, 'sku', cl.sku, 'takeoff_slot', cl.takeoff_slot, 'pricing_strategy', cl.pricing_strategy, 'default_material_rate', cl.default_material_rate, 'default_labour_rate', cl.default_labour_rate, 'default_waste_percent', cl.default_waste_percent, 'default_pitch_type', cl.default_pitch_type, 'is_takeoff_default', cl.is_takeoff_default, 'is_active', cl.is_active, 'sort_order', cl.sort_order))
FROM component_library cl, supplier_profiles sp
WHERE cl.supplier_profile_id = sp.id AND sp.slug = 'pacific-roofing-supplies' AND cl.takeoff_slot IS NOT NULL AND cl.is_active = true
GROUP BY sp.id
ON CONFLICT (collection_id, published_version) DO NOTHING;

-- ============================================================
-- 3. Empire Roofing Materials (TEST) — New York, USA
--    Speciality: Asphalt shingle roofing
--    Currency: USD
-- ============================================================

INSERT INTO companies (id, name, is_supplier, default_currency)
VALUES ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', 'Empire Roofing Materials (TEST)', true, 'USD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO supplier_profiles (
  company_id, supplier_name, slug, status,
  country, currency, tax_treatment, default_trade,
  instant_pricing_available, pricing_updated_at, price_valid_until, price_type,
  delivery_assumptions, exclusions,
  service_areas, roofing_types,
  description,
  branch_city, branch_region, branch_country, branch_postcode,
  national_coverage, delivery_coverage, freight_available, pickup_available,
  delivery_requires_confirmation, pricing_excludes_freight, out_of_area_pricing_allowed,
  contact_email, phone_number, website_url,
  enquiry_email, enquiries_enabled,
  publication_state, public_page_enabled, public_price_visibility,
  public_contact_visibility, public_catalogue_enabled, search_indexing_enabled,
  takeoff_builder_enabled,
  approved_at
) VALUES (
  'd3e4f5a6-b7c8-7890-abcd-ef4567890123',
  'Empire Roofing Materials (TEST)',
  'empire-roofing-materials',
  'approved',
  'US', 'USD', 'exclusive', 'roofing',
  true, NOW(), NOW() + INTERVAL '90 days', 'indicative',
  'TEST DATA - delivery assumptions are illustrative only',
  'TEST DATA - no real products or services are offered. Prices are illustrative for demonstration purposes only.',
  ARRAY['New York', 'New Jersey', 'Connecticut', 'Tri-State Area'],
  ARRAY['Asphalt Shingle', 'Architectural Shingle', 'Flat Roofing'],
  'TEST SUPPLIER - Asphalt shingle roofing specialist serving the New York Tri-State area. Prices are illustrative only and not for real quoting. This supplier exists for demonstration of the roof takeoff calculator.',
  'New York', 'NY', 'US', '10001',
  true, ARRAY['nationwide'], true, true,
  false, true, true,
  'test-empire@example.com', '+1 212 555 0100', 'https://example.com',
  'test-empire@example.com', true,
  'published', true, 'web_only',
  'page_only', true, true,
  true,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  supplier_name = EXCLUDED.supplier_name,
  status = EXCLUDED.status,
  country = EXCLUDED.country,
  currency = EXCLUDED.currency,
  description = EXCLUDED.description,
  branch_city = EXCLUDED.branch_city,
  branch_region = EXCLUDED.branch_region,
  branch_country = EXCLUDED.branch_country,
  branch_postcode = EXCLUDED.branch_postcode,
  national_coverage = EXCLUDED.national_coverage,
  delivery_coverage = EXCLUDED.delivery_coverage,
  instant_pricing_available = EXCLUDED.instant_pricing_available,
  pricing_updated_at = EXCLUDED.pricing_updated_at,
  price_valid_until = EXCLUDED.price_valid_until,
  publication_state = EXCLUDED.publication_state,
  takeoff_builder_enabled = EXCLUDED.takeoff_builder_enabled;

INSERT INTO component_collections (
  id, company_id, name, supplier_profile_id, visibility, publication_status,
  published_at, published_version, public_slug, takeoff_enabled,
  currency, is_default_takeoff_library, public_title, public_description
) VALUES (
  'd3e00000-0000-0000-0000-000000000001',
  'd3e4f5a6-b7c8-7890-abcd-ef4567890123',
  'Empire Roofing Materials - Standard Roofing Library',
  (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'),
  'published', 'published',
  NOW(), 1, 'empire-roofing-materials', true,
  'USD', true,
  'Empire Roofing Materials Standard Library',
  'TEST DATA - Asphalt shingle roofing components. Prices are illustrative only.'
) ON CONFLICT (id) DO NOTHING;

UPDATE supplier_profiles
  SET default_takeoff_collection_id = 'd3e00000-0000-0000-0000-000000000001'
  WHERE slug = 'empire-roofing-materials';

INSERT INTO component_library (
  company_id, supplier_profile_id, collection_id, name, component_type, measurement_type,
  default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
  pricing_strategy, takeoff_slot, sku, is_active, sort_order, is_takeoff_default
) VALUES
  ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'), 'd3e00000-0000-0000-0000-000000000001', 'Architectural Shingle (TEST)', 'main', 'area', 14.00, 5.00, 12.0, 'rafter', 'per_unit', 'roof_area', 'ERM-SHN-040', true, 0, true),
  ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'), 'd3e00000-0000-0000-0000-000000000001', 'Ridge Cap Shingle (TEST)', 'main', 'lineal', 12.00, 4.00, 5.0, 'none', 'per_unit', 'ridge', 'ERM-RDG-001', true, 1, true),
  ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'), 'd3e00000-0000-0000-0000-000000000001', 'Hip Capping (TEST)', 'main', 'lineal', 11.00, 4.00, 5.0, 'valley_hip', 'per_unit', 'hip', 'ERM-HIP-3W', true, 2, true),
  ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'), 'd3e00000-0000-0000-0000-000000000001', 'Valley Flashing (TEST)', 'main', 'lineal', 16.00, 5.00, 5.0, 'valley_hip', 'per_unit', 'valley', 'ERM-VAL-001', true, 3, true),
  ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'), 'd3e00000-0000-0000-0000-000000000001', 'Drip Edge (TEST)', 'main', 'lineal', 8.00, 2.50, 5.0, 'rafter', 'per_unit', 'barge', 'ERM-BAR-001', true, 4, true),
  ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'), 'd3e00000-0000-0000-0000-000000000001', 'Gutter System (TEST)', 'main', 'lineal', 20.00, 4.50, 5.0, 'none', 'per_unit', 'spouting', 'ERM-GUT-HR', true, 5, true),
  ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'), 'd3e00000-0000-0000-0000-000000000001', 'Roofing Underlayment (TEST)', 'main', 'area', 2.00, 0.80, 10.0, 'rafter', 'per_unit', 'underlay', 'ERM-UND-001', true, 6, true),
  ('d3e4f5a6-b7c8-7890-abcd-ef4567890123', (SELECT id FROM supplier_profiles WHERE slug = 'empire-roofing-materials'), 'd3e00000-0000-0000-0000-000000000001', 'Roofing Nails (TEST)', 'main', 'area', 1.20, 0.50, 5.0, 'rafter', 'per_unit', 'fixings', 'ERM-NIL-001', true, 7, true);

INSERT INTO supplier_takeoff_library_snapshots (supplier_profile_id, collection_id, published_version, currency, components_json)
SELECT sp.id, 'd3e00000-0000-0000-0000-000000000001', 1, 'USD',
  jsonb_agg(jsonb_build_object('id', cl.id, 'name', cl.name, 'sku', cl.sku, 'takeoff_slot', cl.takeoff_slot, 'pricing_strategy', cl.pricing_strategy, 'default_material_rate', cl.default_material_rate, 'default_labour_rate', cl.default_labour_rate, 'default_waste_percent', cl.default_waste_percent, 'default_pitch_type', cl.default_pitch_type, 'is_takeoff_default', cl.is_takeoff_default, 'is_active', cl.is_active, 'sort_order', cl.sort_order))
FROM component_library cl, supplier_profiles sp
WHERE cl.supplier_profile_id = sp.id AND sp.slug = 'empire-roofing-materials' AND cl.takeoff_slot IS NOT NULL AND cl.is_active = true
GROUP BY sp.id
ON CONFLICT (collection_id, published_version) DO NOTHING;

-- ============================================================
-- 4. Harbour Metal Roofing (TEST) — Sydney, Australia
--    Speciality: Metal roofing (Colorbond/steel)
--    Currency: AUD
-- ============================================================

INSERT INTO companies (id, name, is_supplier, default_currency)
VALUES ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', 'Harbour Metal Roofing (TEST)', true, 'AUD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO supplier_profiles (
  company_id, supplier_name, slug, status,
  country, currency, tax_treatment, default_trade,
  instant_pricing_available, pricing_updated_at, price_valid_until, price_type,
  delivery_assumptions, exclusions,
  service_areas, roofing_types,
  description,
  branch_city, branch_region, branch_country, branch_postcode,
  national_coverage, delivery_coverage, freight_available, pickup_available,
  delivery_requires_confirmation, pricing_excludes_freight, out_of_area_pricing_allowed,
  contact_email, phone_number, website_url,
  enquiry_email, enquiries_enabled,
  publication_state, public_page_enabled, public_price_visibility,
  public_contact_visibility, public_catalogue_enabled, search_indexing_enabled,
  takeoff_builder_enabled,
  approved_at
) VALUES (
  'e4f5a6b7-c8d9-7890-abcd-ef5678901234',
  'Harbour Metal Roofing (TEST)',
  'harbour-metal-roofing',
  'approved',
  'AU', 'AUD', 'inclusive', 'roofing',
  true, NOW(), NOW() + INTERVAL '90 days', 'indicative',
  'TEST DATA - delivery assumptions are illustrative only',
  'TEST DATA - no real products or services are offered. Prices are illustrative for demonstration purposes only.',
  ARRAY['Sydney', 'NSW', 'Wollongong', 'Newcastle'],
  ARRAY['Colorbond Steel', 'Corrugated Iron', 'Standing Seam'],
  'TEST SUPPLIER - Metal roofing specialist serving Sydney and NSW. Specialises in Colorbond and corrugated steel roofing. Prices are illustrative only and not for real quoting. This supplier exists for demonstration of the roof takeoff calculator.',
  'Sydney', 'NSW', 'AU', '2000',
  true, ARRAY['nationwide'], true, true,
  false, true, true,
  'test-harbour@example.com', '+61 2 8000 0000', 'https://example.com',
  'test-harbour@example.com', true,
  'published', true, 'web_only',
  'page_only', true, true,
  true,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  supplier_name = EXCLUDED.supplier_name,
  status = EXCLUDED.status,
  country = EXCLUDED.country,
  currency = EXCLUDED.currency,
  description = EXCLUDED.description,
  branch_city = EXCLUDED.branch_city,
  branch_region = EXCLUDED.branch_region,
  branch_country = EXCLUDED.branch_country,
  branch_postcode = EXCLUDED.branch_postcode,
  national_coverage = EXCLUDED.national_coverage,
  delivery_coverage = EXCLUDED.delivery_coverage,
  instant_pricing_available = EXCLUDED.instant_pricing_available,
  pricing_updated_at = EXCLUDED.pricing_updated_at,
  price_valid_until = EXCLUDED.price_valid_until,
  publication_state = EXCLUDED.publication_state,
  takeoff_builder_enabled = EXCLUDED.takeoff_builder_enabled;

INSERT INTO component_collections (
  id, company_id, name, supplier_profile_id, visibility, publication_status,
  published_at, published_version, public_slug, takeoff_enabled,
  currency, is_default_takeoff_library, public_title, public_description
) VALUES (
  'e4e00000-0000-0000-0000-000000000001',
  'e4f5a6b7-c8d9-7890-abcd-ef5678901234',
  'Harbour Metal Roofing - Standard Roofing Library',
  (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'),
  'published', 'published',
  NOW(), 1, 'harbour-metal-roofing', true,
  'AUD', true,
  'Harbour Metal Roofing Standard Library',
  'TEST DATA - Metal roofing components (Colorbond/steel). Prices are illustrative only.'
) ON CONFLICT (id) DO NOTHING;

UPDATE supplier_profiles
  SET default_takeoff_collection_id = 'e4e00000-0000-0000-0000-000000000001'
  WHERE slug = 'harbour-metal-roofing';

INSERT INTO component_library (
  company_id, supplier_profile_id, collection_id, name, component_type, measurement_type,
  default_material_rate, default_labour_rate, default_waste_percent, default_pitch_type,
  pricing_strategy, takeoff_slot, sku, is_active, sort_order, is_takeoff_default
) VALUES
  ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'), 'e4e00000-0000-0000-0000-000000000001', 'Colorbond Corrugated Steel (TEST)', 'main', 'area', 28.00, 7.00, 10.0, 'rafter', 'per_unit', 'roof_area', 'HMR-COL-040', true, 0, true),
  ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'), 'e4e00000-0000-0000-0000-000000000001', 'Ridge Cap (TEST)', 'main', 'lineal', 22.00, 5.00, 5.0, 'none', 'per_unit', 'ridge', 'HMR-RDG-001', true, 1, true),
  ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'), 'e4e00000-0000-0000-0000-000000000001', 'Hip Capping (TEST)', 'main', 'lineal', 20.00, 5.00, 5.0, 'valley_hip', 'per_unit', 'hip', 'HMR-HIP-3W', true, 2, true),
  ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'), 'e4e00000-0000-0000-0000-000000000001', 'Valley Flashing (TEST)', 'main', 'lineal', 26.00, 6.00, 5.0, 'valley_hip', 'per_unit', 'valley', 'HMR-VAL-001', true, 3, true),
  ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'), 'e4e00000-0000-0000-0000-000000000001', 'Barge Flashing (TEST)', 'main', 'lineal', 18.00, 4.50, 5.0, 'rafter', 'per_unit', 'barge', 'HMR-BAR-001', true, 4, true),
  ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'), 'e4e00000-0000-0000-0000-000000000001', 'Gutter System (TEST)', 'main', 'lineal', 30.00, 6.00, 5.0, 'none', 'per_unit', 'spouting', 'HMR-GUT-HR', true, 5, true),
  ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'), 'e4e00000-0000-0000-0000-000000000001', 'Roofing Underlay (TEST)', 'main', 'area', 3.50, 1.20, 10.0, 'rafter', 'per_unit', 'underlay', 'HMR-UND-001', true, 6, true),
  ('e4f5a6b7-c8d9-7890-abcd-ef5678901234', (SELECT id FROM supplier_profiles WHERE slug = 'harbour-metal-roofing'), 'e4e00000-0000-0000-0000-000000000001', 'Roofing Screws (TEST)', 'main', 'area', 2.00, 0.80, 5.0, 'rafter', 'per_unit', 'fixings', 'HMR-TEK-50', true, 7, true);

INSERT INTO supplier_takeoff_library_snapshots (supplier_profile_id, collection_id, published_version, currency, components_json)
SELECT sp.id, 'e4e00000-0000-0000-0000-000000000001', 1, 'AUD',
  jsonb_agg(jsonb_build_object('id', cl.id, 'name', cl.name, 'sku', cl.sku, 'takeoff_slot', cl.takeoff_slot, 'pricing_strategy', cl.pricing_strategy, 'default_material_rate', cl.default_material_rate, 'default_labour_rate', cl.default_labour_rate, 'default_waste_percent', cl.default_waste_percent, 'default_pitch_type', cl.default_pitch_type, 'is_takeoff_default', cl.is_takeoff_default, 'is_active', cl.is_active, 'sort_order', cl.sort_order))
FROM component_library cl, supplier_profiles sp
WHERE cl.supplier_profile_id = sp.id AND sp.slug = 'harbour-metal-roofing' AND cl.takeoff_slot IS NOT NULL AND cl.is_active = true
GROUP BY sp.id
ON CONFLICT (collection_id, published_version) DO NOTHING;

COMMIT;
