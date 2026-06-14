-- Quote Notes
-- Allows users to attach titled notes to any quote at any stage.
-- Each note has a title, body, and creation timestamp. Notes are
-- company-scoped; only members of the quote's company can manage them.

CREATE TABLE public.quote_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title               TEXT NOT NULL DEFAULT '',
  body                TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quote_notes_quote_id_idx ON public.quote_notes(quote_id);
CREATE INDEX quote_notes_company_id_idx ON public.quote_notes(company_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_quote_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER quote_notes_updated_at
  BEFORE UPDATE ON public.quote_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_quote_notes_updated_at();

-- RLS: company members can fully manage their own quote notes
ALTER TABLE public.quote_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_manage_quote_notes" ON public.quote_notes
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );
