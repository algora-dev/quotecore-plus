-- Generated integration artifacts are stored beside uploaded quote files so
-- connectors can resolve them through the same signed-download pipeline.
-- Keep this allowlist aligned with saveFileMetadata and ExportArtifactRole.

ALTER TABLE public.quote_files
  DROP CONSTRAINT IF EXISTS quote_files_file_type_check;

ALTER TABLE public.quote_files
  ADD CONSTRAINT quote_files_file_type_check
  CHECK (
    file_type IN (
      'logo',
      'plan',
      'supporting',
      'takeoff_canvas',
      'takeoff_lines',
      'customer_quote_pdf',
      'takeoff_report_pdf',
      'takeoff_data_json',
      'labour_sheet_pdf'
    )
  );
