-- =============================================================================
-- Storage buckets + RLS policies
-- =============================================================================
--
-- Brings storage configuration under source control. Until this migration the
-- buckets and `storage.objects` policies were created manually in the Supabase
-- dashboard, which meant a fresh environment couldn't be provisioned from the
-- migrations alone and the casing/privacy of the QUOTE-DOCUMENTS bucket
-- silently drifted between docs and live state.
--
-- Buckets:
--   QUOTE-DOCUMENTS (uppercase) — PRIVATE.
--     Holds roof plans, supporting files, and takeoff canvas snapshots.
--     Path layout: `{company_id}/{quote_id}/{filename}` (the first path segment
--     is always the owning company's id).
--   company-logos — PUBLIC.
--     Logos appear on customer-facing quotes; non-sensitive by design.
--
-- RLS:
--   storage.objects RLS is enabled by default. We add four policies on
--   QUOTE-DOCUMENTS keyed on the first path segment matching the caller's
--   company id (resolved via public.users.company_id where id = auth.uid()).
--   The service role bypasses RLS automatically — no policy is needed for it.
--
--   company-logos stays open: anyone can read, only the owning company can
--   write/delete. We don't redo company-logos policies here — they were
--   already configured manually and changing them is out of scope for this
--   migration. Document only.
-- =============================================================================

-- 1. Buckets ------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('QUOTE-DOCUMENTS', 'QUOTE-DOCUMENTS', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('company-logos', 'company-logos', true, 5242880)
ON CONFLICT (id) DO NOTHING;


-- 2. RLS policies on storage.objects for QUOTE-DOCUMENTS ----------------------
-- Drop any old conflicting policies under our own naming convention so this
-- migration is idempotent on a re-run.
DROP POLICY IF EXISTS "quote_documents_select_own_company" ON storage.objects;
DROP POLICY IF EXISTS "quote_documents_insert_own_company" ON storage.objects;
DROP POLICY IF EXISTS "quote_documents_update_own_company" ON storage.objects;
DROP POLICY IF EXISTS "quote_documents_delete_own_company" ON storage.objects;

-- Helper expression: first path segment cast to uuid must match the caller's
-- company. We keep the cast inline so a malformed path (non-uuid prefix) just
-- fails to match instead of throwing.
--
-- (storage.foldername(name))[1] returns the first folder segment of the
-- object name, which by our path convention is the company id.

-- The auth profile lives in `public.users` (id matches auth.uid()) and
-- carries `company_id`. The first path segment of the storage object name
-- must equal that company id.

CREATE POLICY "quote_documents_select_own_company"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'QUOTE-DOCUMENTS'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "quote_documents_insert_own_company"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'QUOTE-DOCUMENTS'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "quote_documents_update_own_company"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'QUOTE-DOCUMENTS'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.users WHERE id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'QUOTE-DOCUMENTS'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "quote_documents_delete_own_company"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'QUOTE-DOCUMENTS'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.users WHERE id = auth.uid()
  )
);

-- Note on QuoteDetailsForm temp uploads: roof plans are uploaded BEFORE the
-- quote exists (so quote_id is unknown). To keep them under the same
-- first-segment-equals-company-id rule, the path is now
-- `{companyId}/_pending/{filename}` (changed alongside this migration).
-- After quote creation the file is `move()`d to `{companyId}/{quoteId}/...`.
