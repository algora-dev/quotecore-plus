-- Migration: independent hide-line-prices + hide-totals toggles on quotes + invoices
-- 2026-06-14
--
-- Separates price visibility into two orthogonal flags:
--   hide_line_prices: hides the price on each individual line item
--   hide_totals:      hides the subtotal / taxes / grand total footer
--
-- Both default FALSE so existing documents are unaffected.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS hide_line_prices BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hide_totals BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS hide_line_prices BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hide_totals BOOLEAN NOT NULL DEFAULT FALSE;
