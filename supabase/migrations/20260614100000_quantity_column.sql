-- Migration: Quantity column for customer quote lines + quote-level toggle
-- 2026-06-14
--
-- Adds numeric quantity + unit_price to customer_quote_lines so the new
-- "Quantity Column" feature can store qty × unit_price separately from
-- the legacy free-text quantityText.
--
-- Also adds show_quantity_column to quotes so the editor toggle persists
-- across sessions.
--
-- Backward-compatible (all nullable / with defaults):
--   quantity     defaults to 1   - existing lines behave as before (qty=1)
--   unit_price   defaults to NULL - NULL means "no qty column, use custom_amount as total"
--   show_quantity_column defaults to false - feature is opt-in per quote

ALTER TABLE public.customer_quote_lines
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT NULL;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS show_quantity_column BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.customer_quote_lines.quantity IS
  'Numeric quantity for the Quantity Column feature. Multiplied by unit_price to give the displayed total. Defaults to 1 (= no qty scaling).';

COMMENT ON COLUMN public.customer_quote_lines.unit_price IS
  'Unit price per item when quantity column is active. NULL = legacy mode (use custom_amount as the total directly).';

COMMENT ON COLUMN public.quotes.show_quantity_column IS
  'Whether the Quantity column is toggled on in the Customer Quote Editor for this quote.';
