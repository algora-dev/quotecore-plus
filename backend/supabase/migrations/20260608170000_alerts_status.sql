-- Message Center v2: alert lifecycle state (folders).
--
-- Adds a `status` column to drive the inbox folders:
--   active   -> default; the main list the message center opens to
--   todo     -> user pushed it to the "do later" cluster
--   archived -> "Done" / soft-deleted; recoverable, hard-delete only from here
--
-- `is_read` is orthogonal (read/unread dot) and stays as-is.
-- Additive + defaulted, so existing alerts become 'active' automatically.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
    CREATE TYPE public.alert_status AS ENUM ('active', 'todo', 'archived');
  END IF;
END $$;

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS status public.alert_status NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_alerts_company_status
  ON public.alerts(company_id, status, created_at DESC);
