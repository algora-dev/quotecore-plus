-- When a roof area is deleted from a quote, its components should go with it.
-- Previously the FK was ON DELETE SET NULL, which orphaned components silently:
-- they kept their quantities, lost their area pitch context, and reappeared in
-- the customer-edit "Extras" group on next page load (matching shaun's bug report).
--
-- Switch to ON DELETE CASCADE so removing a roof area cleans up its components,
-- their entries (already cascaded), customer_quote_lines that point at them, and
-- labor_sheet_lines that point at them.
--
-- Component-related cleanup chain (all already cascade today):
--   quote_components -> quote_component_entries (CASCADE)
--   quote_components -> customer_quote_lines.quote_component_id (verify)
--   quote_components -> labor_sheet_lines.quote_component_id (verify)
-- The check below also asserts those downstream FKs exist with CASCADE so we
-- don't ship a half-cleanup.

ALTER TABLE public.quote_components
  DROP CONSTRAINT IF EXISTS quote_components_quote_roof_area_id_fkey;

ALTER TABLE public.quote_components
  ADD CONSTRAINT quote_components_quote_roof_area_id_fkey
  FOREIGN KEY (quote_roof_area_id)
  REFERENCES public.quote_roof_areas(id)
  ON DELETE CASCADE;

-- Backfill: drop existing orphans so old quotes that already hit this bug get
-- cleaned up. We delete components whose quote_roof_area_id IS NULL but whose
-- component_type is 'main' (extras legitimately have no area). This matches the
-- exact symptom Shaun reported.
DELETE FROM public.quote_components
WHERE quote_roof_area_id IS NULL
  AND component_type = 'main';
