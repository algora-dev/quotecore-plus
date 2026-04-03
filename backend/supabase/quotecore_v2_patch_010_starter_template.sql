-- Patch 010B: Insert Starter Customer Quote Template
-- System-wide default template for new users

-- Insert starter template (uses first company as owner, but is_starter_template = true makes it available to all)
DO $$
DECLARE
  starter_template_id uuid;
  first_company_id uuid;
BEGIN
  -- Get first company ID (just for foreign key constraint)
  SELECT id INTO first_company_id FROM public.companies LIMIT 1;
  
  -- If no companies exist yet, exit
  IF first_company_id IS NULL THEN
    RAISE NOTICE 'No companies found. Skipping starter template creation.';
    RETURN;
  END IF;

  -- Insert starter template
  INSERT INTO public.customer_quote_templates (
    company_id,
    name,
    is_starter_template,
    company_name,
    company_address,
    company_phone,
    company_email,
    company_logo_url,
    footer_text
  ) VALUES (
    first_company_id,
    'Starter Customer Quote Template',
    true, -- System-wide template
    'Your Company Name',
    '123 Main Street, City, Country, Postcode',
    '+64 21 123 4567',
    'info@yourcompany.com',
    null, -- Logo URL (user can upload)
    'Terms & Conditions: Payment due within 30 days. Quote valid for 30 days from issue date. All work carried out in accordance with industry standards.'
  ) RETURNING id INTO starter_template_id;

  -- Insert default template lines (empty - users customize during quote template creation)
  -- No default lines because template lines come from component selection during template creation

  RAISE NOTICE 'Starter template created with ID: %', starter_template_id;
END $$;
