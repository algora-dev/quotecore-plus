-- Migration: scheduled_messages pending_wait_minutes column
-- Date: 2026-06-09
-- Purpose:
--   Add minute-level granularity to follow-up delays. Today a follow-up
--   delay is whole days + whole hours; this adds a minutes component so
--   users can schedule e.g. 0d 0h 10m after an event.
--
--   Mirrors pending_wait_hours: nullable, only populated on pending-event
--   rows (sentinel fire_at). Live rows compute fire_at at insert time and
--   leave this null.

ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS pending_wait_minutes integer;

COMMENT ON COLUMN public.scheduled_messages.pending_wait_minutes IS
  'For pending-event rows (sentinel fire_at): how many additional minutes after the event the message should fire. Null on live rows.';
