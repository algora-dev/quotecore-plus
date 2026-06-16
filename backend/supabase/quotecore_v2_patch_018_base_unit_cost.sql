-- patch_018: Add base_unit_cost to customer_quote_lines
-- Stores the pre-margin cost per unit for custom/catalog/component-library lines so
-- that global material margin changes can recompute exact final amounts rather than
-- relying on proportional back-calculation from the stored custom_amount.
-- Nullable: NULL for existing lines and component lines (which use baseMaterialCost
-- from the quote_components table instead).

ALTER TABLE public.customer_quote_lines
  ADD COLUMN IF NOT EXISTS base_unit_cost NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.customer_quote_lines.base_unit_cost IS
  'Pre-margin cost per unit for custom/catalog lines. Final amount = base_unit_cost * quantity * (1 + material_margin%). NULL for component lines and pre-018 rows.';
