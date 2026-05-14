-- Migration: scheduled_messages pending-event columns
-- Date: 2026-05-14
-- Purpose:
--   Support pre-event scheduling of follow-ups for quote_accepted /
--   quote_declined trigger events. When a user schedules a follow-up
--   BEFORE the customer accepts or declines, we park the row with
--   sentinel timestamps (year 9999) and store the intended wait here.
--   The accept/decline handlers later compute the real fire_at by
--   adding wait_days/wait_hours to the event timestamp.
--
--   Both columns are nullable: only pending-event rows populate them.
--   Live rows (manual / quote_sent / event-already-fired) compute
--   fire_at at insert time and leave these null.

ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS pending_wait_days integer,
  ADD COLUMN IF NOT EXISTS pending_wait_hours integer;

COMMENT ON COLUMN public.scheduled_messages.pending_wait_days IS
  'For pending-event rows (sentinel fire_at): how many days after the event the message should fire. Null on live rows.';

COMMENT ON COLUMN public.scheduled_messages.pending_wait_hours IS
  'For pending-event rows (sentinel fire_at): how many additional hours after the event the message should fire. Null on live rows.';

-- Index to speed up the accept/decline activator query
--   WHERE quote_id = $1 AND trigger_event = $2 AND status = 'scheduled' AND fire_at = '9999-01-01'
-- The existing (quote_id, status) index already helps; this partial
-- index pinpoints pending-event rows specifically.
CREATE INDEX IF NOT EXISTS scheduled_messages_pending_event_idx
  ON public.scheduled_messages (quote_id, trigger_event)
  WHERE status = 'scheduled' AND fire_at = '9999-01-01T00:00:00+00:00';
