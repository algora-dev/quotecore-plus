-- Smoke pass #2 finding #10 closure (2026-05-19).
--
-- File upload UI was throwing "permission denied for table companies"
-- (PG 42501) on every saveFileMetadata insert into quote_files. Root cause:
-- the existing trg_update_company_storage trigger function
-- `update_company_storage_usage()` is plpgsql with the default SECURITY
-- INVOKER, so it runs as the caller. The C-01 lockdown
-- (2026-05-19 migration 20260519100000) revoked table-level UPDATE on
-- `companies` from authenticated and only column-whitelisted profile
-- fields \u2014 deliberately excluding `storage_used_bytes` (billing field).
-- The trigger's UPDATE of `companies.storage_used_bytes` consequently
-- fails for every user-context quote_files insert.
--
-- Vercel logs from a real failure (2026-05-19 16:11:54 UTC):
--   [saveFileMetadata] upsert failed: { code: '42501', details: null,
--     hint: null, message: 'permission denied for table companies' }
--
-- Fix: switch the trigger function to SECURITY DEFINER. Owned by postgres
-- (the migrating role), it runs with owner privileges, bypassing the
-- table ACL. Same pattern used for the H-04 library-cap triggers
-- (component_library / flashing_library).
--
-- This is NOT a relaxation of C-01: the trigger still only updates the
-- ONE column it needs (storage_used_bytes), still scoped to NEW/OLD
-- company_id, and authenticated users have no path to call the trigger
-- function directly. The point of C-01 was to prevent direct user
-- UPDATEs of billing columns via PostgREST \u2014 that's still blocked.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_company_storage_usage()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.companies
    SET storage_used_bytes = storage_used_bytes + NEW.file_size
    WHERE id = NEW.company_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.companies
    SET storage_used_bytes = storage_used_bytes - OLD.file_size
    WHERE id = OLD.company_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.file_size != OLD.file_size THEN
      UPDATE public.companies
      SET storage_used_bytes = storage_used_bytes - OLD.file_size + NEW.file_size
      WHERE id = NEW.company_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

-- The trigger function is not user-callable. Lock down PUBLIC just in
-- case (matches the pattern in 20260519100100_secdef_function_lockdown.sql).
REVOKE ALL ON FUNCTION public.update_company_storage_usage() FROM PUBLIC, anon, authenticated;

COMMIT;
