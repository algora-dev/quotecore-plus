-- Fixed Quantity pricing: store the rounded-up purchasable unit count
-- alongside the actual (fractional) unit count.
--
-- Context: components priced by a fixed purchasable unit (e.g. roofing tiles
-- sold only in 50m2 bundles at $500/bundle) must round UP to whole bundles
-- for pricing. computeMaterialCostByStrategy already prices off the rounded
-- pack count, but the rounded count was discarded after computing cost.
--
-- final_quantity  = actual purchasable units (e.g. 4.84 bundles) - unchanged meaning.
--                   For per_unit components this stays the raw measured quantity.
-- priced_quantity = rounded-up units the customer is charged for (e.g. 5 bundles).
--                   NULL for per_unit components (no rounding concept; UI falls
--                   back to final_quantity exactly as before).
--
-- Additive + nullable: safe on the shared dev+main DB. No data backfill required;
-- recalcComponentFromEntries repopulates priced_quantity on the next quote save.

ALTER TABLE public.quote_components
  ADD COLUMN IF NOT EXISTS priced_quantity numeric NULL;

COMMENT ON COLUMN public.quote_components.priced_quantity IS
  'Rounded-up purchasable unit count used for pricing (Fixed Quantity strategies). NULL for per_unit.';
