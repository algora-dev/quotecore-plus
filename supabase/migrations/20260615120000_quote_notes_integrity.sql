-- Quote Notes integrity hardening (Gerald H-02 + L-01)
--
-- H-02: Composite FK from quote_notes(quote_id, company_id) -> quotes(id, company_id)
--       prevents a note being attached to a quote from a different company even if
--       the app layer is bypassed. Requires UNIQUE(id, company_id) on quotes (already exists).
--
-- L-01: CHECK constraints on quote_notes text fields to prevent very large rows.

-- Step 1: Composite UNIQUE on quotes — already present; guard with DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_id_company_id_uniq'
      AND conrelid = 'public.quotes'::regclass
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_id_company_id_uniq UNIQUE (id, company_id);
  END IF;
END $$;

-- Step 2: Composite FK on quote_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_notes_quote_company_fk'
      AND conrelid = 'public.quote_notes'::regclass
  ) THEN
    ALTER TABLE public.quote_notes
      ADD CONSTRAINT quote_notes_quote_company_fk
      FOREIGN KEY (quote_id, company_id)
      REFERENCES public.quotes(id, company_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Step 3: Length caps (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_notes_title_length'
      AND conrelid = 'public.quote_notes'::regclass
  ) THEN
    ALTER TABLE public.quote_notes
      ADD CONSTRAINT quote_notes_title_length CHECK (char_length(title) <= 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_notes_body_length'
      AND conrelid = 'public.quote_notes'::regclass
  ) THEN
    ALTER TABLE public.quote_notes
      ADD CONSTRAINT quote_notes_body_length CHECK (char_length(body) <= 10000);
  END IF;
END $$;
