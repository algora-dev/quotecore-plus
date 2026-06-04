-- =====================================================================
-- Per-user "Chat Assistant" visibility preference
-- =====================================================================
-- Lets a user fully hide the Q chat assistant (launcher + panel) from
-- Account settings, mirroring the old Copilot on/off behaviour.
--
-- New column: public.users.assistant_enabled (default TRUE = visible).
-- This is a fresh, clearly-named column. The legacy `copilot_enabled`
-- column (dead since Copilot was removed) is intentionally left untouched.
--
-- Additive + nullable-safe (NOT NULL with a default). One DB serves
-- dev+prod; safe to apply per standing permission (no drops/data loss).
-- =====================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS assistant_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.assistant_enabled IS
  'Whether the Q chat assistant is visible for this user. Default true. When false the AssistantWidget renders nothing (launcher + panel hidden). Per-user UX preference, NOT a security control (the feature flag + API guards remain authoritative).';

COMMIT;
