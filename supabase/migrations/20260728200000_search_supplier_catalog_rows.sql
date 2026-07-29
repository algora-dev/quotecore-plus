-- Migration: 20260728200000_search_supplier_catalog_rows.sql
-- Update search_catalog_rows to also search rows from supplier catalogues
-- that the user has added (via source_catalog_id reference).

CREATE OR REPLACE FUNCTION public.search_catalog_rows(
  p_company_id uuid,
  p_catalog_id uuid,      -- NULL = search all ready catalogs for the company
  p_query      text,
  p_limit      integer DEFAULT 50
)
  RETURNS TABLE (
    id           uuid,
    catalog_id   uuid,
    catalog_name text,
    row_index    integer,
    raw_row      jsonb,
    search_text  text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT * FROM (
    -- Search own catalog rows (user-uploaded catalogs)
    SELECT
      cr.id,
      cr.catalog_id,
      c.name    AS catalog_name,
      cr.row_index,
      cr.raw_row,
      cr.search_text
    FROM public.catalog_rows  cr
    JOIN public.catalogs       c  ON c.id = cr.catalog_id
    WHERE cr.company_id          = p_company_id
      AND c.status               = 'ready'
      AND (p_catalog_id IS NULL OR cr.catalog_id = p_catalog_id)
      AND cr.search_text         ILIKE '%' || p_query || '%'

    UNION ALL

    -- Search supplier catalog rows (catalogs with source_catalog_id)
    SELECT
      sr.id,
      uc.id   AS catalog_id,
      uc.name AS catalog_name,
      sr.row_index,
      sr.raw_row,
      sr.search_text
    FROM public.catalog_rows  sr
    JOIN public.catalogs       sc  ON sc.id = sr.catalog_id
    JOIN public.catalogs       uc  ON uc.source_catalog_id = sc.id
    WHERE uc.company_id          = p_company_id
      AND uc.status              = 'ready'
      AND sc.status              = 'ready'
      AND sc.visibility          = 'published'
      AND sc.publication_status  = 'published'
      AND (p_catalog_id IS NULL OR uc.id = p_catalog_id)
      AND sr.search_text         ILIKE '%' || p_query || '%'
  ) combined
  ORDER BY
    similarity(search_text, lower(p_query)) DESC,
    catalog_id,
    row_index
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.search_catalog_rows IS
  'Search own catalog rows + supplier catalog rows (via source_catalog_id reference). Returns up to p_limit rows ranked by trigram similarity.';
