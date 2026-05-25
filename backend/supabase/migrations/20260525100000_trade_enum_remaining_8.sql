-- Migration: Add the remaining 8 trades to the trade enum
-- Extends quotes.trade and companies.default_trade to support every trade
-- QuoteCore+ targets: landscaping, flooring, tiling, foundations, insulation,
-- painting, fencing, concrete, construction.

ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'landscaping';
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'flooring';
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'tiling';
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'foundations';
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'insulation';
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'painting';
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'fencing';
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'concrete';
ALTER TYPE public.trade ADD VALUE IF NOT EXISTS 'construction';

COMMENT ON TYPE public.trade IS
  'Trade types: roofing, generic, cladding, electrical, plumbing, landscaping, flooring, tiling, foundations, insulation, painting, fencing, concrete, construction. Each trade gates which measurement types and component options are offered in the UI via app/lib/trades/.';
