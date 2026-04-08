-- Migration: Update measurement_type enum to use 'lineal' instead of 'linear'
-- Date: 2026-04-08
-- Purpose: Align database enum with TypeScript type definition

-- Step 1: Add 'lineal' as a new enum value
ALTER TYPE measurement_type ADD VALUE IF NOT EXISTS 'lineal';

-- Step 2: Update all existing 'linear' values to 'lineal'
UPDATE component_library SET measurement_type = 'lineal' WHERE measurement_type = 'linear';
UPDATE quote_components SET measurement_type = 'lineal' WHERE measurement_type = 'linear';
UPDATE template_components SET measurement_type = 'lineal' WHERE measurement_type = 'linear';

-- Step 3: Remove 'linear' from the enum (PostgreSQL doesn't support this directly)
-- We'll leave 'linear' in the enum for backward compatibility but all data now uses 'lineal'

-- Note: To fully remove 'linear' from the enum would require:
-- 1. Creating a new enum type without 'linear'
-- 2. Altering all columns to use the new type
-- 3. Dropping the old type
-- This is complex and risky, so we'll leave both values in the enum for now.
