-- Add a per-user toggle for receiving in-app alerts via email.
-- Defaults to TRUE so existing users start with notifications enabled, in line
-- with their expectation when the feature ships. Security emails (password
-- changes, recovery-code logins, 2FA changes, email-change confirmations) are
-- NOT gated by this flag — they are always sent.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.email_notifications_enabled IS
  'When TRUE, the user receives transactional emails for in-app alerts (quote accepted/declined, revision requested, etc.). Security emails always send regardless of this flag.';
