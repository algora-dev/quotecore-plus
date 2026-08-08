-- Migration: 20260808160000_fix_catalogue_status.sql
-- Fix: catalogue_status column defaults to 'draft' but existing published catalogs
-- were never updated to 'published'. This caused the unversioned catalogue RPC
-- (public_supplier_catalogue) to return null, resulting in 404s for CSV/JSON routes.
-- The versioned RPC (public_supplier_catalogue_by_version) works because it doesn't
-- check catalogue_status.

-- 1. Update existing published catalogs to have catalogue_status = 'published'
UPDATE catalogs
SET catalogue_status = 'published'
WHERE visibility = 'published'
  AND publication_status = 'published'
  AND catalogue_status = 'draft';

-- 2. Update the unversioned RPC to align conditions with the versioned RPC.
-- The versioned RPC checks: visibility = 'published' AND publication_status = 'published'
-- The unversioned RPC additionally required: catalogue_status = 'published'
-- We keep the catalogue_status check (it's correct intent) but now the data is fixed.
-- No function change needed — the data fix above resolves the issue.
