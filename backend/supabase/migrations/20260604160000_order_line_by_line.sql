-- =====================================================================
-- Material orders: "Line by Line" layout storage
-- =====================================================================
-- Adds support for a third order layout, "line_by_line", which renders the
-- order as a customer-quote-style line list (Item / description / qty / price
-- with per-line show/hide controls). This is a SEPARATE document family from
-- the existing single/double "Components + Images" layout and is chosen up
-- front (before the editor opens); it cannot be switched to/from afterwards.
--
-- The line-by-line editor reuses the CustomerQuoteEditor, whose lines are a
-- self-contained array (text, quantityText, qty, price, showPrice, showUnits,
-- visibility, ordering). Rather than mapping that onto material_order_lines
-- (which is a no-price supplier-line model), we persist the editor's native
-- line array verbatim as JSON on the order. Single/double orders never use it.
--
-- layout_mode is already free-text (nullable) so the new 'line_by_line' value
-- needs no schema change there.
--
-- Additive + nullable. One DB serves dev+prod; safe to apply per standing
-- permission (no drops, no data loss). Existing orders unaffected (NULL).
-- =====================================================================

BEGIN;

ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS line_by_line_data JSONB;

COMMENT ON COLUMN public.material_orders.line_by_line_data IS
  'For layout_mode = ''line_by_line'': the CustomerQuoteEditor line array (and any header/footer/branding state) serialised verbatim. NULL for single/double "Components + Images" orders, which use material_order_lines instead.';

COMMIT;
