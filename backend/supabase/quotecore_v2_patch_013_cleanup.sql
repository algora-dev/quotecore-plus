-- Patch 013: Cleanup — Drop unused customer_quote_template_lines table
-- Date: 2026-04-03
-- Reason: Template system redesigned to store branding only (no line items)
-- 
-- Impact: customer_quote_template_lines table is no longer used
-- Safe to drop: No production data (branding-only model is in production)

-- Drop the unused lines table
DROP TABLE IF EXISTS customer_quote_template_lines;

-- Add comment to customer_quote_templates table documenting the branding-only model
COMMENT ON TABLE customer_quote_templates IS 
'Customer quote branding templates (company details + logo + footer). Line items not stored; component display defaults come from component_library (show_price_default, show_dimensions_default), per-quote overrides in customer_quote_lines.';

-- Cleanup complete
-- Next steps: None (cleanup complete)
