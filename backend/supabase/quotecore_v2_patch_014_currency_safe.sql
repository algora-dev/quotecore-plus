-- Patch 014: Multi-Currency Support (SAFE VERSION)
-- Date: 2026-04-03
-- Purpose: Add company default currency + per-quote currency override
-- This version checks if columns exist before adding them

-- =============================================================================
-- STEP 1: Add default_currency to companies table (IF NOT EXISTS)
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'default_currency'
  ) THEN
    ALTER TABLE companies ADD COLUMN default_currency text DEFAULT 'NZD' NOT NULL;
    RAISE NOTICE 'Added default_currency to companies';
  ELSE
    RAISE NOTICE 'Column default_currency already exists in companies';
  END IF;
END $$;

COMMENT ON COLUMN companies.default_currency IS 
'ISO 4217 currency code (e.g., NZD, AUD, USD, GBP, EUR). All quotes for this company default to this currency unless overridden.';

-- =============================================================================
-- STEP 2: Add currency to quotes table (IF NOT EXISTS)
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'currency'
  ) THEN
    ALTER TABLE quotes ADD COLUMN currency text;
    RAISE NOTICE 'Added currency to quotes';
  ELSE
    RAISE NOTICE 'Column currency already exists in quotes';
  END IF;
END $$;

COMMENT ON COLUMN quotes.currency IS 
'ISO 4217 currency code for this quote. NULL = use company default_currency. Can only be changed on DRAFT quotes (like measurement_system).';

-- =============================================================================
-- STEP 3: Create index for currency lookups (IF NOT EXISTS)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_quotes_currency ON quotes(currency);

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Check companies table
SELECT id, name, default_currency FROM companies LIMIT 5;

-- Check quotes table
SELECT id, quote_number, currency, measurement_system FROM quotes LIMIT 10;

-- Verify fallback logic works
SELECT 
  q.id,
  q.quote_number,
  COALESCE(q.currency, c.default_currency) as effective_currency
FROM quotes q
JOIN companies c ON c.id = q.company_id
LIMIT 10;

-- Patch 014 complete (safe version)
