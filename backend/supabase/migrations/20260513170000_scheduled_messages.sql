-- Messages Phase 2: scheduled outbound messages.
--
-- Per-quote scheduled follow-ups. The user opens a quote summary, picks
-- an email template + trigger + delay, and we persist a row here. A
-- Vercel Cron route polls every 30 minutes for rows where
-- status='scheduled' AND fire_at <= now(), re-checks the cancel
-- conditions, and dispatches through the same sendOutboundMessage
-- pipeline that Phase 1 uses for manual sends.
--
-- Design notes:
--   * One table, no companion 'rule' table yet. A row is both the rule
--     (when/what/who) and the run (status/fired_at/outbound_message_id).
--     Company-wide defaults in Phase 2.1 will get a `is_template = true`
--     row whose dispatcher clones it on trigger \u2014 same table.
--   * Cancel conditions are re-evaluated AT FIRE TIME by the dispatcher,
--     not by a database trigger. Triggers on `quotes` were considered
--     and rejected: it's clearer to keep the policy in one place
--     (TypeScript) where it's testable and observable, and the
--     dispatcher already has to load the quote to compute merge
--     variables anyway.
--   * Hard cap of 3 scheduled rows per quote is enforced in TS
--     (server action) rather than via a partial-unique index, because
--     the cap counts only `status='scheduled'` and Postgres can't
--     express that as a unique constraint without a horror trigger.

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id              uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  template_id           uuid REFERENCES public.email_templates(id) ON DELETE RESTRICT,

  -- What & when -------------------------------------------------------
  -- `trigger_event` is the moment in the quote lifecycle that anchors
  -- the wait. Phase 2 supports: quote_sent (used by the "no response
  -- after N days" UX), quote_declined ("send a 'sorry to hear that'
  -- after 7 days"). Phase 2.1 adds quote_accepted + revision_requested
  -- but the column accepts them today so the dispatcher can grow into
  -- them without a migration.
  trigger_event         text NOT NULL
                        CHECK (trigger_event IN (
                          'quote_sent',
                          'quote_accepted',
                          'quote_declined',
                          'quote_revision_requested',
                          'manual'
                        )),
  trigger_anchor_at     timestamptz NOT NULL,
  fire_at               timestamptz NOT NULL,

  -- Cancel conditions -------------------------------------------------
  -- When true, the dispatcher cancels the send if the quote has moved
  -- to accepted / declined / revision-requested between scheduling and
  -- fire time. This is the safety net that makes "did you forget?"
  -- emails not fire after the customer already replied.
  require_no_response   boolean NOT NULL DEFAULT true,

  -- Quiet hours / business-hours window. Applied in the sender's
  -- timezone (companies.timezone or fall back to UTC). The dispatcher
  -- shifts a fire_at falling inside the quiet window forward to the
  -- next allowed slot rather than skipping the send.
  respect_quiet_hours   boolean NOT NULL DEFAULT true,

  -- Where -------------------------------------------------------------
  recipient_email       text NOT NULL,
  recipient_name        text,

  -- State machine -----------------------------------------------------
  status                text NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN (
                          'scheduled',
                          'sent',
                          'cancelled',
                          'suppressed',
                          'failed'
                        )),
  fired_at              timestamptz,
  cancelled_reason      text,
  failed_error          text,
  outbound_message_id   uuid REFERENCES public.outbound_messages(id) ON DELETE SET NULL,

  -- Audit -------------------------------------------------------------
  created_by_user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Dispatcher hot path: pull due rows. Partial index keeps the planner
-- targeted on the small "pending" subset rather than the full table.
CREATE INDEX IF NOT EXISTS scheduled_messages_due_idx
  ON public.scheduled_messages (fire_at)
  WHERE status = 'scheduled';

-- Quote summary panel sweep: load every scheduled-or-recent row for one
-- quote. Sort by created_at DESC at query time.
CREATE INDEX IF NOT EXISTS scheduled_messages_quote_idx
  ON public.scheduled_messages (quote_id, created_at DESC);

-- Company-wide listing (admin diagnostics, future Phase 2.1 dashboards).
CREATE INDEX IF NOT EXISTS scheduled_messages_company_idx
  ON public.scheduled_messages (company_id, created_at DESC);

-- updated_at maintenance.
CREATE OR REPLACE FUNCTION public.touch_scheduled_messages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scheduled_messages_touch ON public.scheduled_messages;
CREATE TRIGGER scheduled_messages_touch
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_scheduled_messages_updated_at();

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Company-scoped SELECT, INSERT, UPDATE, DELETE. Mirrors the
-- outbound_messages policy shape so the rules are uniform across the
-- Messages domain. Service role bypasses RLS so the cron dispatcher
-- can read every company's due rows in one sweep.
DROP POLICY IF EXISTS scheduled_messages_select_own_company ON public.scheduled_messages;
CREATE POLICY scheduled_messages_select_own_company
  ON public.scheduled_messages
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS scheduled_messages_insert_own_company ON public.scheduled_messages;
CREATE POLICY scheduled_messages_insert_own_company
  ON public.scheduled_messages
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS scheduled_messages_update_own_company ON public.scheduled_messages;
CREATE POLICY scheduled_messages_update_own_company
  ON public.scheduled_messages
  FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS scheduled_messages_delete_own_company ON public.scheduled_messages;
CREATE POLICY scheduled_messages_delete_own_company
  ON public.scheduled_messages
  FOR DELETE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

COMMENT ON TABLE public.scheduled_messages IS
  'Messages Phase 2: scheduled outbound emails (auto follow-ups). Dispatched by /api/cron/dispatch-scheduled-messages every 30 min. Cancel conditions re-evaluated at fire time.';
