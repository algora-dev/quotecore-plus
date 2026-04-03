-- Patch 015: Company Onboarding Flow
-- Date: 2026-04-03
-- Purpose: Track onboarding completion and store default language

-- =============================================================================
-- STEP 1: Add default_language column
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'default_language'
  ) THEN
    ALTER TABLE companies ADD COLUMN default_language text DEFAULT 'en' NOT NULL;
    RAISE NOTICE 'Added default_language to companies';
  ELSE
    RAISE NOTICE 'Column default_language already exists in companies';
  END IF;
END $$;

COMMENT ON COLUMN companies.default_language IS 
'ISO 639-1 language code (e.g., en, es, fr). Used for UI localization (future). Currently only "en" is supported.';

-- =============================================================================
-- STEP 2: Add onboarding_completed_at timestamp
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN onboarding_completed_at timestamptz;
    RAISE NOTICE 'Added onboarding_completed_at to companies';
  ELSE
    RAISE NOTICE 'Column onboarding_completed_at already exists in companies';
  END IF;
END $$;

COMMENT ON COLUMN companies.onboarding_completed_at IS 
'Timestamp when company completed initial onboarding (currency, language, measurement selection). NULL = onboarding not complete, redirect to /onboarding page.';

-- =============================================================================
-- STEP 3: Mark existing companies as onboarded (migration)
-- =============================================================================

-- Set all existing companies as already onboarded (they bypassed this flow)
UPDATE companies 
SET onboarding_completed_at = COALESCE(created_at, NOW())
WHERE onboarding_completed_at IS NULL;

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Check companies table
SELECT id, name, default_currency, default_language, default_measurement_system, onboarding_completed_at 
FROM companies 
LIMIT 5;

-- Check for companies that need onboarding (should be 0 after migration)
SELECT COUNT(*) as needs_onboarding
FROM companies 
WHERE onboarding_completed_at IS NULL;

-- =============================================================================
-- Rollback (if needed)
-- =============================================================================

-- ALTER TABLE companies DROP COLUMN IF EXISTS default_language;
-- ALTER TABLE companies DROP COLUMN IF EXISTS onboarding_completed_at;

-- Patch 015 complete
