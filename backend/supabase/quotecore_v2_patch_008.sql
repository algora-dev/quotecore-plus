-- Patch 008: Quote numbering system
-- Adds quote_number column and per-company sequential numbering

-- Add quote_number column to quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_number integer;

-- Create unique index to prevent duplicates per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_company_number 
  ON public.quotes(company_id, quote_number)
  WHERE quote_number IS NOT NULL;

-- Create sequence tracking table for per-company counters
CREATE TABLE IF NOT EXISTS public.quote_number_sequences (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for sequence table
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qns_company_access" ON public.quote_number_sequences;
CREATE POLICY "qns_company_access" ON public.quote_number_sequences
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- Function to get next quote number for a company
CREATE OR REPLACE FUNCTION public.get_next_quote_number(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_number integer;
BEGIN
  -- Insert or update sequence record
  INSERT INTO public.quote_number_sequences (company_id, next_number, updated_at)
  VALUES (p_company_id, 1001, now())
  ON CONFLICT (company_id) 
  DO UPDATE SET 
    next_number = quote_number_sequences.next_number + 1,
    updated_at = now()
  RETURNING next_number - 1 INTO v_next_number;
  
  -- If this is first insert, return 1000
  IF v_next_number IS NULL THEN
    v_next_number := 1000;
  END IF;
  
  RETURN v_next_number;
END;
$$;

-- Add comment
COMMENT ON COLUMN public.quotes.quote_number IS 
  'Sequential quote number per company (1000-999999). Assigned when quote is confirmed.';

COMMENT ON FUNCTION public.get_next_quote_number IS 
  'Returns next available quote number for a company. Starts at 1000, max 999999.';

COMMENT ON TABLE public.quote_number_sequences IS 
  'Tracks next quote number for each company. Used by get_next_quote_number().';
