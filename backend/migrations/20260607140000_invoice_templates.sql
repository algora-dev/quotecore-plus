-- ============================================================
-- Invoice Templates
-- Migration: 20260607140000
-- ============================================================

-- Invoice templates — company-level, named, reusable.
-- Contains header (branding), payment details, and footer in one template.
-- Selected at invoice creation time (or applied manually in the editor).
CREATE TABLE IF NOT EXISTS public.invoice_templates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL DEFAULT 'My Invoice Template',

  -- Branding / header (mirrors cq_* fields on invoices + customer_quote_templates)
  company_name            TEXT,
  company_address         TEXT,
  company_email           TEXT,
  company_phone           TEXT,
  company_logo_url        TEXT,
  footer_text             TEXT,

  -- Payment details
  payment_account_name    TEXT,
  payment_bank_name       TEXT,
  payment_account_number  TEXT,
  payment_sort_code       TEXT,
  payment_link            TEXT,

  -- Optional content defaults
  default_notes           TEXT,
  default_terms           TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_company_id
  ON public.invoice_templates(company_id);

ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage own invoice templates"
  ON public.invoice_templates FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

-- Also add template_id FK to invoices so we can track which template was used
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.invoice_templates(id) ON DELETE SET NULL;
