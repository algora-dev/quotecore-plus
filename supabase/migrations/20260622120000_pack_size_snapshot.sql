-- Store the pack size at pricing time so display can compute fractional
-- pack counts (e.g. 3.42 rolls) without joining back to component_library.
-- NULL for per_unit components (concept doesn't apply).
-- Additive + nullable: safe on the shared dev+main DB.

ALTER TABLE public.quote_components
  ADD COLUMN IF NOT EXISTS pack_size_snapshot numeric NULL;

COMMENT ON COLUMN public.quote_components.pack_size_snapshot IS
  'Pack size captured at pricing time (e.g. 50 for a 50m2 roll). Used to '
  'compute fractional pack counts for display (final_quantity / pack_size_snapshot). '
  'NULL for per_unit components.';
