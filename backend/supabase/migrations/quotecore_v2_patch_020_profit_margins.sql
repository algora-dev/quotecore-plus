-- QuoteCore v2 Patch 020: Profit Margins System
-- Adds company-level default margins and per-quote margin controls
-- Author: Gavin
-- Date: 2026-04-05

-- =============================================================================
-- 1. Add default margin columns to companies table
-- =============================================================================

-- Company-level defaults (used for all new quotes unless overridden)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS default_material_margin_percent NUMERIC DEFAULT 0 CHECK (default_material_margin_percent >= 0 AND default_material_margin_percent <= 100),
ADD COLUMN IF NOT EXISTS default_labor_margin_percent NUMERIC DEFAULT 0 CHECK (default_labor_margin_percent >= 0 AND default_labor_margin_percent <= 100);

COMMENT ON COLUMN companies.default_material_margin_percent IS 'Default material margin percentage applied to new quotes (0-100)';
COMMENT ON COLUMN companies.default_labor_margin_percent IS 'Default labor margin percentage applied to new quotes (0-100)';

-- =============================================================================
-- 2. Add per-quote margin columns to quotes table
-- =============================================================================

-- Per-quote margin settings (NULL = use company default)
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS material_margin_percent NUMERIC CHECK (material_margin_percent IS NULL OR (material_margin_percent >= 0 AND material_margin_percent <= 100)),
ADD COLUMN IF NOT EXISTS labor_margin_percent NUMERIC CHECK (labor_margin_percent IS NULL OR (labor_margin_percent >= 0 AND labor_margin_percent <= 100)),
ADD COLUMN IF NOT EXISTS material_margin_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS labor_margin_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN quotes.material_margin_percent IS 'Material margin % for this quote (NULL = use company default)';
COMMENT ON COLUMN quotes.labor_margin_percent IS 'Labor margin % for this quote (NULL = use company default)';
COMMENT ON COLUMN quotes.material_margin_enabled IS 'Whether to apply material margin to this quote';
COMMENT ON COLUMN quotes.labor_margin_enabled IS 'Whether to apply labor margin to this quote';

-- =============================================================================
-- 3. Indexes (optional, for query performance)
-- =============================================================================

-- No indexes needed - these are simple boolean/numeric columns with low cardinality

-- =============================================================================
-- ROLLBACK (if needed)
-- =============================================================================

-- To rollback this migration:
-- ALTER TABLE companies DROP COLUMN IF EXISTS default_material_margin_percent, DROP COLUMN IF EXISTS default_labor_margin_percent;
-- ALTER TABLE quotes DROP COLUMN IF EXISTS material_margin_percent, DROP COLUMN IF EXISTS labor_margin_percent, DROP COLUMN IF EXISTS material_margin_enabled, DROP COLUMN IF EXISTS labor_margin_enabled;
