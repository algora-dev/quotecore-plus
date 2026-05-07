-- Split "imperial" into two distinct measurement systems so users can pick the
-- area unit that matches how their suppliers / customers actually price work:
--   - imperial_ft : feet for linear, square feet (ft²) for area  (US roofers)
--   - imperial_rs : feet for linear, Roofing Squares (RS) for area (NZ/AU/UK)
--
-- Background:
--   1 Roofing Square (RS) = 100 ft² = 9.2903 m²
--
-- Postgres can ADD enum values cleanly but cannot DROP or RENAME them without
-- swapping the underlying column type. We take the additive path: add the two
-- new values, backfill existing 'imperial' rows to 'imperial_rs' (which is what
-- the UI was producing all along), and stop emitting 'imperial' from new code
-- paths. The legacy 'imperial' value stays in the enum as a deprecated synonym
-- handled by application-side fallback so we don't break any in-flight rows.

-- Add the new enum values. CONCURRENTLY-style additions are not required for
-- enums; ADD VALUE IF NOT EXISTS is idempotent.
ALTER TYPE measurement_system ADD VALUE IF NOT EXISTS 'imperial_ft';
ALTER TYPE measurement_system ADD VALUE IF NOT EXISTS 'imperial_rs';
