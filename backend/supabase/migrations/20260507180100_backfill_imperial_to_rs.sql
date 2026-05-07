-- Backfill any pre-existing 'imperial' rows to 'imperial_rs' since that's what
-- the legacy UI produced (it converted area to Roofing Squares with the
-- SQM_TO_RS constant). This MUST run in a separate transaction from the enum
-- ADD VALUE migration that introduced 'imperial_rs', because Postgres
-- requires the ADD VALUE statement to commit before the new value can be used.
--
-- Idempotent: safe to re-run; no-op if no 'imperial' rows remain.

UPDATE companies
SET default_measurement_system = 'imperial_rs'
WHERE default_measurement_system = 'imperial';

UPDATE quotes
SET measurement_system = 'imperial_rs'
WHERE measurement_system = 'imperial';
