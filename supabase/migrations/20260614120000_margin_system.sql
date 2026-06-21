-- Migration: Margin system for customer quotes
-- 2026-06-14
--
-- Adds per-quote global margin (for blank quotes primarily) and per-line
-- margin overrides so users can:
--   1. Set a global profit margin on the blank quote editor.
--   2. Override margin per individual line (material + optionally labor
--      for lines that come from components with labour_cost > 0).
--
-- Backward-compatible (all nullable / with safe defaults):
--   global_margin_percent   NULL  = no global margin set
--   show_margin_in_preview  TRUE  = show margin breakdown in preview by default
--   line_margin_percent     NULL  = use global margin (or 0% if none)
--   line_labor_margin_percent NULL = use quote's labor_margin_percent (or 0%)

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS global_margin_percent NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS show_margin_in_preview BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.customer_quote_lines
  ADD COLUMN IF NOT EXISTS line_margin_percent NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS line_labor_margin_percent NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.quotes.global_margin_percent IS
  'Global profit margin % applied to all lines in the blank quote editor. NULL = no margin active.';

COMMENT ON COLUMN public.quotes.show_margin_in_preview IS
  'Whether to show the margin breakdown row in the customer-facing quote preview.';

COMMENT ON COLUMN public.customer_quote_lines.line_margin_percent IS
  'Per-line material/custom margin % override. NULL = fall back to quote global_margin_percent or material_margin_percent.';

COMMENT ON COLUMN public.customer_quote_lines.line_labor_margin_percent IS
  'Per-line labor margin % override. Only meaningful for component lines with labour_cost > 0. NULL = fall back to quote labor_margin_percent.';
