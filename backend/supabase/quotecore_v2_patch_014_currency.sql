-- Patch 014: Multi-Currency Support
-- Date: 2026-04-03
-- Purpose: Add company default currency + per-quote currency override
-- Pattern: Same as measurement system (company default + quote override)

-- =============================================================================
-- STEP 1: Add default_currency to companies table
-- =============================================================================

ALTER TABLE companies
  ADD COLUMN default_currency text DEFAULT 'NZD' NOT NULL;

COMMENT ON COLUMN companies.default_currency IS 
'ISO 4217 currency code (e.g., NZD, AUD, USD, GBP, EUR). All quotes for this company default to this currency unless overridden.';

-- =============================================================================
-- STEP 2: Add currency to quotes table (nullable = use company default)
-- =============================================================================

ALTER TABLE quotes
  ADD COLUMN currency text;

COMMENT ON COLUMN quotes.currency IS 
'ISO 4217 currency code for this quote. NULL = use company default_currency. Can only be changed on DRAFT quotes (like measurement_system).';

-- =============================================================================
-- STEP 3: Update existing quotes to explicitly use company default
-- =============================================================================

-- Optional: You can leave existing quotes as NULL (they will inherit company default)
-- Or explicitly set them to company default:
-- UPDATE quotes q
-- SET currency = (SELECT default_currency FROM companies WHERE id = q.company_id)
-- WHERE currency IS NULL;

-- =============================================================================
-- STEP 4: Create index for currency lookups
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_quotes_currency ON quotes(currency);

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Check companies table
-- SELECT id, name, default_currency FROM companies LIMIT 5;

-- Check quotes table
-- SELECT id, quote_number, currency, measurement_system FROM quotes LIMIT 10;

-- Verify fallback logic works
-- SELECT 
--   q.id,
--   q.quote_number,
--   COALESCE(q.currency, c.default_currency) as effective_currency
-- FROM quotes q
-- JOIN companies c ON c.id = q.company_id
-- LIMIT 10;

-- =============================================================================
-- Rollback (if needed)
-- =============================================================================

-- ALTER TABLE quotes DROP COLUMN IF EXISTS currency;
-- DROP INDEX IF EXISTS idx_quotes_currency;
-- ALTER TABLE companies DROP COLUMN IF EXISTS default_currency;

-- Patch 014 complete
