-- Recovery codes for the optional 2FA system.
--
-- Codes are 12-char strings (formatted XXXX-XXXX-XXXX in the UI). We store only
-- the SHA-256 hash so the raw codes can never leak from the DB. Each code is
-- single-use; using one marks `used_at` and bumps the user back to /2fa/setup
-- to re-enroll a fresh authenticator factor.
--
-- Generating a new batch invalidates the previous batch by deleting all
-- existing rows for that user (handled in the server action, see codes.ts).

CREATE TABLE IF NOT EXISTS public.user_recovery_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_recovery_codes_hash_unique UNIQUE (user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user_unused
  ON public.user_recovery_codes (user_id)
  WHERE used_at IS NULL;

ALTER TABLE public.user_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can read their own rows (so the settings UI can show "X of 10 unused"
-- without needing to call a server action). They can never insert or delete
-- through PostgREST -- those go through service-role server actions only.
CREATE POLICY "user_recovery_codes_self_read" ON public.user_recovery_codes
  FOR SELECT
  USING (user_id = auth.uid());
