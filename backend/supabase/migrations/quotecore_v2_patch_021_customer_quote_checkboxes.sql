-- Migration: Add checkbox fields to customer_quote_lines table
-- Date: 2026-04-08
-- Purpose: Support showUnits and includeInTotal checkboxes in customer quote editor

ALTER TABLE customer_quote_lines
  ADD COLUMN IF NOT EXISTS show_units BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_in_total BOOLEAN DEFAULT true;

-- Backfill existing rows with default values
UPDATE customer_quote_lines
SET show_units = true, include_in_total = true
WHERE show_units IS NULL OR include_in_total IS NULL;
