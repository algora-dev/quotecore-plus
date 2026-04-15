-- Migration: Rename status 'draft' to 'ready'
-- Date: 2026-04-15
-- Purpose: Update terminology - saved orders are 'ready' not 'draft'

-- Update constraint to allow 'ready' and 'ordered'
ALTER TABLE material_orders DROP CONSTRAINT IF EXISTS material_orders_status_check;
ALTER TABLE material_orders ADD CONSTRAINT material_orders_status_check CHECK (status IN ('ready', 'ordered'));

-- Rename existing 'draft' records to 'ready'
UPDATE material_orders SET status = 'ready' WHERE status = 'draft';

-- Update default value
ALTER TABLE material_orders ALTER COLUMN status SET DEFAULT 'ready';

COMMENT ON COLUMN material_orders.status IS 'Order status: ready (saved, not sent) or ordered (sent to supplier)';
