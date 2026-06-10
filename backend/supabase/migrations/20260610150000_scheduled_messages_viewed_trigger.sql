-- 2026-06-10
-- Add the "On Read" follow-up trigger family: quote_viewed / order_viewed /
-- invoice_viewed. These are event triggers whose countdown is anchored to the
-- recipient OPENING the item (viewed_at), not to send time. The follow-up is
-- parked on the pending-event sentinel until the item is viewed, then fires
-- after the configured wait, and is cancelled if the recipient takes any
-- action (accept / decline / request info / request changes / dispute) before
-- it fires.
--
-- Additive only: widen the existing CHECK to include the three new values.

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
    'quote_viewed',
    -- Order lifecycle
    'order_sent',
    'order_accepted',
    'order_declined',
    'order_viewed',
    -- Invoice lifecycle
    'invoice_sent',
    'invoice_viewed',
    -- Manual / ad-hoc
    'manual'
  ));
