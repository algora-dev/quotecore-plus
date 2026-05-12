-- Order supplier response flow (Messages Phase 1.5).
--
-- Mirrors the quote acceptance-token flow but for material orders. Adds
-- a supplier-facing public URL that lets the supplier confirm /
-- request-changes / ask a question and writes back into an in-app alert.
-- Free-text only for v1 (no line-by-line change requests); structured
-- changes can be added later if users ask.

-- =====================================================================
-- 1. material_orders: token + response timestamps.
-- =====================================================================
--
-- acceptance_token mirrors quotes.acceptance_token in naming so existing
-- mental model carries over for the dev team. (For suppliers it's the
-- "Order link", but the underlying column reuses the established term.)
--
-- The token is opaque to PostgREST callers (RLS scopes select) and acts
-- as the access key for the public /orders/[token] page; we ALSO HMAC-
-- sign a separate URL token (same pattern as messages) so the row's
-- token alone can't be guessed in a URL-scan. The DB column is the
-- short server-side identifier; the HMAC wrapper carries it through the
-- URL.

ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS acceptance_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS acceptance_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS changes_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_supplier_response_at timestamptz;

CREATE INDEX IF NOT EXISTS material_orders_acceptance_token_idx
  ON public.material_orders (acceptance_token)
  WHERE acceptance_token IS NOT NULL;

COMMENT ON COLUMN public.material_orders.acceptance_token IS
  'Per-order supplier link token (opaque, 32 bytes base64url). Used together with an HMAC URL wrapper.';
COMMENT ON COLUMN public.material_orders.acceptance_token_expires_at IS
  'When the supplier link stops working. NULL = never; defaults to 90 days from issue.';


-- =====================================================================
-- 2. material_order_responses: supplier-submitted responses.
-- =====================================================================
--
-- Mirrors outbound_message_replies; intentionally a separate table so
-- the order flow has its own audit trail and the alert/UI code can
-- specialise. RLS allows authenticated company-scoped reads (for the
-- order preview's Supplier Response panel); writes go through service-
-- role from the public action handler.

CREATE TABLE IF NOT EXISTS public.material_order_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.material_orders(id) ON DELETE CASCADE,
  -- Denormalised so admin/cron jobs can scope without joining.
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  action      text NOT NULL
                CHECK (action IN ('confirm', 'request_changes', 'question', 'other')),
  body        text CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 8000),

  ip          text,
  user_agent  text,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS material_order_responses_order_idx
  ON public.material_order_responses (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS material_order_responses_company_idx
  ON public.material_order_responses (company_id, created_at DESC);

ALTER TABLE public.material_order_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS material_order_responses_select_own_company ON public.material_order_responses;
CREATE POLICY material_order_responses_select_own_company
  ON public.material_order_responses
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

COMMENT ON TABLE public.material_order_responses IS
  'Supplier responses to material orders (confirm/request_changes/question). SELECT scoped to caller company; writes service-role only.';


-- =====================================================================
-- 3. Alert taxonomy extension.
-- =====================================================================
-- The alerts table uses a free-text alert_type. New value introduced:
--   * 'order_supplier_response' \u2014 supplier responded via /orders/[token].
-- AlertBell renders unknown types with a generic icon; no code change required.
