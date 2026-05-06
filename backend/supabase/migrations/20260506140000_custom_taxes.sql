-- Custom taxes: companies can define multiple named tax rates that stack on quotes.
--
-- Two-table design:
--   company_taxes: defaults attached to the company (the "library")
--   quote_taxes:   per-quote snapshot, copied from company_taxes at quote creation;
--                  edits on a quote do NOT affect the company defaults
--
-- We deliberately keep quotes.tax_rate around as a compatibility column. New code
-- reads/writes quote_taxes; legacy paths and existing PDFs/UI continue to render the
-- summed rate from quotes.tax_rate, which we keep in sync via a trigger so nothing
-- silently breaks until every consumer is migrated to quote_taxes.

-- ---------------------------------------------------------------------------
-- company_taxes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_taxes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  rate_percent NUMERIC(7, 4) NOT NULL DEFAULT 0,  -- e.g. 15.0000 for 15%
  sort_order   INTEGER NOT NULL DEFAULT 0,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_taxes_rate_range CHECK (rate_percent >= 0 AND rate_percent <= 100),
  CONSTRAINT company_taxes_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_company_taxes_company
  ON public.company_taxes (company_id, sort_order)
  WHERE archived_at IS NULL;

ALTER TABLE public.company_taxes ENABLE ROW LEVEL SECURITY;

-- Mirrors the existing company-scoped policies elsewhere in the schema.
CREATE POLICY "company_taxes_company_scope" ON public.company_taxes
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- quote_taxes
-- ---------------------------------------------------------------------------
-- include_in_quote / include_in_labor let a single tax row drive the customer quote
-- and the labor sheet independently (Shaun: "labor sheet pdf, same as above, allow
-- the user to toggle on/off/edit").
CREATE TABLE IF NOT EXISTS public.quote_taxes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  source_tax_id    UUID REFERENCES public.company_taxes(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  rate_percent     NUMERIC(7, 4) NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  include_in_quote BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_labor BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quote_taxes_rate_range CHECK (rate_percent >= 0 AND rate_percent <= 100),
  CONSTRAINT quote_taxes_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_quote_taxes_quote
  ON public.quote_taxes (quote_id, sort_order);

ALTER TABLE public.quote_taxes ENABLE ROW LEVEL SECURITY;

-- Use the same company-scope check via the parent quote.
CREATE POLICY "quote_taxes_company_scope" ON public.quote_taxes
  FOR ALL
  USING (
    quote_id IN (
      SELECT q.id FROM public.quotes q
      WHERE q.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT q.id FROM public.quotes q
      WHERE q.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers (idempotent — reuse an existing helper if it already exists,
-- otherwise create one scoped to these tables).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_taxes_touch_updated_at ON public.company_taxes;
CREATE TRIGGER company_taxes_touch_updated_at
  BEFORE UPDATE ON public.company_taxes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS quote_taxes_touch_updated_at ON public.quote_taxes;
CREATE TRIGGER quote_taxes_touch_updated_at
  BEFORE UPDATE ON public.quote_taxes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Backfill: turn each company's existing default_tax_rate into a single
-- "Tax" entry in company_taxes (only when it has a non-zero rate and no
-- existing tax rows).
-- ---------------------------------------------------------------------------
INSERT INTO public.company_taxes (company_id, name, rate_percent, sort_order)
SELECT c.id, 'Tax', c.default_tax_rate, 0
FROM public.companies c
LEFT JOIN public.company_taxes ct ON ct.company_id = c.id
WHERE c.default_tax_rate IS NOT NULL
  AND c.default_tax_rate > 0
  AND ct.id IS NULL;

-- Backfill quote_taxes from each existing quote's tax_rate (single-line "Tax").
INSERT INTO public.quote_taxes (quote_id, name, rate_percent, sort_order, include_in_quote, include_in_labor)
SELECT q.id, 'Tax', q.tax_rate, 0, TRUE, TRUE
FROM public.quotes q
LEFT JOIN public.quote_taxes qt ON qt.quote_id = q.id
WHERE q.tax_rate IS NOT NULL
  AND q.tax_rate > 0
  AND qt.id IS NULL;

-- ---------------------------------------------------------------------------
-- Keep quotes.tax_rate in sync with the sum of include_in_quote tax rows so legacy
-- callers continue to render the right number until they migrate to quote_taxes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_quote_tax_rate()
RETURNS trigger AS $$
DECLARE
  target_quote_id UUID;
  total NUMERIC(10, 4);
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_quote_id := OLD.quote_id;
  ELSE
    target_quote_id := NEW.quote_id;
  END IF;

  SELECT COALESCE(SUM(rate_percent), 0)
  INTO total
  FROM public.quote_taxes
  WHERE quote_id = target_quote_id
    AND include_in_quote = TRUE;

  UPDATE public.quotes
  SET tax_rate = total
  WHERE id = target_quote_id;

  RETURN NULL;  -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quote_taxes_sync_tax_rate ON public.quote_taxes;
CREATE TRIGGER quote_taxes_sync_tax_rate
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_taxes
  FOR EACH ROW EXECUTE FUNCTION public.sync_quote_tax_rate();
