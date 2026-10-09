-- Lineal-with-cover component basis (owner directive 2026-10-09 17:27):
-- area-measured components can be SOLD by lineal metres. cover_width_mm is
-- the effective cover per lineal metre (e.g. 760 = 0.760 m of roof per lm).
-- Conversion happens at the quote-line level: qty_lm = qty_m2 / (cover/1000).
-- Measurement rows stay canonical m2; cost parity is preserved by scaling
-- the per-unit line rates (rate_lm = rate_m2 x cover_m).
-- NULL sold_by = legacy m2 behaviour - no existing component changes.
ALTER TABLE public.component_library
  ADD COLUMN IF NOT EXISTS sold_by text
    CONSTRAINT ck_component_library_sold_by CHECK (sold_by IS NULL OR sold_by IN ('area', 'lineal')),
  ADD COLUMN IF NOT EXISTS cover_width_mm numeric
    CONSTRAINT ck_component_library_cover_positive CHECK (cover_width_mm IS NULL OR cover_width_mm > 0);

COMMENT ON COLUMN public.component_library.sold_by IS 'Selling basis for area-measured components: area (m2, default/legacy) or lineal (metres via cover_width_mm). NULL = area.';
COMMENT ON COLUMN public.component_library.cover_width_mm IS 'Effective cover per lineal metre in mm (e.g. 760). Required when sold_by = lineal.';
