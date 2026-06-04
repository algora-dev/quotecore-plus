-- =====================================================================
-- Material orders: allow 'line_by_line' in the layout_mode CHECK constraint
-- =====================================================================
-- The Part 1 line-by-line migration (20260604160000) added the
-- `line_by_line_data` column but incorrectly assumed `layout_mode` was
-- free-text. In reality `material_orders` has a CHECK constraint
-- (`material_orders_layout_mode_check`) limiting layout_mode to
-- ('single','double'). Any attempt to save a line-by-line order therefore
-- violated the constraint and failed ("Failed to save order").
--
-- This migration replaces the constraint to also permit 'line_by_line'.
-- Additive/permissive (widens allowed values); no data loss; existing rows
-- (single/double/NULL) remain valid. Safe to apply per standing permission.
-- =====================================================================

BEGIN;

ALTER TABLE public.material_orders
  DROP CONSTRAINT IF EXISTS material_orders_layout_mode_check;

ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_layout_mode_check
  CHECK (layout_mode IS NULL OR layout_mode = ANY (ARRAY['single'::text, 'double'::text, 'line_by_line'::text]));

COMMIT;
