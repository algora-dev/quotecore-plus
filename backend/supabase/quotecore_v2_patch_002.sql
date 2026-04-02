-- Patch 002: Component entries (multi-piece support)
-- Each quote component can have multiple individual entries (lengths, areas, items)

CREATE TABLE IF NOT EXISTS public.quote_component_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_component_id uuid NOT NULL REFERENCES public.quote_components(id) ON DELETE CASCADE,
  raw_value numeric(14,4) NOT NULL,
  value_after_waste numeric(14,4) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qce_component ON public.quote_component_entries(quote_component_id);

-- RLS
ALTER TABLE public.quote_component_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qce_all_by_quote" ON public.quote_component_entries;
CREATE POLICY "qce_all_by_quote" ON public.quote_component_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_components qc
      JOIN public.quotes q ON q.id = qc.quote_id
      WHERE qc.id = quote_component_id
        AND q.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quote_components qc
      JOIN public.quotes q ON q.id = qc.quote_id
      WHERE qc.id = quote_component_id
        AND q.company_id = public.current_company_id()
    )
  );
