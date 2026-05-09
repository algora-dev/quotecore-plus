-- Track when each user last successfully changed their email.
-- Used to enforce a cooldown period (default: 7 days) between email changes
-- to slow down account-takeover attempts that flip the contact address.
--
-- The cooldown is *application-enforced* (server action checks this column
-- before triggering Supabase's email change flow). We keep the column in
-- public.users (mirrored from auth.users) because:
--   1. Existing app code already loads from public.users
--   2. We don't have to grant access to auth.users for cooldown reads
--   3. Supabase's auth schema is treated as read-only operationally

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_email_change_at timestamptz;

COMMENT ON COLUMN public.users.last_email_change_at IS
  'Timestamp of the most recent successful email change for this user. Used by the application to enforce a cooldown period before another change is allowed. Updated by the auth/callback route after Supabase finalises a secure email change.';
