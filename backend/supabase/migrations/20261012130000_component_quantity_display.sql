-- Component quantity display preference (owner spec 2026-10-12):
-- area-measured components with a lineal cover can display their quantity as
-- lineal metres, both, or area-only. The stored measurement is ALWAYS m²;
-- lm is derived at display: m² / (cover_width_mm / 1000). Pricing never changes.
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS quantity_display TEXT NULL
  CONSTRAINT component_library_quantity_display_check
  CHECK (quantity_display IN ('area', 'lineal', 'both'));

-- Per-quote snapshot columns (pattern: pack_size_snapshot) so existing quotes
-- render with the preferences they were built with. Legacy rows stay NULL and
-- fall back to the linked component_library row at render time.
ALTER TABLE public.quote_components
  ADD COLUMN IF NOT EXISTS quantity_display TEXT NULL,
  ADD COLUMN IF NOT EXISTS cover_width_mm TEXT NULL;
