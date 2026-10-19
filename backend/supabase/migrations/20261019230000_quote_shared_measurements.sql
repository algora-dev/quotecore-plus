-- Quote-builder shared measurements (owner directive 2026-10-19): persistent
-- share offers created in the quote builder component step. A user shares one
-- / combined / all entries of a lineal component; the snapshot (value in
-- metric metres) is stored quote-scoped so any lineal component can attach it
-- in one click. Snapshots are independent of the source component (no FK on
-- source_component_id) - deleting the source keeps the shared figure usable.
-- RLS mirrors quote_roof_areas_all: company scope via the quotes join.
BEGIN;

CREATE TABLE public.quote_shared_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('area','lineal')),
  mode text NOT NULL CHECK (mode IN ('entry','combined','all')),
  label text NOT NULL,
  value numeric NOT NULL CHECK (value > 0),
  source_component_id uuid NOT NULL,
  source_component_name text NOT NULL,
  source_entry_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(source_entry_ids) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_shared_measurements_quote_idx
  ON public.quote_shared_measurements(quote_id);

ALTER TABLE public.quote_shared_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_shared_measurements FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.quote_shared_measurements FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.quote_shared_measurements TO authenticated;

CREATE POLICY quote_shared_measurements_all ON public.quote_shared_measurements
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_shared_measurements.quote_id
      AND q.company_id = current_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_shared_measurements.quote_id
      AND q.company_id = current_company_id()
  ));

COMMIT;
