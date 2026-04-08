-- Migration: Update measurement_type enum to use 'lineal' instead of 'linear'
-- Date: 2026-04-08
-- Purpose: Align database enum with TypeScript type definition

-- IMPORTANT: PostgreSQL requires enum additions to be committed before use.
-- You MUST run this migration in TWO steps:

-- STEP 1: Run this first, then COMMIT:
ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS 'lineal';

-- STEP 2: After committing step 1, run these updates in a new transaction:
-- UPDATE component_library SET measurement_type = 'lineal' WHERE measurement_type = 'linear';
-- UPDATE quote_components SET measurement_type = 'lineal' WHERE measurement_type = 'linear';

-- Note: We leave both 'linear' and 'lineal' in the enum for backward compatibility.
