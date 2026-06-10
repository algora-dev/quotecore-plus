-- 2026-06-10
-- Two additive fixes:
--
-- 1. scheduled_messages.trigger_event CHECK only allowed the original QUOTE
--    lifecycle values. Order + invoice follow-ups (shipped 2026-06-09) emit
--    order_sent / order_accepted / order_declined / invoice_sent, which the
--    old constraint rejected with
--    "new row ... violates check constraint scheduled_messages_trigger_event_check".
--    Widen the constraint to cover all three entity families. The TS type
--    (ScheduledTriggerEvent) already lists these; only the DB was behind.
--
-- 2. alerts.bell_cleared_at: the notification BELL is a preview surface only.
--    "Clear alerts" must clear items from the bell WITHOUT touching anything in
--    the Message Center (previously it set is_read=true, which also wiped the
--    MC unread/orange state). A dedicated, nullable timestamp lets the bell
--    filter + clear independently of is_read / status.
--
-- Both changes are additive and safe (no data loss).

-- 1. Widen the trigger_event CHECK -------------------------------------------
ALTER TABLE public.scheduled_messages
  DROP CONSTRAINT IF EXISTS scheduled_messages_trigger_event_check;

ALTER TABLE public.scheduled_messages
  ADD CONSTRAINT scheduled_messages_trigger_event_check
  CHECK (trigger_event IN (
    -- Quote lifecycle
    'quote_sent',
    'quote_accepted',
    'quote_declined',
    'quote_revision_requested',
    -- Order lifecycle (order_sent = time-based chase anchor)
    'order_sent',
    'order_accepted',
    'order_declined',
    -- Invoice lifecycle (invoice_sent = time-based chase anchor)
    'invoice_sent',
    -- Manual / ad-hoc
    'manual'
  ));

-- 2. Bell-only dismissal flag ------------------------------------------------
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS bell_cleared_at timestamptz;

-- Partial index for the bell's "not yet cleared" query.
CREATE INDEX IF NOT EXISTS alerts_bell_active_idx
  ON public.alerts (company_id, created_at DESC)
  WHERE bell_cleared_at IS NULL;
