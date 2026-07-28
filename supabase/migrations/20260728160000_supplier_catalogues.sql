-- Migration: 20260728160000_supplier_catalogues.sql
-- Extends catalogs table for supplier public catalogue publishing

-- 1. Add supplier columns to catalogs table
ALTER TABLE catalogs
  ADD COLUMN IF NOT EXISTS supplier_profile_id UUID REFERENCES supplier_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'published')),
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'pending_review', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS published_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_title TEXT,
  ADD COLUMN IF NOT EXISTS public_description TEXT,
  ADD COLUMN IF NOT EXISTS roofing_types TEXT[],
  ADD COLUMN IF NOT EXISTS product_categories TEXT[],
  ADD COLUMN IF NOT EXISTS brands TEXT[],
  ADD COLUMN IF NOT EXISTS keywords TEXT[],
  ADD COLUMN IF NOT EXISTS source_catalog_id UUID REFERENCES catalogs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_version INTEGER,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

-- 2. Search tsvector + GIN index for public catalogue search
ALTER TABLE catalogs
  ADD COLUMN IF NOT EXISTS search_tsv TSVECTOR;

-- Trigger to keep search_tsv updated
CREATE OR REPLACE FUNCTION catalogs_search_tsv_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.public_title, NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.public_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.keywords, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.brands, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.product_categories, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP TRIGGER IF EXISTS catalogs_search_tsv_trigger ON catalogs;
CREATE TRIGGER catalogs_search_tsv_trigger
  BEFORE INSERT OR UPDATE OF public_title, name, public_description, keywords, brands, product_categories, search_tsv
  ON catalogs
  FOR EACH ROW EXECUTE FUNCTION catalogs_search_tsv_update();

-- Backfill existing rows
UPDATE catalogs SET search_tsv =
  setweight(to_tsvector('english', coalesce(public_title, name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(public_description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(keywords, ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string(brands, ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string(product_categories, ' '), '')), 'C');

-- GIN index for search
CREATE INDEX IF NOT EXISTS catalogs_search_tsv_idx ON catalogs USING GIN (search_tsv);

-- 3. Index for finding published supplier catalogues
CREATE INDEX IF NOT EXISTS catalogs_supplier_published_idx
  ON catalogs (supplier_profile_id)
  WHERE visibility = 'published' AND supplier_profile_id IS NOT NULL;

-- 4. Index for finding catalogues by source (for update detection)
CREATE INDEX IF NOT EXISTS catalogs_source_catalog_idx
  ON catalogs (source_catalog_id)
  WHERE source_catalog_id IS NOT NULL;

-- 5. RLS policies for public catalogue browsing
-- Published supplier catalogues are visible to all authenticated users
ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS catalogs_select_own ON catalogs;
DROP POLICY IF EXISTS catalogs_insert_own ON catalogs;
DROP POLICY IF EXISTS catalogs_update_own ON catalogs;
DROP POLICY IF EXISTS catalogs_delete_own ON catalogs;
DROP POLICY IF EXISTS catalogs_select_published_supplier ON catalogs;

-- Users can see their own catalogues (by company_id)
CREATE POLICY catalogs_select_own ON catalogs
  FOR SELECT TO authenticated
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Published supplier catalogues are visible to all authenticated users
CREATE POLICY catalogs_select_published_supplier ON catalogs
  FOR SELECT TO authenticated
  USING (
    visibility = 'published'
    AND supplier_profile_id IS NOT NULL
    AND publication_status = 'published'
  );

-- Insert: only own company
CREATE POLICY catalogs_insert_own ON catalogs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Update: only own company
CREATE POLICY catalogs_update_own ON catalogs
  FOR UPDATE TO authenticated
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid)
  WITH CHECK (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Delete: only own company
CREATE POLICY catalogs_delete_own ON catalogs
  FOR DELETE TO authenticated
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- 6. Also enable RLS on catalog_rows for published catalogue visibility
ALTER TABLE catalog_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_rows_select_own ON catalog_rows;
DROP POLICY IF EXISTS catalog_rows_select_published_supplier ON catalog_rows;

-- Users can see rows for their own company's catalogues
CREATE POLICY catalog_rows_select_own ON catalog_rows
  FOR SELECT TO authenticated
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Published supplier catalogue rows are visible to all authenticated users
CREATE POLICY catalog_rows_select_published_supplier ON catalog_rows
  FOR SELECT TO authenticated
  USING (
    catalog_id IN (
      SELECT id FROM catalogs
      WHERE visibility = 'published'
        AND supplier_profile_id IS NOT NULL
        AND publication_status = 'published'
    )
  );
