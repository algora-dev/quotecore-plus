-- Patch 016: File Storage Infrastructure
-- Date: 2026-04-03
-- Purpose: Add file storage tracking and quota management for company logos, 
--          roof plans, and supporting documents

-- =============================================================================
-- STEP 1: Add storage tracking to companies table
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'storage_used_bytes'
  ) THEN
    ALTER TABLE companies ADD COLUMN storage_used_bytes bigint DEFAULT 0 NOT NULL;
    RAISE NOTICE 'Added storage_used_bytes to companies';
  ELSE
    RAISE NOTICE 'Column storage_used_bytes already exists in companies';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'storage_limit_bytes'
  ) THEN
    -- Default limit: 1 GB (1073741824 bytes)
    ALTER TABLE companies ADD COLUMN storage_limit_bytes bigint DEFAULT 1073741824 NOT NULL;
    RAISE NOTICE 'Added storage_limit_bytes to companies';
  ELSE
    RAISE NOTICE 'Column storage_limit_bytes already exists in companies';
  END IF;
END $$;

COMMENT ON COLUMN companies.storage_used_bytes IS 
'Current storage usage in bytes (logos + plans + supporting files). Updated via trigger on quote_files.';

COMMENT ON COLUMN companies.storage_limit_bytes IS 
'Storage quota in bytes. Default 1GB (1073741824). Can be increased for paid tiers.';

-- =============================================================================
-- STEP 2: Create quote_files table
-- =============================================================================

CREATE TABLE IF NOT EXISTS quote_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  
  file_type text NOT NULL CHECK (file_type IN ('logo', 'plan', 'supporting')),
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  
  description text,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_logo_without_quote CHECK (
    (file_type = 'logo' AND quote_id IS NULL) OR 
    (file_type != 'logo' AND quote_id IS NOT NULL)
  )
);

COMMENT ON TABLE quote_files IS 
'Tracks all uploaded files: company logos (quote_id=NULL), roof plans, and supporting documents.';

COMMENT ON COLUMN quote_files.file_type IS 
'logo: Company branding logo (no quote_id). plan: Roof plan for digital takeoff. supporting: Additional job images.';

COMMENT ON COLUMN quote_files.storage_path IS 
'Full path in Supabase Storage bucket. Format: company-logos/{company_id}/logo.jpg or quote-documents/{company_id}/{quote_id}/filename.ext';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quote_files_company ON quote_files(company_id);
CREATE INDEX IF NOT EXISTS idx_quote_files_quote ON quote_files(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_files_type ON quote_files(file_type);

-- =============================================================================
-- STEP 3: Row Level Security Policies
-- =============================================================================

ALTER TABLE quote_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT files from their own company
CREATE POLICY quote_files_select_own_company ON quote_files
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can INSERT files to their own company
CREATE POLICY quote_files_insert_own_company ON quote_files
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can DELETE files from their own company
CREATE POLICY quote_files_delete_own_company ON quote_files
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =============================================================================
-- STEP 4: Trigger to update company storage usage
-- =============================================================================

CREATE OR REPLACE FUNCTION update_company_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Add file size to company total
    UPDATE companies 
    SET storage_used_bytes = storage_used_bytes + NEW.file_size
    WHERE id = NEW.company_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Subtract file size from company total
    UPDATE companies 
    SET storage_used_bytes = storage_used_bytes - OLD.file_size
    WHERE id = OLD.company_id;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle file replacement (size change)
    IF NEW.file_size != OLD.file_size THEN
      UPDATE companies 
      SET storage_used_bytes = storage_used_bytes - OLD.file_size + NEW.file_size
      WHERE id = NEW.company_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_company_storage ON quote_files;

CREATE TRIGGER trg_update_company_storage
  AFTER INSERT OR UPDATE OR DELETE ON quote_files
  FOR EACH ROW
  EXECUTE FUNCTION update_company_storage_usage();

-- =============================================================================
-- STEP 5: Helper function to check storage quota
-- =============================================================================

CREATE OR REPLACE FUNCTION check_storage_quota(
  p_company_id uuid,
  p_file_size bigint
)
RETURNS boolean AS $$
DECLARE
  v_used bigint;
  v_limit bigint;
BEGIN
  SELECT storage_used_bytes, storage_limit_bytes
  INTO v_used, v_limit
  FROM companies
  WHERE id = p_company_id;
  
  -- Check if adding this file would exceed quota
  RETURN (v_used + p_file_size) <= v_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_storage_quota IS 
'Returns true if company has enough quota to upload a file of given size. Call before upload.';

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Check companies storage columns
-- SELECT id, name, storage_used_bytes, storage_limit_bytes, 
--        pg_size_pretty(storage_used_bytes::bigint) as used,
--        pg_size_pretty(storage_limit_bytes::bigint) as limit
-- FROM companies LIMIT 5;

-- Check quote_files table structure
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'quote_files' 
-- ORDER BY ordinal_position;

-- Test quota check
-- SELECT check_storage_quota(
--   (SELECT id FROM companies LIMIT 1),
--   5242880  -- 5 MB test file
-- );

-- =============================================================================
-- Rollback (if needed)
-- =============================================================================

-- DROP TRIGGER IF EXISTS trg_update_company_storage ON quote_files;
-- DROP FUNCTION IF EXISTS update_company_storage_usage();
-- DROP FUNCTION IF EXISTS check_storage_quota(uuid, bigint);
-- DROP TABLE IF EXISTS quote_files CASCADE;
-- ALTER TABLE companies DROP COLUMN IF EXISTS storage_used_bytes;
-- ALTER TABLE companies DROP COLUMN IF EXISTS storage_limit_bytes;

-- Patch 016 complete

-- =============================================================================
-- MANUAL STEP: Create Supabase Storage Buckets
-- =============================================================================

-- You must create these buckets manually in Supabase Dashboard:
-- https://app.supabase.com/project/YOUR_PROJECT/storage/buckets

-- Bucket 1: company-logos
--   - Public: YES (logos visible in customer quotes)
--   - Allowed MIME types: image/jpeg, image/png, image/webp
--   - Max file size: 2 MB
--   - RLS Policy: Authenticated users can upload/delete own company logo

-- Bucket 2: quote-documents
--   - Public: NO (private files)
--   - Allowed MIME types: image/*, application/pdf
--   - Max file size: 10 MB (plans can be large)
--   - RLS Policy: Users can only access files from their company_id folder
