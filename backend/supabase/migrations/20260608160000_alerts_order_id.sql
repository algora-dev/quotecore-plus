-- Message Center v1: link alerts to material orders.
--
-- The alerts table already has quote_id + invoice_id, but order responses
-- ('order_supplier_response' alerts) had no way to point back at the order.
-- This adds order_id so the new inbox/message-center page can "open" an
-- order alert and route the user to the source order. Additive + nullable,
-- so it's back-compatible (existing alerts keep order_id = NULL).

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS order_id uuid NULL
    REFERENCES public.material_orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_alerts_order_id
  ON public.alerts(order_id)
  WHERE order_id IS NOT NULL;
