-- app_runtime_config: DB-backed runtime config for admin API key + unsubscribe HMAC secret.
-- Rows are read by app/lib/marketing/adminSecrets.ts (service role, 60s cache).
-- Rotating the API key is a SQL UPDATE here - no Vercel env re-paste, no desync.
-- unsubscribe_hmac_secret should NEVER be rotated: it invalidates every sent link.

CREATE TABLE IF NOT EXISTS public.app_runtime_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.app_runtime_config FROM anon, authenticated;

GRANT SELECT ON public.app_runtime_config TO service_role;

-- Seed both secrets. Values are injected at apply time (placeholders replaced).
INSERT INTO public.app_runtime_config (key, value, description) VALUES
  ('admin_signups_api_key', '__ADMIN_SIGNUPS_API_KEY__', 'Bearer key for /api/admin/signups + /api/admin/unsubscribe-link. Rotating does NOT affect unsubscribe links.'),
  ('unsubscribe_hmac_secret', '__UNSUBSCRIBE_HMAC_SECRET__', 'Signs unsubscribe tokens. NEVER rotate - invalidates every sent unsubscribe link.')
ON CONFLICT (key) DO NOTHING;
