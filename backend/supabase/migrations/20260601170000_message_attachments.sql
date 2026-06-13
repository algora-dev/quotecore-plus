-- =====================================================================
-- Phase 5/6 — message_attachments (hosted, token-gated attachments)
-- =====================================================================
-- Records which files were attached to a specific send / quote / order.
-- The hosted public pages (/accept/[token], /orders/[token], /file/[token])
-- read these rows to render their Attachments section; the gated download
-- route authorises a download request against them and only then mints a
-- short-expiry signed URL. Files are NEVER true email attachments under the
-- Option-B design — the email body carries a link button instead.
--
-- Scope (exactly one of):
--   * quote_id   -> shown on /accept/[token] for that quote
--   * order_id   -> shown on /orders/[token] for that material order
--   * neither    -> standalone (attachment-only auto-message); reached via
--                   access_token at /file/[token]
--
-- Source file (exactly one of):
--   * library_attachment_id -> a reusable company_attachments file
--   * quote_file_id         -> a file already attached to that quote
--
-- display_name is a snapshot of the file name at send time so the row stays
-- meaningful even if the source library file is later deleted (the download
-- route re-checks the live object and 404s gracefully if it's gone).
--
-- Idempotent.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Scope: at most one of quote_id / order_id. Both null = standalone.
  quote_id              uuid NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  order_id              uuid NULL REFERENCES public.material_orders(id) ON DELETE CASCADE,

  -- Source file: exactly one of library_attachment_id / quote_file_id.
  library_attachment_id uuid NULL REFERENCES public.company_attachments(id) ON DELETE SET NULL,
  quote_file_id         uuid NULL REFERENCES public.quote_files(id) ON DELETE CASCADE,

  -- Standalone access token (only set for standalone sends; unguessable).
  access_token          uuid NULL DEFAULT gen_random_uuid(),

  display_name          text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),

  -- At most one scope set.
  CONSTRAINT ck_message_attachments_one_scope
    CHECK (NOT (quote_id IS NOT NULL AND order_id IS NOT NULL)),

  -- Exactly one source.
  CONSTRAINT ck_message_attachments_one_source
    CHECK ( (library_attachment_id IS NOT NULL)::int
          + (quote_file_id IS NOT NULL)::int = 1 ),

  -- Standalone (no quote + no order) MUST carry an access_token.
  CONSTRAINT ck_message_attachments_standalone_token
    CHECK ( (quote_id IS NOT NULL OR order_id IS NOT NULL)
            OR access_token IS NOT NULL )
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_quote
  ON public.message_attachments (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_attachments_order
  ON public.message_attachments (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_attachments_company
  ON public.message_attachments (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_message_attachments_access_token
  ON public.message_attachments (access_token) WHERE access_token IS NOT NULL;

COMMENT ON TABLE public.message_attachments IS
  'Files attached to an outbound send/quote/order (Option-B hosted, token-gated). Read by public hosted pages + the gated download route; never delivered as true email attachments.';

-- ---------------------------------------------------------------------
-- RLS: company-scoped reads/writes for authenticated app callers. The
-- public pages + download route use createAdminClient() (service-role,
-- bypasses RLS) and scope by token -> quote/order/company IN CODE, exactly
-- like /accept/[token] already does for quotes.
-- ---------------------------------------------------------------------
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_attachments_company_all ON public.message_attachments;
CREATE POLICY message_attachments_company_all
  ON public.message_attachments
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

COMMIT;
