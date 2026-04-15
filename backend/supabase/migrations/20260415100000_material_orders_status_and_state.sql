-- Migration: Material Orders - Add Status and Full State Storage
-- Date: 2026-04-15
-- Purpose: Add status tracking and comprehensive state storage for orders

-- ============================================================================
-- Add status column to material_orders
-- ============================================================================

ALTER TABLE material_orders
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered'));

COMMENT ON COLUMN material_orders.status IS 'Order status: draft (being edited) or ordered (submitted to supplier)';

-- ============================================================================
-- Expand material_order_lines to store full component state
-- ============================================================================

ALTER TABLE material_order_lines
  ADD COLUMN IF NOT EXISTS entry_mode TEXT DEFAULT 'single' CHECK (entry_mode IN ('single', 'multiple')),
  ADD COLUMN IF NOT EXISTS lengths JSONB,                    -- For multiple lengths mode: [{length, multiplier, variables}]
  ADD COLUMN IF NOT EXISTS length_unit TEXT,                 -- Unit for lengths (m, ft, etc.)
  ADD COLUMN IF NOT EXISTS flashing_id UUID REFERENCES flashing_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS show_component_name BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_flashing_image BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_measurements BOOLEAN DEFAULT true;

COMMENT ON COLUMN material_order_lines.entry_mode IS 'single (bulk quantity) or multiple (individual lengths with multipliers)';
COMMENT ON COLUMN material_order_lines.lengths IS 'Array of length entries for multiple mode: [{length, multiplier, variables: [{name, value, unit}]}]';
COMMENT ON COLUMN material_order_lines.length_unit IS 'Unit for individual lengths (m, ft, etc.)';
COMMENT ON COLUMN material_order_lines.flashing_id IS 'Reference to flashing_library for drawing image';
COMMENT ON COLUMN material_order_lines.show_component_name IS 'Visibility toggle: show component name on order';
COMMENT ON COLUMN material_order_lines.show_flashing_image IS 'Visibility toggle: show flashing drawing on order';
COMMENT ON COLUMN material_order_lines.show_measurements IS 'Visibility toggle: show measurements on order';

-- ============================================================================
-- Add template and layout preferences to material_orders
-- ============================================================================

ALTER TABLE material_orders
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES material_order_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'single' CHECK (layout_mode IN ('single', 'double')),
  ADD COLUMN IF NOT EXISTS to_supplier TEXT,
  ADD COLUMN IF NOT EXISTS from_company TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_details TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS order_type TEXT,
  ADD COLUMN IF NOT EXISTS colours TEXT,
  ADD COLUMN IF NOT EXISTS order_date DATE;

COMMENT ON COLUMN material_orders.template_id IS 'Template used to create this order (if any)';
COMMENT ON COLUMN material_orders.layout_mode IS 'Display layout: single (large images) or double (compact grid)';
COMMENT ON COLUMN material_orders.to_supplier IS 'Supplier name (who the order is TO)';
COMMENT ON COLUMN material_orders.from_company IS 'Company name (who the order is FROM)';
COMMENT ON COLUMN material_orders.contact_person IS 'Contact person for this order';
COMMENT ON COLUMN material_orders.contact_details IS 'Contact phone/email';
COMMENT ON COLUMN material_orders.logo_url IS 'Company logo URL for this order';
COMMENT ON COLUMN material_orders.reference IS 'Job reference or quote number';
COMMENT ON COLUMN material_orders.order_type IS 'Order type (e.g., roof, flashings, underlay)';
COMMENT ON COLUMN material_orders.colours IS 'Job colours (plain text, not array)';
COMMENT ON COLUMN material_orders.order_date IS 'Date the order was created/placed';

-- ============================================================================
-- Clean up deprecated columns (optional - comment out if you want to keep them)
-- ============================================================================

-- These columns are now stored in the new structure:
-- job_name → reference
-- delivery_address → delivery_address (keep)
-- supplier_name → to_supplier
-- supplier_contact → contact_details
-- job_colours → colours (text instead of array)
-- header_notes → order_notes (rename if needed)

-- Uncomment if you want to drop old columns:
-- ALTER TABLE material_orders DROP COLUMN IF EXISTS job_name;
-- ALTER TABLE material_orders DROP COLUMN IF EXISTS supplier_name;
-- ALTER TABLE material_orders DROP COLUMN IF EXISTS supplier_contact;
-- ALTER TABLE material_orders DROP COLUMN IF EXISTS job_colours;
