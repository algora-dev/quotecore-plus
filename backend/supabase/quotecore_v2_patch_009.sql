-- Patch 009: Customer quote editor - Editable quote lines
-- Adds customer_quote_lines table for customizable customer-facing quotes

-- Create line_type enum
DO $$ BEGIN
  CREATE TYPE public.line_type AS ENUM ('component', 'custom', 'roof_area_header');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create customer_quote_lines table
CREATE TABLE IF NOT EXISTS public.customer_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  line_type public.line_type NOT NULL DEFAULT 'component',
  quote_component_id uuid REFERENCES public.quote_components(id) ON DELETE CASCADE,
  custom_text text,
  custom_amount numeric(12,2),
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_quote_lines_quote_id 
  ON public.customer_quote_lines(quote_id);

CREATE INDEX IF NOT EXISTS idx_customer_quote_lines_component_id 
  ON public.customer_quote_lines(quote_component_id);

CREATE INDEX IF NOT EXISTS idx_customer_quote_lines_sort 
  ON public.customer_quote_lines(quote_id, sort_order);

-- RLS policies
ALTER TABLE public.customer_quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cql_company_access" ON public.customer_quote_lines;
CREATE POLICY "cql_company_access" ON public.customer_quote_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = customer_quote_lines.quote_id
      AND q.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = customer_quote_lines.quote_id
      AND q.company_id = public.current_company_id()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_customer_quote_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_quote_lines_updated_at 
  ON public.customer_quote_lines;

CREATE TRIGGER trigger_update_customer_quote_lines_updated_at
  BEFORE UPDATE ON public.customer_quote_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_quote_lines_updated_at();

-- Comments
COMMENT ON TABLE public.customer_quote_lines IS 
  'Stores customizable lines for customer-facing quotes. Users can override display text and amounts.';

COMMENT ON COLUMN public.customer_quote_lines.line_type IS 
  'Type of line: component (from quote_components), custom (user-added), roof_area_header (section header)';

COMMENT ON COLUMN public.customer_quote_lines.custom_text IS 
  'User-edited display text. NULL = auto-generate from component data.';

COMMENT ON COLUMN public.customer_quote_lines.custom_amount IS 
  'User-edited amount. NULL = use calculated component cost.';

COMMENT ON COLUMN public.customer_quote_lines.sort_order IS 
  'Display order in customer quote (ascending). User can reorder lines.';

COMMENT ON COLUMN public.customer_quote_lines.is_visible IS 
  'Whether this line appears in customer quote. Controlled by checkbox.';
