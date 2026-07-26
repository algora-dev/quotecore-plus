-- Extend component_collections with visibility, publication, and search metadata
-- All additive. Existing collections default to 'private' which matches current behaviour.

ALTER TABLE public.component_collections
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'published')),
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'pending_review', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_version integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_profile_id uuid REFERENCES public.supplier_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_title text,
  ADD COLUMN IF NOT EXISTS public_description text,
  ADD COLUMN IF NOT EXISTS roofing_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brands text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;

-- Index for searching published collections
CREATE INDEX IF NOT EXISTS idx_component_collections_published
  ON public.component_collections (supplier_profile_id, publication_status)
  WHERE publication_status = 'published';

-- GIN index for text search
CREATE INDEX IF NOT EXISTS idx_component_collections_search_tsv
  ON public.component_collections USING gin (search_tsv);

-- Trigger to maintain search_tsv from title, description, keywords
CREATE OR REPLACE FUNCTION public.component_collections_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.public_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.public_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.keywords, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.brands, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TRIGGER trg_component_collections_search_tsv
  BEFORE INSERT OR UPDATE OF public_title, public_description, keywords, brands
  ON public.component_collections
  FOR EACH ROW EXECUTE FUNCTION public.component_collections_search_tsv();
