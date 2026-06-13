-- =====================================================================
-- Catalog Maps (multiple column mappings per uploaded catalog)
-- =====================================================================
-- Adds the ability to define MORE THAN ONE column mapping over the SAME
-- uploaded catalog, without re-uploading the file or duplicating rows.
--
-- Why this is cheap: catalog_rows.raw_row already stores the FULL CSV row
-- (every column) as JSONB. A "map" is just a tiny pointer
-- ({ description, quantity, price } -> header key). So a second mapping over
-- the same file is a few hundred bytes of JSON, NOT a row/file duplication.
--
-- Model:
--   - New table public.catalog_maps: child of catalogs (catalog_id FK).
--   - Each catalog gets a primary map (is_primary = true) auto-created here
--     from its existing column_mapping, named after the catalog itself.
--   - Extra maps are additional child rows pointing at the SAME catalog_rows.
--   - Maps DO NOT count toward the catalog slot limit and DO NOT add storage
--     (no new rows, no new file) — purely metadata.
--
-- Search impact: the search RPC keys on catalog_id (unchanged). The app picks
-- which map's column_mapping to APPLY to the results. So no RPC change.
--
-- Additive + nullable. One DB serves dev+prod; safe to apply per standing
-- permission (no drops, no data loss).
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. catalog_maps table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_maps (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id     UUID        NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  company_id     UUID        NOT NULL,
  -- ^ Denormalised from catalogs.company_id for RLS scoping. Must match parent.
  name           TEXT        NOT NULL
    CONSTRAINT catalog_maps_name_not_blank CHECK (length(trim(name)) > 0),
  column_mapping JSONB       NOT NULL DEFAULT '{}',
  -- ^ { description: <header|null>, quantity: <header|null>, price: <header|null> }
  is_primary     BOOLEAN     NOT NULL DEFAULT false,
  -- ^ The map auto-created on upload (named after the catalog). Exactly one per
  --   catalog. Deleting it is blocked at the app layer; deleting the catalog
  --   cascades it away.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalog_maps IS
  'Named column-mapping variants over a single uploaded catalog. Multiple maps share the same catalog_rows; no row/file duplication. Maps do not consume catalog slots or storage.';
COMMENT ON COLUMN public.catalog_maps.is_primary IS
  'The map auto-created on upload, named after the catalog. One per catalog.';
COMMENT ON COLUMN public.catalog_maps.company_id IS
  'Denormalised from catalogs.company_id for RLS + scoping. Must equal parent.';

CREATE INDEX IF NOT EXISTS idx_catalog_maps_catalog
  ON public.catalog_maps (catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_maps_company
  ON public.catalog_maps (company_id);

-- At most one primary map per catalog.
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_maps_one_primary
  ON public.catalog_maps (catalog_id)
  WHERE is_primary;

ALTER TABLE public.catalog_maps ENABLE ROW LEVEL SECURITY;

-- Company-scoped, same convention as catalogs/catalog_rows.
DROP POLICY IF EXISTS "catalog_maps_company_scope" ON public.catalog_maps;
CREATE POLICY "catalog_maps_company_scope" ON public.catalog_maps
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- updated_at auto-stamp (reuse the shared trigger fn).
DROP TRIGGER IF EXISTS catalog_maps_touch_updated_at ON public.catalog_maps;
CREATE TRIGGER catalog_maps_touch_updated_at
  BEFORE UPDATE ON public.catalog_maps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------
-- 2. Backfill: every existing catalog gets a primary map from its mapping.
-- -----------------------------------------------------------------------
-- Idempotent: only insert a primary map where one doesn't already exist.
INSERT INTO public.catalog_maps (catalog_id, company_id, name, column_mapping, is_primary)
SELECT c.id, c.company_id, c.name, c.column_mapping, true
FROM public.catalogs c
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_maps m
  WHERE m.catalog_id = c.id AND m.is_primary
);

COMMIT;
