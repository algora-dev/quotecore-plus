-- Add is_admin flag on users for the /admin surface.
--
-- The admin surface is a separate area at /admin (login at /admin/login)
-- used for support-ticket triage and, later, broader account actions.
-- Admin permission is a row-level flag rather than a separate identity to
-- keep auth simple: one Supabase Auth account, one users row, the flag
-- decides whether the admin paths render.
--
-- Defaults to false so no existing user is auto-promoted. To make a user
-- an admin, run:
--   UPDATE public.users SET is_admin = true WHERE email = '<email>';
-- via the SQL editor (or the in-app admin promotion flow once it ships).
--
-- This column is read by middleware on every /admin/* request, so we add
-- a partial index on the truthy value to keep the per-request lookup
-- fast even as the users table grows.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_admin IS
  'When true, the user can access the /admin surface (support-ticket triage etc.). Set manually for now; admin promotion UI is a follow-up.';

CREATE INDEX IF NOT EXISTS users_is_admin_idx
  ON public.users (id)
  WHERE is_admin = true;
