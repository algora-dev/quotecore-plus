-- Migration: 20260808120000_supplier_catalogue_metadata.sql
-- Phase 1: Add catalogue-level metadata fields required by the supplier page template brief.
-- All additive, nullable/defaulted. Existing data is unaffected.

-- 1. Add catalogue metadata fields to catalogs table
ALTER TABLE catalogs
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS default_currency TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS catalogue_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (catalogue_status IN ('draft', 'published', 'expired', 'archived'));

-- 2. Add address_visibility to supplier_profiles
ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS address_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (address_visibility IN ('public', 'service_area', 'hidden'));

-- 3. Add business_registration_number and verification_link to supplier_profiles
ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS business_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS verification_link TEXT;

-- 4. Index for finding published, non-expired catalogues
CREATE INDEX IF NOT EXISTS catalogs_published_active_idx
  ON catalogs (supplier_profile_id)
  WHERE supplier_profile_id IS NOT NULL
    AND catalogue_status = 'published';

-- 5. Public RPC: get a supplier's published catalogue (rows + metadata)
-- Returns jsonb with supplier info, catalogue metadata, and items array.
CREATE OR REPLACE FUNCTION public.public_supplier_catalogue(
  p_slug text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'supplier', jsonb_build_object(
      'id', sp.id,
      'slug', sp.slug,
      'name', sp.supplier_name,
      'verification_status', CASE WHEN sp.status = 'approved' THEN 'verified' ELSE sp.status END,
      'website', sp.website_url,
      'country', sp.branch_country,
      'service_areas', sp.service_areas,
      'delivery_areas', sp.delivery_coverage
    ),
    'catalogue', jsonb_build_object(
      'id', c.id,
      'version', c.published_version,
      'status', c.catalogue_status,
      'currency', COALESCE(c.default_currency, sp.currency),
      'uploaded_at', c.imported_at,
      'updated_at', c.published_at,
      'valid_from', c.valid_from,
      'valid_until', c.valid_until,
      'original_filename', c.original_filename,
      'public_title', c.public_title,
      'public_description', c.public_description,
      'total_items', (
        SELECT count(*) FROM catalog_rows cr WHERE cr.catalog_id = c.id
      )
    ),
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'row_index', cr.row_index,
          'raw_row', cr.raw_row
        )
        ORDER BY cr.row_index
        LIMIT p_limit
        OFFSET p_offset
      )
      FROM catalog_rows cr
      WHERE cr.catalog_id = c.id
    ), '[]'::jsonb)
  )
  FROM supplier_profiles sp
  JOIN catalogs c ON c.supplier_profile_id = sp.id
  WHERE sp.slug = p_slug
    AND sp.status = 'approved'
    AND sp.publication_state IN ('published', 'unlisted')
    AND sp.public_catalogue_enabled = true
    AND c.visibility = 'published'
    AND c.publication_status = 'published'
    AND c.catalogue_status = 'published'
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.public_supplier_catalogue(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_supplier_catalogue(text, integer, integer) TO anon, authenticated;

-- 6. Public RPC: get catalogue item count only (for pagination metadata)
CREATE OR REPLACE FUNCTION public.public_supplier_catalogue_count(p_slug text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
  FROM catalog_rows cr
  JOIN catalogs c ON c.id = cr.catalog_id
  JOIN supplier_profiles sp ON sp.id = c.supplier_profile_id
  WHERE sp.slug = p_slug
    AND sp.status = 'approved'
    AND sp.publication_state IN ('published', 'unlisted')
    AND sp.public_catalogue_enabled = true
    AND c.visibility = 'published'
    AND c.publication_status = 'published'
    AND c.catalogue_status = 'published';
$function$;

REVOKE ALL ON FUNCTION public.public_supplier_catalogue_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_supplier_catalogue_count(text) TO anon, authenticated;
