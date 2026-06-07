-- ============================================================
-- Invoice System — Full MVP Schema
-- Migration: 20260607120000
-- ============================================================

-- 1. Invoice status enum
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'sent',
    'viewed',
    'payment_reported',
    'paid',
    'disputed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Invoice number sequences (one row per company, strictly incrementing)
CREATE TABLE IF NOT EXISTS public.invoice_number_sequences (
  company_id   UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  next_number  INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoice_number_sequences ENABLE ROW LEVEL SECURITY;

-- Sequences are only modified via the SECURITY DEFINER function below;
-- authenticated users can read their own row.
CREATE POLICY "Company members can read own invoice sequence"
  ON public.invoice_number_sequences FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

-- 3. Atomic invoice number generator
--    Returns 'INV-YYYY-NNNNNN' using the current year as a label prefix.
--    The counter never resets — it is strictly per-company sequential.
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO public.invoice_number_sequences (company_id, next_number)
  VALUES (p_company_id, 2)
  ON CONFLICT (company_id) DO UPDATE
    SET next_number = invoice_number_sequences.next_number + 1,
        updated_at  = NOW()
  RETURNING next_number - 1 INTO v_seq;

  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- 4. Main invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Unique reference numbers (generated server-side, immutable after creation)
  invoice_number       TEXT NOT NULL,
  payment_reference    TEXT NOT NULL,

  -- Lifecycle
  status               public.invoice_status NOT NULL DEFAULT 'draft',

  -- Source tracking
  source_type          TEXT NOT NULL DEFAULT 'blank'
                         CHECK (source_type IN ('quote', 'job', 'blank')),
  source_id            UUID,   -- quote.id or future job.id

  -- Customer info (searchable denorm + full snapshot)
  customer_name        TEXT NOT NULL DEFAULT '',
  customer_email       TEXT,
  customer_snapshot    JSONB NOT NULL DEFAULT '{}',

  -- Business branding (mirrors cq_* columns on quotes)
  cq_company_name      TEXT,
  cq_company_address   TEXT,
  cq_company_email     TEXT,
  cq_company_phone     TEXT,
  cq_company_logo_url  TEXT,
  cq_footer_text       TEXT,

  -- Business snapshot (bank details, full address etc.)
  business_snapshot    JSONB NOT NULL DEFAULT '{}',

  -- Financials (kept in sync when lines change)
  currency             TEXT NOT NULL DEFAULT 'GBP',
  subtotal             NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Invoice dates
  invoice_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date             DATE,

  -- Content
  notes                TEXT,
  terms                TEXT,

  -- Public customer access (high-entropy UUID, never exposed in URL as raw id)
  public_token         UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Timestamps
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at              TIMESTAMPTZ,
  viewed_at            TIMESTAMPTZ,
  payment_reported_at  TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  disputed_at          TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,

  UNIQUE (company_id, invoice_number),
  UNIQUE (public_token)
);

CREATE INDEX IF NOT EXISTS idx_invoices_company_id    ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_public_token  ON public.invoices(public_token);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON public.invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_source        ON public.invoices(source_type, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage own invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

-- Public reads (customer invoice view) are performed via the admin/service-role
-- client in the Next.js route — same pattern as orders/[token] and accept/[token].
-- No anon policy needed here.

-- 5. Invoice lines
CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,

  -- Where this line came from
  line_source_type  TEXT NOT NULL DEFAULT 'custom'
                      CHECK (line_source_type IN (
                        'custom', 'catalog', 'component', 'quote_import', 'job_import'
                      )),
  source_id         UUID,   -- catalog_rows.id or component_library.id

  -- Line content
  title             TEXT NOT NULL DEFAULT '',
  description       TEXT,
  quantity          NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit              TEXT NOT NULL DEFAULT 'item',
  unit_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total        NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Display toggles (mirror customer_quote_lines)
  show_price        BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible        BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON public.invoice_lines(invoice_id);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage own invoice lines"
  ON public.invoice_lines FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

-- 6. Invoice activity timeline
CREATE TABLE IF NOT EXISTS public.invoice_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,  -- 'created','edited','sent','viewed','payment_reported',
                               --   'paid','dispute_submitted','status_changed','cancelled'
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_activity_invoice_id ON public.invoice_activity(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_activity_company_id ON public.invoice_activity(company_id);

ALTER TABLE public.invoice_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage own invoice activity"
  ON public.invoice_activity FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

-- 7. Invoice disputes
CREATE TABLE IF NOT EXISTS public.invoice_disputes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_name   TEXT NOT NULL DEFAULT '',
  recipient_email  TEXT,
  reason           TEXT NOT NULL DEFAULT '',
  message          TEXT NOT NULL DEFAULT '',
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_disputes_invoice_id ON public.invoice_disputes(invoice_id);

ALTER TABLE public.invoice_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage own invoice disputes"
  ON public.invoice_disputes FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

-- 8. Extend existing alerts table with invoice_id (additive, nullable)
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_invoice_id
  ON public.alerts(invoice_id)
  WHERE invoice_id IS NOT NULL;
