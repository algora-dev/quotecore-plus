-- patch_055: cold-start session telemetry (temporary debug round, 2026-09-23).
--
-- Purpose: diagnose the iOS PWA "logged out after fully closing the app"
-- issue from data instead of guesses. The login page POSTs ONCE per browser
-- session to /api/auth-session-debug, which records:
--   * cookie_names  - which sb-* cookies the browser actually sent
--                     (server-side view incl. httpOnly: cookie GONE vs
--                     present-but-refresh-failing is the key discriminator)
--   * display_mode  - standalone (home-screen PWA) vs browser tab
--   * referer/source- where the /login load came from (middleware redirect
--                     vs direct cold start)
--   * user_agent    - device/browser identification
--
-- Insert is service-role ONLY (API route). RLS is enabled with NO policies:
-- no client can read or write this table. Drop the table (and the route +
-- ping component) once the issue is resolved.

CREATE TABLE IF NOT EXISTS public.auth_session_debug (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_agent text NOT NULL DEFAULT '',
  referer text NOT NULL DEFAULT '',
  display_mode text NOT NULL DEFAULT '',
  cookie_names text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT ''
);

ALTER TABLE public.auth_session_debug ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.auth_session_debug IS
  'TEMPORARY cold-start session telemetry (patch_055, 2026-09-23). Service-role inserts only via /api/auth-session-debug. Drop after the iOS PWA logout issue is resolved.';
