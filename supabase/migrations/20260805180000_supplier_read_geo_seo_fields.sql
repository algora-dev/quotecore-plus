-- 20260805180000_supplier_read_geo_seo_fields.sql
-- Update public_supplier_read RPC to include branch_latitude, branch_longitude,
-- opening_hours, and price_range for LocalBusiness JSON-LD enrichment (Phase 6).
-- NOTE: Split supplier object into two jsonb_build_object calls merged with ||
-- because Postgres has a 100-argument limit per function call.

BEGIN;

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
      'branch_latitude', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.branch_latitude
        ELSE NULL
      END,
      'branch_longitude', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.branch_longitude
        ELSE NULL
      END,
      'opening_hours', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.opening_hours
        ELSE NULL
      END,
      'price_range', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.price_range
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
      'tax_name', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.tax_name
        ELSE NULL
      END,
      'tax_rate', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.tax_rate
        ELSE NULL
      END,
      'price_list_includes_tax', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.price_list_includes_tax
        ELSE NULL
      END,
      'takeoff_library_includes_tax', CASE
        WHEN sp.publication_state IN ('published', 'unlisted') THEN sp.takeoff_library_includes_tax
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
      END
    ) || jsonb_build_object(
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

COMMIT;
