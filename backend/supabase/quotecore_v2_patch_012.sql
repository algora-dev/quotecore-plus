-- Patch 012: Customer quote branding fields
-- Adds editable company details and footer to quotes for customer-facing quotes

-- Add branding columns to quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS cq_company_name text,
  ADD COLUMN IF NOT EXISTS cq_company_address text,
  ADD COLUMN IF NOT EXISTS cq_company_phone text,
  ADD COLUMN IF NOT EXISTS cq_company_email text,
  ADD COLUMN IF NOT EXISTS cq_company_logo_url text,
  ADD COLUMN IF NOT EXISTS cq_footer_text text;

-- Comments
COMMENT ON COLUMN public.quotes.cq_company_name IS 
  'Company name to display on customer quote. Falls back to template if null.';

COMMENT ON COLUMN public.quotes.cq_company_address IS 
  'Company address to display on customer quote. Falls back to template if null.';

COMMENT ON COLUMN public.quotes.cq_company_phone IS 
  'Company phone to display on customer quote. Falls back to template if null.';

COMMENT ON COLUMN public.quotes.cq_company_email IS 
  'Company email to display on customer quote. Falls back to template if null.';

COMMENT ON COLUMN public.quotes.cq_company_logo_url IS 
  'Company logo URL to display on customer quote. Falls back to template if null.';

COMMENT ON COLUMN public.quotes.cq_footer_text IS 
  'Footer text (terms, disclaimers) to display on customer quote. Falls back to template if null.';
