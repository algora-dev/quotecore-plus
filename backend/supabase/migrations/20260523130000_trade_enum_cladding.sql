-- Migration: Add 'cladding' to the trade enum
-- Extends quotes.trade and companies.default_trade to support the Cladding trade option.

ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'cladding';

COMMENT ON TYPE public.trade IS
  'Trade types: roofing (original), generic (Phase 7), cladding (Phase 8 — wall area / Wall Length x Height focus).';
