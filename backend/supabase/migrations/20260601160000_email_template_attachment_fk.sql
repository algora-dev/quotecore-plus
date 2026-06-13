-- =====================================================================
-- Phase 4 — Template-baked attachment
-- =====================================================================
-- An email_templates row may reference ONE company_attachments file as a
-- default attachment. When a user sends a quote/order with that template,
-- the baked file is pre-selected in the send picker (Phase 5) and links
-- through the hosted, token-gated download surface (Phase 6).
--
-- ON DELETE SET NULL is the FK safety net so deleting an attachment never
-- orphans a template. The app's deleteAttachment() ALSO nulls this column
-- explicitly (so the behaviour is intentional, not just an FK side-effect).
--
-- Idempotent.
-- =====================================================================

BEGIN;

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS attachment_id uuid NULL
    REFERENCES public.company_attachments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.email_templates.attachment_id IS
  'Optional company_attachments file baked into this template as a default attachment. Nulled on attachment delete (FK ON DELETE SET NULL + explicit app-layer null in deleteAttachment).';

-- Lookup support for deleteAttachment''s "null all templates referencing
-- this attachment" sweep, and for resolving a template''s baked file.
CREATE INDEX IF NOT EXISTS idx_email_templates_attachment
  ON public.email_templates (attachment_id)
  WHERE attachment_id IS NOT NULL;

COMMIT;
