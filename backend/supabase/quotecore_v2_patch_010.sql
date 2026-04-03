-- Patch 010: Customer quote templates
-- Adds template system for reusable customer quote layouts

-- Create customer_quote_templates table
CREATE TABLE IF NOT EXISTS public.customer_quote_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_starter_template boolean NOT NULL DEFAULT false,
  company_name text,
  company_address text,
  company_phone text,
  company_email text,
  company_logo_url text,
  footer_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create customer_quote_template_lines table
CREATE TABLE IF NOT EXISTS public.customer_quote_template_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.customer_quote_templates(id) ON DELETE CASCADE,
  line_type public.line_type NOT NULL DEFAULT 'component',
  component_library_id uuid REFERENCES public.component_library(id) ON DELETE CASCADE,
  custom_text text,
  custom_amount numeric(12,2),
  show_price boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add customer_quote_template_id to quote_templates
ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS customer_quote_template_id uuid REFERENCES public.customer_quote_templates(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cqt_company_id 
  ON public.customer_quote_templates(company_id);

CREATE INDEX IF NOT EXISTS idx_cqt_starter 
  ON public.customer_quote_templates(company_id, is_starter_template);

CREATE INDEX IF NOT EXISTS idx_cqtl_template_id 
  ON public.customer_quote_template_lines(template_id);

CREATE INDEX IF NOT EXISTS idx_cqtl_sort 
  ON public.customer_quote_template_lines(template_id, sort_order);

-- RLS for customer_quote_templates
ALTER TABLE public.customer_quote_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cqt_company_access" ON public.customer_quote_templates;
CREATE POLICY "cqt_company_access" ON public.customer_quote_templates
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- RLS for customer_quote_template_lines
ALTER TABLE public.customer_quote_template_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cqtl_company_access" ON public.customer_quote_template_lines;
CREATE POLICY "cqtl_company_access" ON public.customer_quote_template_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_quote_templates t
      WHERE t.id = customer_quote_template_lines.template_id
      AND t.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_quote_templates t
      WHERE t.id = customer_quote_template_lines.template_id
      AND t.company_id = public.current_company_id()
    )
  );

-- Trigger for updated_at on customer_quote_templates
CREATE OR REPLACE FUNCTION public.update_cqt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cqt_updated_at ON public.customer_quote_templates;
CREATE TRIGGER trigger_update_cqt_updated_at
  BEFORE UPDATE ON public.customer_quote_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cqt_updated_at();

-- Trigger for updated_at on customer_quote_template_lines
CREATE OR REPLACE FUNCTION public.update_cqtl_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cqtl_updated_at ON public.customer_quote_template_lines;
CREATE TRIGGER trigger_update_cqtl_updated_at
  BEFORE UPDATE ON public.customer_quote_template_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cqtl_updated_at();

-- Comments
COMMENT ON TABLE public.customer_quote_templates IS 
  'Reusable customer quote layouts. Can be linked to quote templates or used standalone.';

COMMENT ON COLUMN public.customer_quote_templates.is_starter_template IS 
  'System-wide starter template available to all users.';

COMMENT ON COLUMN public.customer_quote_templates.company_name IS 
  'Company name to display on customer quote header.';

COMMENT ON COLUMN public.customer_quote_templates.footer_text IS 
  'Disclaimers, fine print, or terms to display at bottom of customer quote.';

COMMENT ON TABLE public.customer_quote_template_lines IS 
  'Line items in customer quote templates. Defines which components are visible and their default display.';

COMMENT ON COLUMN public.quote_templates.customer_quote_template_id IS 
  'Customer quote template to use when creating quotes from this template.';
