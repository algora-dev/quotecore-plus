-- Migration: Add 'plumbing' to the trade enum
-- Extends quotes.trade and companies.default_trade to support the Plumbing trade option.

ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'plumbing';

COMMENT ON TYPE public.trade IS
  'Trade types: roofing (original), generic (Phase 7), cladding (Phase 8 - wall area / Wall Length x Height focus), electrical (Phase 8 - lineal cable runs, curved paths, count-based fittings, hours), plumbing (Phase 8 - lineal pipe runs, curved paths, count-based fixtures, volume, hours).';
