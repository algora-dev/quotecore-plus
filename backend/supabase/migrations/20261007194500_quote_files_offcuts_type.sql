-- ============================================================================
-- Offcuts Phase 1 (owner green-light 2026-10-07 19:25): quote_files gains the
-- 'offcuts' file type. Files & Documents rows of this type are the A4
-- landscape one-pager PDFs saved from the Find offcuts workbench
-- (plan render + lineal/sheet schedule + material figures).
--
-- The live constraint already carried the generated-document types
-- (customer_quote_pdf, takeoff_report_pdf, takeoff_data_json,
-- labour_sheet_pdf) beyond the 20260527 migration file; this list is the
-- verified live definition (queried 2026-10-07) + 'offcuts'.
-- ============================================================================
BEGIN;

ALTER TABLE public.quote_files
  DROP CONSTRAINT IF EXISTS quote_files_file_type_check;

ALTER TABLE public.quote_files
  ADD CONSTRAINT quote_files_file_type_check
  CHECK (file_type = ANY (ARRAY[
    'logo'::text,
    'plan'::text,
    'supporting'::text,
    'takeoff_canvas'::text,
    'takeoff_lines'::text,
    'customer_quote_pdf'::text,
    'takeoff_report_pdf'::text,
    'takeoff_data_json'::text,
    'labour_sheet_pdf'::text,
    'offcuts'::text
  ]));

COMMIT;
