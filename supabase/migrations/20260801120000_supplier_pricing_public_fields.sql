-- Migration: 20260801120000_supplier_pricing_public_fields.sql
-- Adds public-facing pricing and location fields to supplier_profiles
-- for AI-discoverable supplier pricing and tool discovery.

ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NZD',
  ADD COLUMN IF NOT EXISTS tax_treatment text NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS default_trade text NOT NULL DEFAULT 'roofing',
  ADD COLUMN IF NOT EXISTS instant_pricing_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'indicative'
    CHECK (price_type IN ('indicative', 'estimate', 'firm_quote', 'purchasable')),
  ADD COLUMN IF NOT EXISTS delivery_assumptions text,
  ADD COLUMN IF NOT EXISTS exclusions text;

-- Add constraint for country code format (ISO 2-letter)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_profiles_country_chk') THEN
    ALTER TABLE public.supplier_profiles
      ADD CONSTRAINT supplier_profiles_country_chk
      CHECK (country IS NULL OR length(country) = 2);
  END IF;
END $$;

-- Update existing approved suppliers to have instant_pricing_available = true
-- (they already have published catalogues with pricing)
UPDATE public.supplier_profiles
  SET instant_pricing_available = true,
      pricing_updated_at = NOW(),
      price_valid_until = NOW() + INTERVAL '90 days'
  WHERE status = 'approved' AND instant_pricing_available = false;

-- Index for searching by country/trade
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_country
  ON public.supplier_profiles (country)
  WHERE country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_profiles_default_trade
  ON public.supplier_profiles (default_trade);
