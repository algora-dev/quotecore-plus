-- Demo-first onboarding flow (owner 2026-11-13): company-level one-time
-- stamps for the welcome + tips modals shown over the guided demo, the
-- first personal-workspace visit anchor, and the two activation nudges
-- (add-your-pricing, first-quote). Additive + nullable (standing
-- permission); service-role read/write only, same pattern as the
-- free_entry_modal columns (20261107120000).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS welcome_modal_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_modal_choice text,
  ADD COLUMN IF NOT EXISTS demo_tips_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_workspace_visit_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_nudge_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_nudge_shown_at timestamptz;

COMMENT ON COLUMN public.companies.welcome_modal_seen_at IS 'Demo-first flow: when the welcome modal (founder video) was shown over the guided demo; first stamp wins.';
COMMENT ON COLUMN public.companies.welcome_modal_choice IS 'Demo-first flow: welcome-modal choice continue | get_in_touch (first stamp wins).';
COMMENT ON COLUMN public.companies.demo_tips_seen_at IS 'Demo-first flow: when the first-three-tasks tips modal was dismissed.';
COMMENT ON COLUMN public.companies.first_workspace_visit_at IS 'Demo-first flow: first visit to the personal workspace; anchors the activation nudges.';
COMMENT ON COLUMN public.companies.pricing_nudge_shown_at IS 'Demo-first flow: when the add-your-pricing nudge modal was shown (once per account).';
COMMENT ON COLUMN public.companies.quote_nudge_shown_at IS 'Demo-first flow: when the first-quote nudge modal was shown (once per account).';
