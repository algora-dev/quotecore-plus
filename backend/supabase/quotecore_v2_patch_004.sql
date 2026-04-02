-- Patch 004: Multi-entry roof areas + lock state
-- Run after patch 003

-- Add is_locked to quote_roof_areas
ALTER TABLE public.quote_roof_areas
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Create quote_roof_area_entries table
CREATE TABLE IF NOT EXISTS public.quote_roof_area_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_roof_area_id uuid NOT NULL REFERENCES public.quote_roof_areas(id) ON DELETE CASCADE,
  width_m numeric(10,2) NOT NULL,
  length_m numeric(10,2) NOT NULL,
  sqm numeric(10,2) NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_roof_area_entries_area ON public.quote_roof_area_entries(quote_roof_area_id);

-- RLS for quote_roof_area_entries
ALTER TABLE public.quote_roof_area_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage entries for their company's quote roof areas"
  ON public.quote_roof_area_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_roof_areas qra
      JOIN public.quotes q ON q.id = qra.quote_id
      JOIN public.users u ON u.id = auth.uid()
      WHERE qra.id = quote_roof_area_entries.quote_roof_area_id
        AND q.company_id = u.company_id
    )
  );
