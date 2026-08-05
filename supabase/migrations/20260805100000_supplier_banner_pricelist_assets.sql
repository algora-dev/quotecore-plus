-- Migration: 20260805100000_supplier_banner_pricelist_assets.sql
-- Add banner_url and price list columns to supplier_profiles
-- Update public_supplier_read RPC to include new fields
-- Create supplier-assets storage bucket with RLS

BEGIN;

-- ============================================================
-- 1. Add new columns to supplier_profiles
-- ============================================================
ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS price_list_url text,
  ADD COLUMN IF NOT EXISTS price_list_filename text,
  ADD COLUMN IF NOT EXISTS price_list_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_list_content_type text;

-- ============================================================
-- 2. Update public_supplier_read RPC
--    Add banner_url (always visible when page is visible)
--    Add price list fields (only when public_catalogue_enabled AND published/unlisted)
-- ============================================================
CREATE OR REPLACE FUNCTION public.public_supplier_read(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'supplier', jsonb_build_object(
      'id', sp.id,
      'slug', sp.slug,
      'supplier_name', sp.supplier_name,
      'description', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.description
        ELSE NULL
      END,
      'logo_url', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.logo_url
        ELSE NULL
      END,
      'banner_url', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.banner_url
        ELSE NULL
      END,
      'website_url', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') AND sp.public_contact_visibility IN ('page_only', 'full') THEN sp.website_url
        ELSE NULL
      END,
      'contact_email', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') AND sp.public_contact_visibility IN ('page_only', 'full') THEN sp.contact_email
        ELSE NULL
      END,
      'phone_number', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') AND sp.public_contact_visibility IN ('page_only', 'full') THEN sp.phone_number
        ELSE NULL
      END,
      'enquiry_email', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') AND sp.public_contact_visibility IN ('page_only', 'full') THEN sp.enquiry_email
        ELSE NULL
      END,
      'service_areas', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.service_areas
        ELSE NULL
      END,
      'roofing_types', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.roofing_types
        ELSE NULL
      END,
      'product_categories', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.product_categories
        ELSE NULL
      END,
      'brands', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.brands
        ELSE NULL
      END,
      'branch_city', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.branch_city
        ELSE NULL
      END,
      'branch_region', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.branch_region
        ELSE NULL
      END,
      'branch_country', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.branch_country
        ELSE NULL
      END,
      'branch_postcode', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.branch_postcode
        ELSE NULL
      END,
      'national_coverage', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.national_coverage
        ELSE NULL
      END,
      'delivery_coverage', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.delivery_coverage
        ELSE NULL
      END,
      'freight_available', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.freight_available
        ELSE NULL
      END,
      'pickup_available', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.pickup_available
        ELSE NULL
      END,
      'currency', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.currency
        ELSE NULL
      END,
      'tax_treatment', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.tax_treatment
        ELSE NULL
      END,
      'delivery_assumptions', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.delivery_assumptions
        ELSE NULL
      END,
      'exclusions', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.exclusions
        ELSE NULL
      END,
      'instant_pricing_available', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.instant_pricing_available
        ELSE NULL
      END,
      'pricing_updated_at', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.pricing_updated_at
        ELSE NULL
      END,
      'price_valid_until', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.price_valid_until
        ELSE NULL
      END,
      'price_type', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.price_type
        ELSE NULL
      END,
      'takeoff_builder_enabled', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.takeoff_builder_enabled
        ELSE NULL
      END,
      'brand_primary_color', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.brand_primary_color
        ELSE NULL
      END,
      'brand_accent_color', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.brand_accent_color
        ELSE NULL
      END,
      'price_list_url', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') AND sp.public_catalogue_enabled = true THEN sp.price_list_url
        ELSE NULL
      END,
      'price_list_filename', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') AND sp.public_catalogue_enabled = true THEN sp.price_list_filename
        ELSE NULL
      END,
      'price_list_uploaded_at', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') AND sp.public_catalogue_enabled = true THEN sp.price_list_uploaded_at
        ELSE NULL
      END,
      'price_list_content_type', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') AND sp.public_catalogue_enabled = true THEN sp.price_list_content_type
        ELSE NULL
      END,
      'publication_state', sp.publication_state,
      'public_price_visibility', sp.public_price_visibility,
      'public_contact_visibility', sp.public_contact_visibility,
      'public_catalogue_enabled', sp.public_catalogue_enabled,
      'search_indexing_enabled', sp.search_indexing_enabled,
      'publication_updated_at', sp.publication_updated_at
    ),
    'eligibility', jsonb_build_object(
      'directory_visible', sp.publication_state = 'published' AND sp.public_page_enabled AND sp.status = 'approved',
      'page_visible', sp.publication_state IN ('published', 'unlisted') AND sp.public_page_enabled AND sp.status = 'approved',
      'indexable', sp.publication_state = 'published' AND sp.search_indexing_enabled AND sp.status = 'approved',
      'calculator_available', sp.takeoff_builder_enabled AND sp.status = 'approved' AND sp.default_takeoff_collection_id IS NOT NULL,
      'prices_on_page', sp.publication_state IN ('published', 'unlisted') AND sp.public_price_visibility IN ('web_only', 'full') AND sp.status = 'approved',
      'prices_via_api', sp.publication_state IN ('published', 'unlisted') AND sp.public_price_visibility = 'full' AND sp.status = 'approved',
      'contacts_visible', sp.publication_state IN ('published', 'unlisted') AND sp.public_contact_visibility IN ('page_only', 'full') AND sp.status = 'approved'
    ),
    'library', CASE
      WHEN sp.publication_state IN ('published', 'unlisted') AND sp.default_takeoff_collection_id IS NOT NULL THEN (
        SELECT jsonb_build_object(
          'collection_id', cc.id,
          'name', cc.public_title,
          'description', cc.public_description,
          'published_version', cc.published_version,
          'published_at', cc.published_at,
          'roofing_types', cc.roofing_types,
          'product_categories', cc.product_categories,
          'brands', cc.brands
        )
        FROM component_collections cc
        WHERE cc.id = sp.default_takeoff_collection_id
          AND cc.publication_status = 'published'
      )
      ELSE NULL
    END
  )
  FROM supplier_profiles sp
  WHERE sp.slug = p_slug
    AND sp.status = 'approved';
$function$;

-- Revoke/GRANT permissions on the updated function
REVOKE ALL ON FUNCTION public.public_supplier_read(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_supplier_read(text) TO anon, authenticated;

-- ============================================================
-- 3. Create supplier-assets storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-assets',
  'supplier-assets',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. RLS policies for supplier-assets bucket
-- ============================================================

-- Public can read
DROP POLICY IF EXISTS "supplier-assets-public-read" ON storage.objects;
CREATE POLICY "supplier-assets-public-read"
ON storage.objects FOR SELECT
USING (bucket_id = 'supplier-assets');

-- Authenticated suppliers can upload to their own company path
-- Path format: {company_id}/{filename}
DROP POLICY IF EXISTS "supplier-assets-upload" ON storage.objects;
CREATE POLICY "supplier-assets-upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'supplier-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM users WHERE id = auth.uid()
  )
);

-- Suppliers can update their own files
DROP POLICY IF EXISTS "supplier-assets-update" ON storage.objects;
CREATE POLICY "supplier-assets-update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'supplier-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM users WHERE id = auth.uid()
  )
);

-- Suppliers can delete their own files
DROP POLICY IF EXISTS "supplier-assets-delete" ON storage.objects;
CREATE POLICY "supplier-assets-delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'supplier-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM users WHERE id = auth.uid()
  )
);

COMMIT;
