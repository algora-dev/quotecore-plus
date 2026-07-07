-- Migration: add calc_audit JSONB column to quote_components
-- Stores a structured calculation trace per component: every step from
-- raw inputs → pitch → waste → pack rounding → final qty → costs.
-- Also tracks manual overrides (previous value + who/when).
--
-- Nullable: existing rows get NULL. New saves populate it.
-- Size: ~2-5KB per component. Negligible vs existing JSONB columns.

ALTER TABLE quote_components
  ADD COLUMN IF NOT EXISTS calc_audit jsonb DEFAULT NULL;

COMMENT ON COLUMN quote_components.calc_audit IS
  'Structured calculation trace: raw inputs → pitch → waste → pack → costs + manual override history';
