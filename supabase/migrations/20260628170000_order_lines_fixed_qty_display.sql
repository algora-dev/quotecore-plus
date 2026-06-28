-- Order lines: store Fixed Quantity display data so the order editor and
-- supplier-facing preview can render "quantity (measurement)" for components
-- priced by per_pack_* strategies.
--
-- priced_quantity    = rounded-up purchasable unit count (e.g. 5 bundles).
--                      Mirrors quote_components.priced_quantity at order creation.
-- measurement_display = human-readable total length/area/volume (e.g. "23.4m").
--                       Pre-computed at order creation from the quote component's
--                       final_quantity converted to the quote's display unit.
--
-- Both nullable: existing rows and per_unit components have NULL.
-- Additive + nullable: safe on the shared dev+main DB.

ALTER TABLE public.material_order_lines
  ADD COLUMN IF NOT EXISTS priced_quantity numeric NULL,
  ADD COLUMN IF NOT EXISTS measurement_display text NULL;

COMMENT ON COLUMN public.material_order_lines.priced_quantity IS
  'Rounded-up purchasable unit count for Fixed Quantity pricing. NULL for per_unit.';
COMMENT ON COLUMN public.material_order_lines.measurement_display IS
  'Pre-computed measurement string (e.g. "23.4m") for Fixed Quantity display. NULL for per_unit.';
