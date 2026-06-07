-- Add include_in_total to invoice_lines.
-- Mirrors customer_quote_lines.include_in_total so the Add $ toggle behaviour
-- is consistent across the app. Default true so existing rows are unaffected.
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS include_in_total boolean NOT NULL DEFAULT true;
