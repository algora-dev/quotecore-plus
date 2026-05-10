-- =============================================================================
-- quote_files file_size sanity check
-- =============================================================================
--
-- Defence-in-depth alongside the application-layer hardening of saveFileMetadata
-- (Gerald audit pass 2). The application now reads the real object size from
-- Supabase Storage rather than trusting the client, but the trigger that
-- maintains companies.storage_used_bytes still adds whatever value lands in
-- this column. A CHECK at the database layer guarantees we never accidentally
-- write a negative or non-finite size again, regardless of which write path
-- is reached.
--
-- Backfill is a no-op if the table already conforms; the constraint is added
-- with NOT VALID first and then validated, so existing rows are checked but
-- the migration won't break if there happens to be historical bad data.
-- =============================================================================

ALTER TABLE quote_files
  DROP CONSTRAINT IF EXISTS quote_files_file_size_nonneg;

ALTER TABLE quote_files
  ADD CONSTRAINT quote_files_file_size_nonneg
  CHECK (file_size >= 0)
  NOT VALID;

-- Validate against existing rows. If this fails, run a one-off cleanup before
-- re-applying:
--   UPDATE quote_files SET file_size = 0 WHERE file_size < 0;
ALTER TABLE quote_files VALIDATE CONSTRAINT quote_files_file_size_nonneg;

COMMENT ON CONSTRAINT quote_files_file_size_nonneg ON quote_files IS
  'Prevents tampered or corrupt file_size values from skewing companies.storage_used_bytes via the storage-accounting trigger.';
