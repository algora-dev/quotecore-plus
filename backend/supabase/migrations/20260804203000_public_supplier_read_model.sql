-- 20260804203000_public_supplier_read_model.sql
-- G1: Public supplier read model
-- A SECURITY DEFINER function that returns public supplier data, respecting all visibility controls.
-- This is the single source of truth for what the public (and AI agents) can see about a supplier.

CREATE OR REPLACE FUNCTION public_supplier_read(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Grant execute to anon and authenticated (the function itself handles visibility)
GRANT EXECUTE ON FUNCTION public_supplier_read(text) TO anon, authenticated;

-- Directory list function: returns only published, page-enabled, approved suppliers
CREATE OR REPLACE FUNCTION public_supplier_directory()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_agg(jsonb_build_object(
    'id', sp.id,
    'slug', sp.slug,
    'supplier_name', sp.supplier_name,
    'description', sp.description,
    'logo_url', sp.logo_url,
    'service_areas', sp.service_areas,
    'roofing_types', sp.roofing_types,
    'product_categories', sp.product_categories,
    'brands', sp.brands,
    'branch_city', sp.branch_city,
    'branch_region', sp.branch_region,
    'branch_country', sp.branch_country,
    'national_coverage', sp.national_coverage,
    'currency', sp.currency,
    'takeoff_builder_enabled', sp.takeoff_builder_enabled,
    'calculator_available', sp.takeoff_builder_enabled AND sp.default_takeoff_collection_id IS NOT NULL
  ))
  FROM supplier_profiles sp
  WHERE sp.status = 'approved'
    AND sp.publication_state = 'published'
    AND sp.public_page_enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public_supplier_directory() TO anon, authenticated;
