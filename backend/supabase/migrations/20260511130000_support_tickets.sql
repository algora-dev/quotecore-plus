-- Support tickets table.
--
-- Phase 1 (this migration): users submit tickets via Account > Support; the
-- ticket lands here AND a notification email is sent to info@quote-core.com.
--
-- Phase 2 (future): a separate admin route group reads/replies to tickets via
-- the same table. The schema is intentionally shaped for that future flow:
--   * `status` carries the lifecycle (`open` -> `pending` -> `resolved`/`closed`)
--   * `messages` jsonb holds the conversation as an append-only list, so the
--     admin reply UI just appends and the user's reply UI also appends \u2014 no
--     join table needed for v1.
--   * `assignee_user_id` reserved for when more than one admin is triaging.
--
-- RLS:
--   * Users see only their OWN tickets (not their whole company's). Phase 2
--     admin policies will widen this for users flagged `is_admin = true`.
--   * Users can insert (create) tickets for themselves only.
--   * Users can UPDATE only the `messages` field on their own tickets (to add
--     follow-up replies), and only when the ticket is not yet `closed`.
--   * Service role bypasses everything (admin tools / cron jobs).

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Lifecycle.
  status            text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  -- Classification (used for admin filtering and email subject prefixes).
  category          text NOT NULL DEFAULT 'question'
                       CHECK (category IN ('bug', 'question', 'billing', 'feature_request', 'other')),
  priority          text NOT NULL DEFAULT 'normal'
                       CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  -- Subject + opening body.
  subject           text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 200),
  body              text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 8000),
  -- Conversation: append-only list of { author: 'user' | 'admin', author_id,
  -- created_at, body }. The opening message is NOT duplicated here \u2014 use
  -- `body` for that and `messages` only for follow-ups so the read path stays
  -- simple.
  messages          jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Context auto-captured by the client at submit-time. Helps debugging.
  page_context      text,
  user_agent        text,
  app_version       text,
  -- Future admin triage fields.
  assignee_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Audit timestamps.
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  -- Email forwarding outcome (Phase 1). Null = not yet attempted.
  email_forwarded_at      timestamptz,
  email_forward_error     text
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx
  ON public.support_tickets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_company_idx
  ON public.support_tickets (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON public.support_tickets (status, created_at DESC)
  WHERE status IN ('open', 'pending');

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Read own tickets only.
DROP POLICY IF EXISTS support_tickets_select_own ON public.support_tickets;
CREATE POLICY support_tickets_select_own
  ON public.support_tickets
  FOR SELECT
  USING (user_id = auth.uid());

-- Insert own ticket only.
DROP POLICY IF EXISTS support_tickets_insert_own ON public.support_tickets;
CREATE POLICY support_tickets_insert_own
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- Update own tickets, only when not yet closed, only on safe fields. The
-- policy is intentionally permissive on the fields you CAN update; the server
-- action enforces field-level rules (append-only messages, no status flip
-- from the user side, etc).
DROP POLICY IF EXISTS support_tickets_update_own ON public.support_tickets;
CREATE POLICY support_tickets_update_own
  ON public.support_tickets
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND status <> 'closed'
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- No DELETE policy: tickets are immutable history. If a user demands deletion
-- under GDPR we soft-delete via service role.

-- updated_at trigger.
CREATE OR REPLACE FUNCTION public.support_tickets_touch_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_set_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_set_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.support_tickets_touch_updated_at();

COMMENT ON TABLE public.support_tickets IS
  'Customer-submitted support requests. Phase 1: users create + view own. Phase 2: admin backend reads/replies.';
