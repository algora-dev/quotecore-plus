-- Free Workspace offcut metering fix (owner 2026-11-04 report).
--
-- company_admin_grant_usage shipped with kind CHECK (kind = 'quote_sent'),
-- but assertOffcutAllowance inserts kind = 'offcut_generated' — every insert
-- failed the constraint and the error was never destructured, so offcut usage
-- was never recorded or enforced (0 rows prod-wide). Widen the CHECK.
--
-- Applied out-of-band to prod (bcqrrrvbzlfmfgvotzqw) via Management API on
-- 2026-11-04; this file records it for environment parity.

ALTER TABLE public.company_admin_grant_usage
  DROP CONSTRAINT IF EXISTS company_admin_grant_usage_kind_check;

ALTER TABLE public.company_admin_grant_usage
  ADD CONSTRAINT company_admin_grant_usage_kind_check
  CHECK (kind IN ('quote_sent', 'offcut_generated'));
