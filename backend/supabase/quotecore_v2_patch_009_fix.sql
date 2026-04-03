-- Patch 009 Fix: Add show_price column to customer_quote_lines
-- Run this after patch 009 if show_price column is missing

ALTER TABLE public.customer_quote_lines
  ADD COLUMN IF NOT EXISTS show_price boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.customer_quote_lines.show_price IS 
  'Whether to display the price for this line in the customer quote. False hides the price column but still includes amount in total.';
