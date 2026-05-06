-- mfa_required is the user-controlled "is 2FA active for my account?" toggle.
--
-- We need this in addition to Supabase's MFA factor table so the user can
-- temporarily disable 2FA without deleting and re-scanning a fresh QR every
-- time. The middleware combines this flag with getAuthenticatorAssuranceLevel
-- to decide whether to gate the user behind /2fa.
--
-- Default false: existing users without 2FA see no behaviour change. The flag
-- is auto-flipped to true when a user verifies their first TOTP factor (handled
-- in the enroll flow) and back to false when their last factor is removed.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing users who already have a verified TOTP factor on the
-- Supabase auth side, so we don't break their current login flow on first
-- deploy. We can't read auth.mfa_factors directly without service-role, but
-- the factors live in the auth schema and are joinable on user_id.
UPDATE public.users u
SET mfa_required = TRUE
WHERE EXISTS (
  SELECT 1 FROM auth.mfa_factors f
  WHERE f.user_id = u.id
    AND f.status = 'verified'
);
