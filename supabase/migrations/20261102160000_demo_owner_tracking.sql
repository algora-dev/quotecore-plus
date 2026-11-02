-- Demo/Workspace toggle (owner-approved 2026-11-02, memory/DEMO_TOGGLE_PLAN.md).
-- Link anonymous guided-walkthrough sandboxes to the real account that launched
-- them, for re-engagement analytics. Additive + nullable (standing permission).

ALTER TABLE public.demo_sessions
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS owner_email text;

COMMENT ON COLUMN public.demo_sessions.owner_user_id IS 'Real app user that launched this sandbox (first-stamp-wins; null = anonymous/untracked).';
COMMENT ON COLUMN public.demo_sessions.owner_email IS 'Email of the real app user at launch time (denormalized for campaign queries).';

-- Marketing view: per-owner demo engagement for re-engagement campaigns
-- ("we see you got to task 2, need help?"). Service-role only: the view is
-- security_invoker, so anon/authenticated stay blocked by demo_sessions RLS.
CREATE OR REPLACE VIEW public.demo_owner_usage
WITH (security_invoker = on) AS
SELECT
  s.id AS session_id,
  s.owner_user_id,
  s.owner_email,
  s.company_id AS demo_company_id,
  s.status,
  s.reset_count,
  s.created_at,
  s.activated_at,
  s.expires_at,
  s.last_seen_at,
  s.tutorial_state ->> 'chapter' AS furthest_chapter,
  s.tutorial_state ->> 'completed_at' AS completed_at,
  CASE
    WHEN jsonb_typeof(s.tutorial_state -> 'acknowledgements') = 'object'
    THEN (SELECT count(*) FROM jsonb_object_keys(s.tutorial_state -> 'acknowledgements'))
    ELSE 0
  END::int AS events_completed
FROM public.demo_sessions s
WHERE s.owner_user_id IS NOT NULL;

COMMENT ON VIEW public.demo_owner_usage IS 'Per-owner guided-walkthrough engagement (furthest chapter, events completed, last active) for re-engagement campaigns. Owner-linked rows persist after sandbox cleanup.';
