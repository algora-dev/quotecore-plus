-- Job Spaces list thumbnails (owner 2026-11-19): show a small preview of
-- the FIRST plan image uploaded to each job in the job list. Thumbnails are
-- generated server-side at upload time (sharp, 240px JPEG) and stored in the
-- same private QUOTE-DOCUMENTS bucket under a thumbs/ prefix. Additive +
-- nullable only; non-image plans keep NULL and the list shows a placeholder.

ALTER TABLE public.quote_files ADD COLUMN IF NOT EXISTS thumb_path text;

COMMENT ON COLUMN public.quote_files.thumb_path IS
  'Server-generated small JPEG preview (thumbs/ prefix in QUOTE-DOCUMENTS) for image plans; NULL for non-image plans.';

-- The job list picks the earliest plan per quote; index that scan.
-- quote_files timestamp column is uploaded_at (no created_at on this table).
CREATE INDEX IF NOT EXISTS quote_files_company_type_uploaded
  ON public.quote_files (company_id, file_type, uploaded_at);
