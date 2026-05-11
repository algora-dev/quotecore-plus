-- Docs feedback events.
--
-- Captures the helpful / not-helpful votes from the in-app help drawer so we
-- can see which docs are failing users instead of relying on `console.info`
-- (Gerald audit M-04, 2026-05-11).
--
-- Shape decisions:
--   * One row per vote, not per user-per-doc, so we can see how feedback
--     trends over time when content changes.
--   * `slug` is free text (not a FK) so a vote against a doc we later
--     delete still carries its history.
--   * `user_id` / `company_id` are nullable: anonymous public docs traffic
--     should still be able to vote later, even though the in-app drawer
--     today only runs authenticated.
--   * `reason` is optional free text for a future \"tell us more\" follow-up
--     prompt; reserve the column now so we don't migrate again.
--
-- RLS:
--   * INSERT is allowed for any authenticated user, but the row must carry
--     the caller's own `user_id` and `company_id` (or null if the policy is
--     ever broadened to anonymous later).
--   * SELECT is admin-only for now (service role bypasses RLS, which is how
--     the future admin dashboard will read it). We do NOT give users a way
--     to read each other's votes.

CREATE TABLE IF NOT EXISTS public.docs_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL CHECK (char_length(slug) BETWEEN 0 AND 500),
  vote        text NOT NULL CHECK (vote IN ('up', 'down')),
  reason      text CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 4000),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id  uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  -- Best-effort context for triage.
  app_path    text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS docs_feedback_slug_idx
  ON public.docs_feedback (slug, created_at DESC);

CREATE INDEX IF NOT EXISTS docs_feedback_vote_idx
  ON public.docs_feedback (vote, created_at DESC);

ALTER TABLE public.docs_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated callers can insert votes for themselves; the user_id on the
-- row must match auth.uid() when present, and company_id must match the
-- caller's company (or both can be null for a future anonymous path).
DROP POLICY IF EXISTS docs_feedback_insert ON public.docs_feedback;
CREATE POLICY docs_feedback_insert
  ON public.docs_feedback
  FOR INSERT
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (company_id IS NULL OR company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
  );

-- No SELECT/UPDATE/DELETE policies: users can't read, edit, or remove their
-- votes via PostgREST. Admin/internal tools use service-role which bypasses
-- RLS.

COMMENT ON TABLE public.docs_feedback IS
  'Helpful/not-helpful votes on /docs/<slug> pages from the in-app help drawer. One row per vote.';
