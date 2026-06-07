-- ============================================================
-- Payment Details Template
-- Migration: 20260607130000
-- ============================================================

-- 1. Company-level default payment profile
--    Stored once per company, snapshotted into every new invoice.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '{}';

-- 2. Per-invoice payment details snapshot
--    Copied from company at invoice creation time.
--    Editable per-invoice so users can override for specific customers.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '{}';
