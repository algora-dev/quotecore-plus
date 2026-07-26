-- Extend component_library with supplier/SKU/source fields
-- All additive, all nullable. Existing components continue to work identically.

-- SKU / product code: unique within a supplier's components, optional for personal components
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS supplier_profile_id uuid REFERENCES public.supplier_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS takeoff_slot text
    CHECK (takeoff_slot IN ('roof_area', 'ridge', 'hip', 'valley', 'barge', 'spouting', 'underlay', 'fixings', 'custom')),
  -- Source tracking: if this component was imported from a supplier library
  ADD COLUMN IF NOT EXISTS source_component_id uuid REFERENCES public.component_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_library_id uuid,
  ADD COLUMN IF NOT EXISTS source_version integer,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

-- Partial unique index: SKU must be unique within a supplier's components
-- Only enforced when both supplier_profile_id AND sku are present
CREATE UNIQUE INDEX IF NOT EXISTS idx_component_library_supplier_sku
  ON public.component_library (supplier_profile_id, sku)
  WHERE supplier_profile_id IS NOT NULL AND sku IS NOT NULL;

-- Index for finding components by supplier
CREATE INDEX IF NOT EXISTS idx_component_library_supplier
  ON public.component_library (supplier_profile_id)
  WHERE supplier_profile_id IS NOT NULL;

-- Index for takeoff slot lookups
CREATE INDEX IF NOT EXISTS idx_component_library_takeoff_slot
  ON public.component_library (supplier_profile_id, takeoff_slot)
  WHERE supplier_profile_id IS NOT NULL AND takeoff_slot IS NOT NULL;

-- Index for source tracking (find all imported copies of a component)
CREATE INDEX IF NOT EXISTS idx_component_library_source
  ON public.component_library (source_component_id)
  WHERE source_component_id IS NOT NULL;

-- Add supplier capability flag to companies (so we can check without joining)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_supplier boolean NOT NULL DEFAULT false;
