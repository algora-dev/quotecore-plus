-- Gerald audit H-05: lock down direct authenticated INSERT to QUOTE-DOCUMENTS.
-- Combined with the new mintQuoteDocumentUploadUrl server action, this
-- enforces that EVERY upload to the private bucket flows through a
-- service-role-minted signed-upload-URL after the server has verified:
--   - the user is authenticated and has company context
--   - the file is under MAX_SINGLE_FILE_BYTES
--   - the mime type is in the allowlist
--   - assertCanUseStorage(companyId, claimedSize) passes (active sub +
--     remaining quota)
--
-- Cleanup also: there are several legacy/duplicate storage policies on
-- QUOTE-DOCUMENTS from earlier setups (auto-generated names like
-- "Give users authenticated access to folder 1dmzjqf_*", "quote_docs_*",
-- and "Authenticated users can upload plans *"). Drop them so the only
-- remaining policies are the canonical `quote_documents_*_own_company`
-- ones, MINUS the INSERT policy (which is what this audit closes out).
--
-- After this migration:
--   - INSERT to QUOTE-DOCUMENTS via authenticated client = denied. The
--     signed-upload-URL flow is the ONLY user-facing write path.
--   - SELECT remains scoped to the user's own company folder.
--   - UPDATE (used by storage.move() in the pending->quote transition)
--     remains scoped to the user's own company folder.
--   - DELETE remains scoped to the user's own company folder.
--   - service_role bypasses RLS entirely (webhook, crons, signed-upload-URL
--     mint, finaliser, orphan sweep).
--
-- company-logos policies are NOT touched (phase 2 scope per launch brief).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Drop ALL legacy + duplicate QUOTE-DOCUMENTS policies on storage.objects.
-- ---------------------------------------------------------------------------
-- These are the policies revealed by `SELECT * FROM pg_policies WHERE
-- schemaname='storage'` on 2026-05-19 that match QUOTE-DOCUMENTS:
DROP POLICY IF EXISTS "Allow authenticated UPDATE 1dmzjqf_0"             ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload plans 1dmzjqf_0"   ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1dmzjqf_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1dmzjqf_1" ON storage.objects;
DROP POLICY IF EXISTS "quote_docs_delete"                                ON storage.objects;
DROP POLICY IF EXISTS "quote_docs_insert"                                ON storage.objects;
DROP POLICY IF EXISTS "quote_docs_select"                                ON storage.objects;
DROP POLICY IF EXISTS "quote_docs_update"                                ON storage.objects;

-- ---------------------------------------------------------------------------
-- 2. Drop the canonical INSERT policy. Signed-upload-URL flow only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS quote_documents_insert_own_company ON storage.objects;

-- ---------------------------------------------------------------------------
-- 3. Verify (and recreate if missing) the three remaining policies.
-- ---------------------------------------------------------------------------
-- SELECT: read your own company's objects (used to render images / signed
-- URL renders in the app).
DROP POLICY IF EXISTS quote_documents_select_own_company ON storage.objects;
CREATE POLICY quote_documents_select_own_company
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'QUOTE-DOCUMENTS'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.users WHERE id = auth.uid()
    )
  );

-- UPDATE: needed for `storage.move()` of the pending->quote transition,
-- still scoped to the caller's company folder.
DROP POLICY IF EXISTS quote_documents_update_own_company ON storage.objects;
CREATE POLICY quote_documents_update_own_company
  ON storage.objects
  FOR UPDATE
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

-- DELETE: the FilesManager + flashings detach flow needs this to remove
-- the user's own files. Cap to the caller's folder.
DROP POLICY IF EXISTS quote_documents_delete_own_company ON storage.objects;
CREATE POLICY quote_documents_delete_own_company
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'QUOTE-DOCUMENTS'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.users WHERE id = auth.uid()
    )
  );

COMMIT;
