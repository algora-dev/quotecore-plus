-- Phase 5: Versioned catalogue URLs + version history
-- Adds RPCs for fetching catalogue version history and specific versions

-- =============================================================
-- public_supplier_catalogue_versions: list all published versions for a supplier
-- =============================================================
CREATE OR REPLACE FUNCTION public_supplier_catalogue_versions(p_slug TEXT)
RETURNS TABLE (
  catalogue_id UUID,
  version INT,
  status TEXT,
  currency TEXT,
  uploaded_at TIMESTAMPTZ,
  valid_from DATE,
  valid_until DATE,
  original_filename TEXT,
  public_title TEXT,
  total_items BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS catalogue_id,
    c.published_version AS version,
    c.catalogue_status AS status,
    c.default_currency AS currency,
    c.published_at AS uploaded_at,
    c.valid_from,
    c.valid_until,
    c.original_filename,
    c.public_title,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.catalog_rows cr
      WHERE cr.catalog_id = c.id
    ) AS total_items
  FROM public.catalogs c
  JOIN public.supplier_profiles sp ON sp.id = c.supplier_profile_id
  WHERE sp.slug = p_slug
    AND sp.status = 'approved'
    AND sp.publication_state IN ('published', 'unlisted')
    AND c.visibility = 'published'
    AND c.publication_status = 'published'
  ORDER BY c.published_version DESC;
$$;

-- =============================================================
-- public_supplier_catalogue_by_version: fetch a specific version's items
-- =============================================================
CREATE OR REPLACE FUNCTION public_supplier_catalogue_by_version(
  p_slug TEXT,
  p_version INT,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id UUID;
  v_catalogue_id UUID;
  v_supplier RECORD;
BEGIN
  -- Get supplier
  SELECT id, supplier_name, slug, status, website_url, branch_country,
         service_areas, delivery_coverage
  INTO v_supplier
  FROM public.supplier_profiles
  WHERE slug = p_slug
    AND status = 'approved'
    AND publication_state IN ('published', 'unlisted');

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get the specific catalogue version
  SELECT id INTO v_catalogue_id
  FROM public.catalogs
  WHERE supplier_profile_id = v_supplier.id
    AND visibility = 'published'
    AND publication_status = 'published'
    AND published_version = p_version;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'supplier', json_build_object(
      'id', v_supplier.id,
      'slug', v_supplier.slug,
      'name', v_supplier.supplier_name,
      'verification_status', 'approved',
      'website', v_supplier.website_url,
      'country', v_supplier.branch_country,
      'service_areas', v_supplier.service_areas,
      'delivery_areas', v_supplier.delivery_coverage
    ),
    'catalogue', (
      SELECT json_build_object(
        'id', c.id,
        'version', c.published_version,
        'status', c.catalogue_status,
        'currency', c.default_currency,
        'uploaded_at', c.published_at,
        'updated_at', c.updated_at,
        'valid_from', c.valid_from,
        'valid_until', c.valid_until,
        'original_filename', c.original_filename,
        'public_title', c.public_title,
        'public_description', c.public_description,
        'total_items', (
          SELECT COUNT(*)::BIGINT FROM public.catalog_rows cr WHERE cr.catalog_id = c.id
        )
      )
      FROM public.catalogs c
      WHERE c.id = v_catalogue_id
    ),
    'items', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'row_index', cr.row_index,
            'raw_row', cr.raw_row
          )
          ORDER BY cr.row_index
          LIMIT p_limit
          OFFSET p_offset
        )
        FROM public.catalog_rows cr
        WHERE cr.catalog_id = v_catalogue_id
      ),
      '[]'::json
    )
  );
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public_supplier_catalogue_versions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_supplier_catalogue_by_version TO anon, authenticated;
