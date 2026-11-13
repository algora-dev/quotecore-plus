-- Outreach email templates + send log (owner 2026-11-13): the generic
-- "welcome / stuck? need a hand" email we send to selected recent signups,
-- with more onboarding-state emails to follow (demo done but no pricing,
-- pricing done but no saved job, etc). Templates live in the DB so copy
-- changes never need a deploy. Named outreach_* to avoid the pre-existing
-- email_templates table (quote document email templates). Additive;
-- service-role read/write only.

CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  company_id uuid,
  user_id uuid,
  email text NOT NULL,
  status text NOT NULL, -- sent | failed | skipped
  detail text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_send_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS outreach_send_log_template_email_idx
  ON public.outreach_send_log (template_key, email);
CREATE INDEX IF NOT EXISTS outreach_send_log_company_idx
  ON public.outreach_send_log (company_id);

COMMENT ON TABLE public.outreach_templates IS 'DB-stored outreach email templates (admin Emails section). Service-role only.';
COMMENT ON TABLE public.outreach_send_log IS 'One row per outreach email attempt; drives per-recipient dedupe + sent badges.';

-- Seed row (stuck_welcome_help) is inserted separately via REST on apply
-- (dollar-quoted HTML is awkward through the Management API batch runner).
-- Vars: {{first_name}}, {{company_name}}, {{unsubscribe_url}}.
