-- Recipient-driven statuses (Message Center Phase 3+4)
-- Additive / nullable only. One DB serves dev+main; safe.
--
-- 1. quotes.viewed_at / material_orders.viewed_at: stamped when the RECIPIENT
--    first opens the public link. Stored separately from alerts.is_read (the
--    OWNER's read flag). invoices already has viewed_at.
-- 2. companies.notify_on_recipient_view: company-level preference controlling
--    whether a *Read* alert is created when a recipient first opens an item.
--    The status itself always updates regardless of this toggle.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS notify_on_recipient_view boolean NOT NULL DEFAULT true;
