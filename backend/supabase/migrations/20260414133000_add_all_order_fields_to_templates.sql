-- Migration: Add All Order Fields to Templates
-- Date: 2026-04-14
-- Purpose: Templates should have all the same fields as orders for flexible pre-filling

-- Add missing fields to material_order_templates
ALTER TABLE material_order_templates
  ADD COLUMN IF NOT EXISTS default_reference TEXT,
  ADD COLUMN IF NOT EXISTS default_order_type TEXT,
  ADD COLUMN IF NOT EXISTS default_colours TEXT[],
  ADD COLUMN IF NOT EXISTS default_from_company TEXT,
  ADD COLUMN IF NOT EXISTS default_contact_person TEXT,
  ADD COLUMN IF NOT EXISTS default_contact_details TEXT;

-- Comments
COMMENT ON COLUMN material_order_templates.default_reference IS 'Default job reference (usually left blank in templates)';
COMMENT ON COLUMN material_order_templates.default_order_type IS 'Default order type (e.g., "roof, flashings, underlay")';
COMMENT ON COLUMN material_order_templates.default_colours IS 'Default colour tags array';
COMMENT ON COLUMN material_order_templates.default_from_company IS 'Default "From" company name (your company)';
COMMENT ON COLUMN material_order_templates.default_contact_person IS 'Default contact person name';
COMMENT ON COLUMN material_order_templates.default_contact_details IS 'Default contact details (phone/email)';
