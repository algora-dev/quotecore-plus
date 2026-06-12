-- First-login Tutorials welcome modal gate.
-- Per-USER (not per-company): each new user should see the welcome prompt once,
-- even when multiple users share a company. Additive + nullable = safe.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tutorials_seen_at timestamptz;

COMMENT ON COLUMN public.users.tutorials_seen_at IS
  'When the user dismissed the first-login Tutorials welcome modal. NULL = not yet seen (show the modal on dashboard).';
