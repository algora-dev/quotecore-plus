-- Migration: Material Orders System - Phase 1
-- Date: 2026-04-10
-- Purpose: Create tables for material order system (orders, line items, flashing library)

-- ============================================================================
-- Table: flashing_library
-- ============================================================================
-- Stores reusable flashing designs/drawings for material orders

CREATE TABLE IF NOT EXISTS flashing_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,              -- Saved canvas export (PNG) in storage
  canvas_data JSONB,                    -- Optional: save canvas state for re-editing
  is_default BOOLEAN DEFAULT false,     -- Company default flashings
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS flashing_library_company_id_idx ON flashing_library(company_id);

-- RLS policies
ALTER TABLE flashing_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flashing_library_company_access" ON flashing_library;
CREATE POLICY "flashing_library_company_access" ON flashing_library
  FOR ALL TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_flashing_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS flashing_library_updated_at ON flashing_library;
CREATE TRIGGER flashing_library_updated_at
  BEFORE UPDATE ON flashing_library
  FOR EACH ROW
  EXECUTE FUNCTION update_flashing_library_updated_at();

COMMENT ON TABLE flashing_library IS 'Stores reusable flashing designs/drawings for material orders';
COMMENT ON COLUMN flashing_library.image_url IS 'URL to saved canvas export (PNG) in storage';
COMMENT ON COLUMN flashing_library.canvas_data IS 'Optional: canvas state (JSON) for re-editing';
COMMENT ON COLUMN flashing_library.is_default IS 'Company default/standard flashings';

-- ============================================================================
-- Table: material_orders
-- ============================================================================
-- Stores material order headers (quote-based or standalone)

CREATE TABLE IF NOT EXISTS material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,  -- NULL for standalone orders
  order_number TEXT NOT NULL,            -- Auto-generated or quote-based
  job_name TEXT,
  delivery_address TEXT,
  supplier_name TEXT,
  supplier_contact TEXT,
  delivery_date DATE,
  job_colours TEXT[],                    -- Array of color names
  header_notes TEXT,
  is_sent BOOLEAN DEFAULT false,         -- Manual checkbox: has this been sent?
  pdf_url TEXT,                          -- Link to generated PDF in storage
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_order_number_per_company UNIQUE (company_id, order_number)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS material_orders_company_id_idx ON material_orders(company_id);
CREATE INDEX IF NOT EXISTS material_orders_quote_id_idx ON material_orders(quote_id);
CREATE INDEX IF NOT EXISTS material_orders_created_at_idx ON material_orders(created_at DESC);

-- RLS policies
ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_orders_company_access" ON material_orders;
CREATE POLICY "material_orders_company_access" ON material_orders
  FOR ALL TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_material_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS material_orders_updated_at ON material_orders;
CREATE TRIGGER material_orders_updated_at
  BEFORE UPDATE ON material_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_material_orders_updated_at();

COMMENT ON TABLE material_orders IS 'Stores material order headers (quote-based or standalone)';
COMMENT ON COLUMN material_orders.quote_id IS 'NULL for standalone orders, references quote for quote-based orders';
COMMENT ON COLUMN material_orders.order_number IS 'Auto-generated unique order number per company';
COMMENT ON COLUMN material_orders.job_colours IS 'Array of color names for the job';
COMMENT ON COLUMN material_orders.is_sent IS 'Manual checkbox: has this order been sent to supplier?';
COMMENT ON COLUMN material_orders.pdf_url IS 'URL to generated PDF in storage';

-- ============================================================================
-- Table: material_order_lines
-- ============================================================================
-- Stores individual line items within a material order

CREATE TABLE IF NOT EXISTS material_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  component_id UUID REFERENCES component_library(id) ON DELETE SET NULL,  -- NULL for custom items
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT,
  flashing_image_url TEXT,              -- Link to flashing drawing (can be from library or custom)
  item_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS material_order_lines_order_id_idx ON material_order_lines(order_id);
CREATE INDEX IF NOT EXISTS material_order_lines_sort_order_idx ON material_order_lines(order_id, sort_order);

-- RLS policies
ALTER TABLE material_order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_order_lines_company_access" ON material_order_lines;
CREATE POLICY "material_order_lines_company_access" ON material_order_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM material_orders mo
      WHERE mo.id = material_order_lines.order_id
      AND mo.company_id = current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM material_orders mo
      WHERE mo.id = material_order_lines.order_id
      AND mo.company_id = current_company_id()
    )
  );

COMMENT ON TABLE material_order_lines IS 'Stores individual line items within a material order';
COMMENT ON COLUMN material_order_lines.component_id IS 'NULL for custom/freeform items, references component_library for standard items';
COMMENT ON COLUMN material_order_lines.flashing_image_url IS 'URL to flashing drawing image (from library or custom upload)';
COMMENT ON COLUMN material_order_lines.item_notes IS 'Optional notes specific to this line item';

-- ============================================================================
-- Updates to component_library
-- ============================================================================
-- Add columns to support material orders

ALTER TABLE component_library
  ADD COLUMN IF NOT EXISTS eligible_for_orders BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_flashing_id UUID REFERENCES flashing_library(id) ON DELETE SET NULL;

COMMENT ON COLUMN component_library.eligible_for_orders IS 'Whether this component can be included in material orders';
COMMENT ON COLUMN component_library.default_flashing_id IS 'Default flashing design to use for this component in material orders';
