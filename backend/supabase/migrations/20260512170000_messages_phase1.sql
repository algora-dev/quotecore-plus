-- Messages — Phase 1 backing schema.
--
-- Adds the manual-send pipeline (quotes / orders / freeform messages),
-- structured replies from recipients, and a per-company suppression list.
-- Event-based automations land in Phase 2 (see scheduled_sends table; not
-- created here).
--
-- Naming choice: "messages" rather than "emails" because Phase 2 will add
-- in-app actions on the same pipeline (queueing follow-ups, reminders, etc.).
--
-- Surfaces touched:
--   * email_templates: gains `kind` and `category` so the Message Templates UI
--     can group/filter by use case (quote send / order send / follow-up /
--     decline response / freeform custom).
--   * outbound_messages: one row per email-send. Carries the rendered subject
--     and body (post merge-variable substitution) so the user always knows
--     exactly what the recipient received, even if the template later changes.
--   * outbound_message_replies: structured replies from the public /m/[token]
--     reply page. Deny-all RLS — service role only — same posture as
--     account_recovery_log.
--   * message_suppressions: per-company opt-out list. If a recipient hits
--     "stop emailing me", we insert here and the send pipeline blocks future
--     outbound_messages to that address from that company.

-- =====================================================================
-- 1. Extend email_templates (renamed to Message Templates in the UI).
-- =====================================================================
--
-- `kind` discriminates the template's intended use case and drives the
-- merge-variable picker shown in the editor (a quote-send template has
-- {{quote_number}} available; an order-send template has {{order_number}};
-- etc.). The full free-form "custom" kind keeps the existing untyped
-- behaviour for backwards compat with the small number of templates the
-- early users may already have saved.
--
-- `category` is a soft label for grouping in the list view; the user can
-- add their own (e.g. "Welcome", "Reminders"). NULLABLE so old templates
-- don't break.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'custom'
    CHECK (kind IN ('quote_send', 'order_send', 'followup', 'decline_response', 'custom')),
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS email_templates_company_kind_idx
  ON public.email_templates (company_id, kind);

COMMENT ON COLUMN public.email_templates.kind IS
  'Template purpose. Drives merge-variable picker + filter UI in /templates/messages.';
COMMENT ON COLUMN public.email_templates.category IS
  'Optional user-defined grouping label (e.g. "Reminders").';


-- =====================================================================
-- 2. outbound_messages — the send record.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.outbound_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,

  -- What kind of message this is. Mirrors email_templates.kind so the send
  -- pipeline can validate template/relation alignment.
  kind                text NOT NULL
                        CHECK (kind IN ('quote_send', 'order_send', 'followup', 'decline_response', 'custom')),

  -- Optional links. EXACTLY ONE of the foreign keys is expected for
  -- quote_send / order_send / followup / decline_response; custom kind
  -- may have neither.
  related_quote_id    uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  related_order_id    uuid REFERENCES public.material_orders(id) ON DELETE SET NULL,

  -- Template the message was based on (may have been edited inline before
  -- send, but we record the source for audit).
  template_id         uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,

  -- The rendered email AS THE RECIPIENT RECEIVED IT. Subject + body post
  -- merge-variable substitution. Kept verbatim so a later template edit
  -- doesn't rewrite history.
  subject             text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 500),
  body                text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 100000),

  recipient_email     text NOT NULL CHECK (recipient_email ~ '^.+@.+\..+$'),
  recipient_name      text,

  -- HMAC-signed token gating the public reply page /m/[token]. Same
  -- approach as the existing /accept/[token] token (no DB scan needed to
  -- validate, but we store the id portion here for lookup).
  reply_token         text NOT NULL UNIQUE,

  -- Delivery lifecycle.
  status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'sent', 'bounced', 'failed', 'suppressed')),
  send_error          text,

  sent_at             timestamptz,
  opened_at           timestamptz,
  replied_at          timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbound_messages_company_idx
  ON public.outbound_messages (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS outbound_messages_quote_idx
  ON public.outbound_messages (related_quote_id, created_at DESC)
  WHERE related_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS outbound_messages_order_idx
  ON public.outbound_messages (related_order_id, created_at DESC)
  WHERE related_order_id IS NOT NULL;

ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;

-- Read own company's messages.
DROP POLICY IF EXISTS outbound_messages_select_own_company ON public.outbound_messages;
CREATE POLICY outbound_messages_select_own_company
  ON public.outbound_messages
  FOR SELECT
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- All writes go through server actions running on the service-role client;
-- explicitly no INSERT/UPDATE/DELETE policies for anon/authenticated.

COMMENT ON TABLE public.outbound_messages IS
  'One row per outbound send via the Messages pipeline. Subject + body are the rendered final values, not the template source.';


-- =====================================================================
-- 3. outbound_message_replies — what the recipient sent back.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.outbound_message_replies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          uuid NOT NULL REFERENCES public.outbound_messages(id) ON DELETE CASCADE,
  -- Denormalised company_id so admin/cron jobs can scope without joining.
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- One of a fixed set of canonical actions, plus the optional free text.
  action              text NOT NULL
                        CHECK (action IN ('accept', 'decline', 'request_changes', 'question', 'other')),
  body                text CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 8000),

  -- Audit metadata captured at reply-time.
  ip                  text,
  user_agent          text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbound_message_replies_message_idx
  ON public.outbound_message_replies (message_id, created_at DESC);

