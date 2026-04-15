-- Migration: Fix quantity constraint for multiple-length items
-- Date: 2026-04-15
-- Purpose: Allow NULL quantity for multiple-length mode items

-- Remove the old quantity > 0 constraint
ALTER TABLE material_order_lines
  DROP CONSTRAINT IF EXISTS material_order_lines_quantity_check;

-- Make quantity nullable
ALTER TABLE material_order_lines
  ALTER COLUMN quantity DROP NOT NULL;

-- Add new constraint: quantity > 0 OR NULL (allows NULL for multiple mode)
ALTER TABLE material_order_lines
  ADD CONSTRAINT material_order_lines_quantity_check 
  CHECK (quantity IS NULL OR quantity > 0);

COMMENT ON COLUMN material_order_lines.quantity IS 'Quantity for single mode items (NULL for multiple-length mode)';
