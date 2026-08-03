-- Migration: 20260803140000_seed_takeoff_libraries.sql
-- Create published takeoff collections for Apex Roofing and Prime Roofing,
-- link their existing components to the collections, and set defaults.

-- ============================================================
-- Apex Roofing (f301c796-3ebb-4a8a-bf10-b1f9ac6223d5)
-- ============================================================
INSERT INTO public.component_collections (
  id, company_id, name, supplier_profile_id, visibility, publication_status,
  published_at, published_version, public_slug, takeoff_enabled,
  currency, is_default_takeoff_library, public_title, public_description
) VALUES (
  'a1e00000-0000-0000-0000-000000000001',
  'dd3b3943-c760-4c21-9a9a-3a516d0c3356',
  'Apex Roofing - Standard Roofing Library',
  'f301c796-3ebb-4a8a-bf10-b1f9ac6223d5',
  'published', 'published',
  now(), 1, 'apex-roofing', true,
  'NZD', true,
  'Apex Roofing Standard Library',
  'Roofing components and pricing from Apex Roofing, Christchurch NZ.'
) ON CONFLICT (id) DO NOTHING;

-- Set default_takeoff_collection_id on supplier profile
UPDATE public.supplier_profiles
  SET default_takeoff_collection_id = 'a1e00000-0000-0000-0000-000000000001'
  WHERE id = 'f301c796-3ebb-4a8a-bf10-b1f9ac6223d5';

-- Link Apex components to the collection and set takeoff defaults
UPDATE public.component_library
  SET collection_id = 'a1e00000-0000-0000-0000-000000000001',
      is_takeoff_default = true
  WHERE supplier_profile_id = 'f301c796-3ebb-4a8a-bf10-b1f9ac6223d5'
    AND takeoff_slot IS NOT NULL
    AND is_active = true;

-- Create initial snapshot for Apex
INSERT INTO public.supplier_takeoff_library_snapshots (
  supplier_profile_id, collection_id, published_version, currency, components_json
)
SELECT
  'f301c796-3ebb-4a8a-bf10-b1f9ac6223d5',
  'a1e00000-0000-0000-0000-000000000001',
  1,
  'NZD',
  jsonb_agg(
    jsonb_build_object(
      'id', cl.id,
      'name', cl.name,
      'sku', cl.sku,
      'takeoff_slot', cl.takeoff_slot,
      'pricing_strategy', cl.pricing_strategy,
      'default_material_rate', cl.default_material_rate,
      'pack_size', cl.pack_size,
      'pack_price', cl.pack_price,
      'default_labour_rate', cl.default_labour_rate,
      'default_waste_percent', cl.default_waste_percent,
      'default_pitch_type', cl.default_pitch_type,
      'is_takeoff_default', cl.is_takeoff_default,
      'is_active', cl.is_active,
      'sort_order', cl.sort_order
    )
  )
FROM public.component_library cl
WHERE cl.supplier_profile_id = 'f301c796-3ebb-4a8a-bf10-b1f9ac6223d5'
  AND cl.takeoff_slot IS NOT NULL
  AND cl.is_active = true
ON CONFLICT (collection_id, published_version) DO NOTHING;

-- Set enquiry email for Apex
UPDATE public.supplier_profiles
  SET enquiry_email = 'info@apexroofing.co.nz',
      enquiries_enabled = true
  WHERE id = 'f301c796-3ebb-4a8a-bf10-b1f9ac6223d5'
    AND enquiry_email IS NULL;

-- ============================================================
-- Prime Roofing (08f991a6-8a4b-4a15-994c-e35c2dddb30b)
-- ============================================================
INSERT INTO public.component_collections (
  id, company_id, name, supplier_profile_id, visibility, publication_status,
  published_at, published_version, public_slug, takeoff_enabled,
  currency, is_default_takeoff_library, public_title, public_description
) VALUES (
  'a2e00000-0000-0000-0000-000000000002',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Prime Roofing - Standard Roofing Library',
  '08f991a6-8a4b-4a15-994c-e35c2dddb30b',
  'published', 'published',
  now(), 1, 'prime-roofing', true,
  'USD', true,
  'Prime Roofing Standard Library',
  'Roofing components and pricing from Prime Roofing.'
) ON CONFLICT (id) DO NOTHING;

-- Set default_takeoff_collection_id on supplier profile
UPDATE public.supplier_profiles
  SET default_takeoff_collection_id = 'a2e00000-0000-0000-0000-000000000002'
  WHERE id = '08f991a6-8a4b-4a15-994c-e35c2dddb30b';

-- Link Prime components to the collection and set takeoff defaults
UPDATE public.component_library
  SET collection_id = 'a2e00000-0000-0000-0000-000000000002',
      is_takeoff_default = true
  WHERE supplier_profile_id = '08f991a6-8a4b-4a15-994c-e35c2dddb30b'
    AND takeoff_slot IS NOT NULL
    AND is_active = true;

-- Create initial snapshot for Prime
INSERT INTO public.supplier_takeoff_library_snapshots (
  supplier_profile_id, collection_id, published_version, currency, components_json
)
SELECT
  '08f991a6-8a4b-4a15-994c-e35c2dddb30b',
  'a2e00000-0000-0000-0000-000000000002',
  1,
  'USD',
  jsonb_agg(
    jsonb_build_object(
      'id', cl.id,
      'name', cl.name,
      'sku', cl.sku,
      'takeoff_slot', cl.takeoff_slot,
      'pricing_strategy', cl.pricing_strategy,
      'default_material_rate', cl.default_material_rate,
      'pack_size', cl.pack_size,
      'pack_price', cl.pack_price,
      'default_labour_rate', cl.default_labour_rate,
      'default_waste_percent', cl.default_waste_percent,
      'default_pitch_type', cl.default_pitch_type,
      'is_takeoff_default', cl.is_takeoff_default,
      'is_active', cl.is_active,
      'sort_order', cl.sort_order
    )
  )
FROM public.component_library cl
WHERE cl.supplier_profile_id = '08f991a6-8a4b-4a15-994c-e35c2dddb30b'
  AND cl.takeoff_slot IS NOT NULL
  AND cl.is_active = true
ON CONFLICT (collection_id, published_version) DO NOTHING;

-- Set enquiry email for Prime (test placeholder)
UPDATE public.supplier_profiles
  SET enquiry_email = 'shaun@quote-core.com',
      enquiries_enabled = true
  WHERE id = '08f991a6-8a4b-4a15-994c-e35c2dddb30b'
    AND enquiry_email IS NULL;