CREATE INDEX IF NOT EXISTS outbound_message_replies_company_idx
  ON public.outbound_message_replies (company_id, created_at DESC);

ALTER TABLE public.outbound_message_replies ENABLE ROW LEVEL SECURITY;

-- Deny-all to non-service-role. The reply submission flow is public but
-- runs through a server action using the admin client; users read replies
-- via outbound_messages joins which carry their own RLS check.
--
-- (Same pattern as account_recovery_log: writes from the public flow are
-- intentionally not user-attributable, so RLS-by-user doesn't apply.)
DROP POLICY IF EXISTS outbound_message_replies_no_user_access ON public.outbound_message_replies;
CREATE POLICY outbound_message_replies_no_user_access
  ON public.outbound_message_replies
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.outbound_message_replies IS
  'Structured replies from the public /m/[token] page. RLS deny-all; service role only. Users read via outbound_messages joins.';


-- =====================================================================
-- 4. message_suppressions — per-company "do not email me" list.
-- =====================================================================
--
-- If a recipient hits the "stop emailing me" link on a reply page (or
-- replies with an opt-out, etc.), insert a row here. The send pipeline
-- looks up by (company_id, lowered email) and refuses to dispatch if
-- present, marking the outbound_messages row as `status='suppressed'`.

CREATE TABLE IF NOT EXISTS public.message_suppressions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email               text NOT NULL CHECK (email = lower(email)),
  reason              text CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500),
  -- The message that triggered the suppression (when applicable). Null
  -- if a user added the address manually.
  source_message_id   uuid REFERENCES public.outbound_messages(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS message_suppressions_company_idx
  ON public.message_suppressions (company_id);

ALTER TABLE public.message_suppressions ENABLE ROW LEVEL SECURITY;

-- Read own company's suppression list (for the future "Suppression list"
-- admin UI; safe to enable now). No write policies — additions happen via
-- service role only.
DROP POLICY IF EXISTS message_suppressions_select_own_company ON public.message_suppressions;
CREATE POLICY message_suppressions_select_own_company
  ON public.message_suppressions
  FOR SELECT
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

COMMENT ON TABLE public.message_suppressions IS
  'Per-company email opt-out list. Send pipeline blocks dispatch when (company_id, lower(email)) exists here.';


-- =====================================================================
-- 5. Extend alerts.alert_type taxonomy.
-- =====================================================================
--
-- The alerts table uses a plain text `alert_type` (no enum / CHECK), so
-- no DDL needed — but we document the new values here so the next dev
-- knows they exist:
--
--   * 'message_reply'           — a recipient replied via /m/[token].
--   * 'message_send_failed'     — outbound send failed (bounce, suppression, etc.).
--
-- AlertBell ignores unknown alert_types gracefully (renders a generic
-- envelope icon); the in-app filter UI groups by alert_type when present.
