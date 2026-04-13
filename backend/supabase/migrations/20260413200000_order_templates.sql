-- Migration: Material Order Templates
-- Date: 2026-04-13
-- Purpose: Reusable supplier templates for material orders

-- ============================================================================
-- Table: material_order_templates
-- ============================================================================
-- Stores reusable supplier/header templates for material orders

CREATE TABLE IF NOT EXISTS material_order_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Template info
  name TEXT NOT NULL,                        -- "Main Supplier", "Emergency Supplier", etc.
  description TEXT,
  
  -- Supplier defaults
  default_supplier_name TEXT,
  default_supplier_contact TEXT,
  default_supplier_phone TEXT,
  default_supplier_email TEXT,
  default_delivery_address TEXT,
  default_header_notes TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_template_name_per_company UNIQUE (company_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_material_order_templates_company_id 
  ON material_order_templates(company_id);

CREATE INDEX IF NOT EXISTS idx_material_order_templates_active 
  ON material_order_templates(company_id, is_active);

-- RLS policies
ALTER TABLE material_order_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_order_templates_company_access" ON material_order_templates;
CREATE POLICY "material_order_templates_company_access" ON material_order_templates
  FOR ALL TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_material_order_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS material_order_templates_updated_at ON material_order_templates;
CREATE TRIGGER material_order_templates_updated_at
  BEFORE UPDATE ON material_order_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_material_order_templates_updated_at();

-- Comments
COMMENT ON TABLE material_order_templates IS 'Reusable supplier templates for material orders';
COMMENT ON COLUMN material_order_templates.name IS 'Template name (e.g., "Main Supplier", "Emergency Supplier")';
COMMENT ON COLUMN material_order_templates.default_supplier_name IS 'Default supplier company name';
COMMENT ON COLUMN material_order_templates.default_delivery_address IS 'Default delivery/job site address';

-- ============================================================================
-- Update material_orders table to reference templates
-- ============================================================================

ALTER TABLE material_orders
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES material_order_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN material_orders.template_id IS 'Optional: template used to create this order';
