-- 2026-06-10
-- Prep for the Invoice Activity tab (#4): outbound_messages already links to
-- quotes (related_quote_id) and orders (related_order_id) but had no invoice
-- link, so the invoice Activity "Sent" tab can't show outbound invoice emails.
-- Add the nullable FK + index. Additive only.

ALTER TABLE public.outbound_messages
  ADD COLUMN IF NOT EXISTS related_invoice_id uuid
  REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS outbound_messages_related_invoice_idx
  ON public.outbound_messages (related_invoice_id)
  WHERE related_invoice_id IS NOT NULL;
