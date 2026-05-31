-- =====================================================================
-- Catalog Library
-- =====================================================================
-- Adds the Catalog Library feature: company-owned CSV-imported product
-- catalogs searchable within the quote editor to insert custom lines.
--
-- New tables:   catalogs, catalog_rows
-- New functions: company_catalog_count, require_catalog_slot,
--                search_catalog_rows
-- Plan changes:  catalog_limit + feat_catalogs on subscription_plans
-- Tiers:         Pro=3, Pro Max=5, Premium=unlimited, all others=false/0
--
-- DO NOT APPLY without explicit Shaun approval — one DB serves dev+prod.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. pg_trgm extension (required for GIN trigram index on search_text)
-- -----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------
-- 2. catalogs table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL
    CONSTRAINT catalogs_name_not_blank CHECK (length(trim(name)) > 0),
  original_filename TEXT,
  row_count         INTEGER     NOT NULL DEFAULT 0
    CONSTRAINT catalogs_row_count_nonneg CHECK (row_count >= 0),
  data_bytes        INTEGER     NOT NULL DEFAULT 0
    CONSTRAINT catalogs_data_bytes_nonneg CHECK (data_bytes >= 0),
  column_mapping    JSONB       NOT NULL DEFAULT '{}',
  -- ^ { description: <colKey|null>, quantity: <colKey|null>, price: <colKey|null> }
  headers           JSONB       NOT NULL DEFAULT '[]',
  -- ^ Ordered array of detected CSV header strings; mapping keys reference these.
  status            TEXT        NOT NULL DEFAULT 'ready'
    CONSTRAINT catalogs_status_check CHECK (status IN ('ready', 'importing', 'archived', 'error')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalogs IS
  'Company-owned product/material catalogs imported from CSV. Item rows live in catalog_rows.';
COMMENT ON COLUMN public.catalogs.data_bytes IS
  'Approximate parsed payload size (bytes). Tracked by the app layer against assertCanUseStorage.';
COMMENT ON COLUMN public.catalogs.status IS
  'ready = searchable; importing = batch upload in progress; archived = hidden/unsearchable (still counts toward storage); error = import failed.';
COMMENT ON COLUMN public.catalogs.column_mapping IS
  'Map of { description, quantity, price } → CSV header key. Each key is nullable (column unmapped).';
COMMENT ON COLUMN public.catalogs.headers IS
  'Ordered array of CSV column header strings detected during import.';

CREATE INDEX IF NOT EXISTS idx_catalogs_company
  ON public.catalogs (company_id);

ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;

-- Company-scoped: any authenticated user whose users.company_id matches.
CREATE POLICY "catalogs_company_scope" ON public.catalogs
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- updated_at auto-stamp
DROP TRIGGER IF EXISTS catalogs_touch_updated_at ON public.catalogs;
CREATE TRIGGER catalogs_touch_updated_at
  BEFORE UPDATE ON public.catalogs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------
-- 3. catalog_rows table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_rows (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id  UUID    NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  company_id  UUID    NOT NULL,
  -- ^ Denormalised for RLS + search index scoping. Must equal catalogs.company_id.
  row_index   INTEGER NOT NULL,
  raw_row     JSONB   NOT NULL,
  -- ^ { "<header>": "<value>", ... } — full CSV row, all columns.
  search_text TEXT    NOT NULL
  -- ^ lower(concat of all raw_row values), built server-side only.
);

COMMENT ON TABLE public.catalog_rows IS
  'Individual rows imported from a catalog CSV. One row per CSV data line.';
COMMENT ON COLUMN public.catalog_rows.company_id IS
  'Denormalised from catalogs.company_id for RLS and index scoping.';
COMMENT ON COLUMN public.catalog_rows.search_text IS
  'lower(space-joined concat of all raw_row column values). Always built server-side. Used for pg_trgm GIN search.';

-- GIN trigram index for fast substring / partial-word search
CREATE INDEX IF NOT EXISTS idx_catalog_rows_search_trgm
  ON public.catalog_rows USING GIN (search_text gin_trgm_ops);

-- Composite btree for scoping queries
CREATE INDEX IF NOT EXISTS idx_catalog_rows_company_catalog
  ON public.catalog_rows (company_id, catalog_id);

ALTER TABLE public.catalog_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_rows_company_scope" ON public.catalog_rows
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- -----------------------------------------------------------------------
-- 4. Subscription plan columns
-- -----------------------------------------------------------------------
-- NULL catalog_limit = unlimited (same convention as component_limit).
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS catalog_limit INTEGER
    CHECK (catalog_limit IS NULL OR catalog_limit >= 0),
  ADD COLUMN IF NOT EXISTS feat_catalogs BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subscription_plans.catalog_limit IS
  'Active-catalog cap per company. NULL = unlimited. Archived catalogs do NOT count. Enforced via require_catalog_slot().';
COMMENT ON COLUMN public.subscription_plans.feat_catalogs IS
  'Whether the catalog library feature is available on this plan tier.';

-- Pro: 3 active catalogs
UPDATE public.subscription_plans
   SET feat_catalogs = true,
       catalog_limit = 3
 WHERE code = 'pro';

-- Pro Max: 5 active catalogs
UPDATE public.subscription_plans
   SET feat_catalogs = true,
       catalog_limit = 5
 WHERE code = 'pro_max';

-- Premium: unlimited (NULL)
UPDATE public.subscription_plans
   SET feat_catalogs = true,
       catalog_limit = NULL
 WHERE code = 'premium';

-- All other tiers (trial, starter, growth, scaling, business, enterprise):
-- no catalog access. Explicit so future plan adds default correctly.
UPDATE public.subscription_plans
   SET feat_catalogs = false,
       catalog_limit = 0
 WHERE code NOT IN ('pro', 'pro_max', 'premium');

-- -----------------------------------------------------------------------
-- 5. Extend company_has_feature() with 'catalogs' arm
-- -----------------------------------------------------------------------
-- The CASE expression in company_has_feature is the single source of truth
-- for feature gating. Adding a new arm here wires feat_catalogs into the
-- existing requireFeature() + RLS machinery with zero app-code changes
-- needed for the SQL side.
CREATE OR REPLACE FUNCTION public.company_has_feature(p_company_id uuid, p_feature text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_effective_code text;
  v_allowed boolean;
BEGIN
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT CASE p_feature
    WHEN 'digital_takeoff' THEN sp.feat_digital_takeoff
    WHEN 'flashings'       THEN sp.feat_flashings
    WHEN 'material_orders' THEN sp.feat_material_orders
    WHEN 'followups'       THEN sp.feat_followups
    WHEN 'email_send'      THEN sp.feat_email_send
    WHEN 'activity_card'   THEN sp.feat_activity_card
    WHEN 'catalogs'        THEN sp.feat_catalogs        -- ← new
    ELSE false
  END
  INTO v_allowed
  FROM public.subscription_plans sp
  WHERE sp.code = v_effective_code;

  RETURN COALESCE(v_allowed, false);
END $$;

COMMENT ON FUNCTION public.company_has_feature IS
  'Single feature-check function used by app code AND RLS policies. Extend the CASE arm + add a column to subscription_plans when introducing a new gated feature.';

-- -----------------------------------------------------------------------
-- 6. company_catalog_count()
-- -----------------------------------------------------------------------
-- Active catalog count for tier enforcement.
-- Archived catalogs do NOT count toward the cap (status = 'archived').
-- Importing + error + ready all count (to prevent racing past the cap
-- during a multi-chunk upload).
CREATE OR REPLACE FUNCTION public.company_catalog_count(p_company_id uuid)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.catalogs
   WHERE company_id = p_company_id
     AND status <> 'archived';
$$;

COMMENT ON FUNCTION public.company_catalog_count IS
  'Count of non-archived catalogs for tier-cap enforcement. Only status=archived is excluded.';

-- -----------------------------------------------------------------------
-- 7. require_catalog_slot()
-- -----------------------------------------------------------------------
-- Raises on inactive subscription, missing feature, or exceeded limit.
-- Call inside the same transaction as the catalog INSERT.
-- Error codes:
--   P0001 = subscription_inactive (shared)
--   P0012 = feature_not_available:catalogs (shared)
--   P0013 = catalog_limit_reached (new)
CREATE OR REPLACE FUNCTION public.require_catalog_slot(p_company_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_used        integer;
  v_limit       integer;
  v_code        text;
  v_active      boolean;
  v_has_feature boolean;
BEGIN
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  v_has_feature := public.company_has_feature(p_company_id, 'catalogs');
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'feature_not_available:catalogs'
      USING ERRCODE = 'P0012';
  END IF;

  v_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.catalog_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  -- NULL = unlimited
  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  v_used := public.company_catalog_count(p_company_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'catalog_limit_reached'
      USING ERRCODE = 'P0013',
            DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
  END IF;
END $$;

COMMENT ON FUNCTION public.require_catalog_slot IS
  'Raises subscription_inactive (P0001), feature_not_available (P0012), or catalog_limit_reached (P0013). Call before the catalog INSERT.';

-- -----------------------------------------------------------------------
-- 8. search_catalog_rows()
-- -----------------------------------------------------------------------
-- pg_trgm ILIKE search over catalog_rows.search_text, scoped to company.
-- p_catalog_id = NULL searches all ready catalogs for the company.
-- Archived catalogs always excluded from search.
-- Results ordered by trigram similarity score (best match first).
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
    AND cr.search_text         ILIKE '%' || p_query || '%'
  ORDER BY
    similarity(cr.search_text, lower(p_query)) DESC,
    cr.catalog_id,
    cr.row_index
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.search_catalog_rows IS
  'pg_trgm ILIKE search scoped to company. p_catalog_id=NULL searches all ready catalogs. Returns up to p_limit rows ranked by trigram similarity.';

-- -----------------------------------------------------------------------
-- 9. adjust_company_storage() — manual storage delta for DB-only data
-- -----------------------------------------------------------------------
-- Catalog rows live in the database, not Supabase Storage, so the
-- existing storage trigger on storage.objects doesn't fire. This RPC
-- lets the app layer atomically adjust storage_used_bytes when a catalog
-- is imported or deleted. GREATEST(0, ...) prevents underflow.
CREATE OR REPLACE FUNCTION public.adjust_company_storage(
  p_company_id  uuid,
  p_delta_bytes integer
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE public.companies
     SET storage_used_bytes = GREATEST(0, storage_used_bytes + p_delta_bytes)
   WHERE id = p_company_id;
$$;

COMMENT ON FUNCTION public.adjust_company_storage IS
  'Atomically adjusts storage_used_bytes by p_delta_bytes (positive=add, negative=subtract). Clamps to 0 on underflow. Used for DB-stored catalog row accounting since storage.objects triggers do not fire for DB inserts.';

-- -----------------------------------------------------------------------
-- 10. Permissions
-- -----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.company_catalog_count(uuid)                        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.require_catalog_slot(uuid)                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_catalog_rows(uuid, uuid, text, integer)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_company_storage(uuid, integer)              TO service_role;

COMMIT;
