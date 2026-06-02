-- =====================================================================
-- Fix: hard-deleting a library attachment that is referenced by an existing
-- message_attachments row failed with ck_message_attachments_one_source.
-- =====================================================================
-- The original FK was:
--   library_attachment_id uuid REFERENCES company_attachments(id) ON DELETE SET NULL
-- but ck_message_attachments_one_source requires EXACTLY ONE source
-- (library_attachment_id XOR quote_file_id). On delete, SET NULL zeroed the
-- only source on library-sourced rows -> 0 sources -> constraint violation ->
-- the whole delete aborted.
--
-- Decision (Shaun, option A, 2026-06-02): a hard delete of a library file
-- should cascade-remove the historical message_attachments rows that point at
-- it. The hosted public pages + gated download route already 404 gracefully
-- when a source file is gone, so the only visible effect is that previously
-- sent links to THAT file stop resolving — which is the intent of a delete.
--
-- quote_file_id already CASCADEs; this brings library_attachment_id in line.
-- Idempotent.
-- =====================================================================

BEGIN;

ALTER TABLE public.message_attachments
  DROP CONSTRAINT IF EXISTS message_attachments_library_attachment_id_fkey;

ALTER TABLE public.message_attachments
  ADD CONSTRAINT message_attachments_library_attachment_id_fkey
  FOREIGN KEY (library_attachment_id)
  REFERENCES public.company_attachments(id)
  ON DELETE CASCADE;

COMMIT;
