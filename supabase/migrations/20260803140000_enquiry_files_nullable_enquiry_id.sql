-- Make enquiry_id nullable on supplier_takeoff_enquiry_files
-- so files can be uploaded before the enquiry is created.
-- The enquiry_id is linked after enquiry creation.
ALTER TABLE public.supplier_takeoff_enquiry_files
  ALTER COLUMN enquiry_id DROP NOT NULL;
