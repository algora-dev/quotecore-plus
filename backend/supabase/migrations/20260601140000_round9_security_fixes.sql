-- =====================================================================
-- Round 9 security fixes (Gerald audit 2026-06-01)
-- =====================================================================
-- Addresses:
--   C-01 (Critical): search_catalog_rows() was SECURITY DEFINER, granted to
--     `authenticated`, and trusted the caller-supplied p_company_id with no
--     membership check -> any authenticated tenant could read another
--     company's catalog rows by calling the RPC directly.
--   M-04 (Medium): company_catalog_count / company_attachment_count /
--     require_catalog_slot / require_attachment_slot were also granted to
--     `authenticated`, allowing cross-company metadata/count probing.
--
-- Fix strategy:
--   These six RPCs are ONLY ever called by the app via the service-role
--   admin client (verified: app/lib/billing/entitlements.ts +
--   catalogs/search/route.ts all use createAdminClient()). No legitimate
--   browser/`authenticated` caller exists. We therefore REVOKE execute from
--   `authenticated` entirely, eliminating the direct-call attack surface
--   while keeping the app working through service_role.
--
--   search_catalog_rows is additionally hardened defensively:
--     - p_limit clamped in SQL (1..100) regardless of route validation.
--     - LIKE wildcards in p_query escaped so `%`/`_` are literal text and
--       a wildcard-only query can't dump the table.
--
-- This migration is idempotent and safe to re-run.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Harden search_catalog_rows: clamp limit + escape LIKE wildcards.
--    (Function body replaced; grants handled in section 3.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_catalog_rows(
  p_company_id uuid,
  p_catalog_id uuid,      -- NULL = search all ready catalogs
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
    -- Escape LIKE wildcards so `%` / `_` in the query are literal text.
    -- ESCAPE '\' makes the backslash the escape char for the pattern.
    AND cr.search_text ILIKE
        '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        ESCAPE '\'
  ORDER BY
    similarity(cr.search_text, lower(coalesce(p_query, ''))) DESC,
    cr.catalog_id,
    cr.row_index
  -- Clamp limit to 1..100 inside SQL regardless of caller input.
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

COMMENT ON FUNCTION public.search_catalog_rows IS
  'pg_trgm ILIKE search scoped to company (service_role only). Limit clamped 1..100; LIKE wildcards in p_query escaped. p_catalog_id=NULL searches all ready catalogs.';

-- ---------------------------------------------------------------------
-- 2. Revoke direct `authenticated` execute on all cross-tenant RPCs.
--    The app calls these via service_role only. service_role retains
--    execute (granted in the original migrations / via REVOKE not touching
--    service_role). We also revoke from PUBLIC for defence-in-depth.
-- ---------------------------------------------------------------------
-- NOTE: Supabase default-grants EXECUTE to anon + authenticated separately,
-- so we must revoke from BOTH roles (PUBLIC alone does not cover named-role
-- grants). anon = unauthenticated; leaving it would be worse than C-01.
REVOKE EXECUTE ON FUNCTION public.search_catalog_rows(uuid, uuid, text, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.company_catalog_count(uuid)                      FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_catalog_slot(uuid)                       FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.company_attachment_count(uuid)                   FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_attachment_slot(uuid)                    FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- 3. Re-affirm service_role execute (no-op if already granted; explicit
--    so this migration is self-contained and the intent is documented).
-- ---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.search_catalog_rows(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_catalog_count(uuid)                      TO service_role;
GRANT EXECUTE ON FUNCTION public.require_catalog_slot(uuid)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.company_attachment_count(uuid)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.require_attachment_slot(uuid)                    TO service_role;

COMMIT;
