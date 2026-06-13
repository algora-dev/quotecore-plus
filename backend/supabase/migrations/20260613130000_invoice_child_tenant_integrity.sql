-- =====================================================================
-- 20260613130000_invoice_child_tenant_integrity.sql
-- Gerald pre-live audit H-04 (High): invoice child-table tenant integrity.
--
-- PROBLEM
--   invoice_lines / invoice_activity / invoice_disputes each carry their own
--   company_id (checked by RLS) AND an invoice_id FK to invoices(id). But
--   NOTHING enforces that the referenced invoice actually belongs to the same
--   company. A child row could have company_id = Company B while invoice_id
--   points at Company A's invoice. RLS only checks the child's own company_id,
--   so the mismatch passes. Service-role / public read paths that fetch child
--   rows by invoice_id alone (e.g. /invoice/[token]) would then render
--   cross-tenant-polluted child rows on someone else's invoice.
--
-- FIX (structural, strictly stronger than an RLS subquery)
--   1. UNIQUE (id, company_id) on invoices so it can be the target of a
--      composite FK. (id is already PK -> always unique; this is a cheap
--      additional unique index.)
--   2. Composite FK (invoice_id, company_id) REFERENCES invoices(id, company_id)
--      on each child table. Now a child row CANNOT exist unless its company_id
--      equals the parent invoice's company_id - enforced on every write,
--      including service-role, with no way to bypass. The original
--      single-column invoice_id FK stays (ON DELETE CASCADE drives cleanup).
--
--   App-side defence-in-depth (.eq('company_id', invoice.company_id) on the
--   service-role child reads) ships alongside in the same commit.
--
--   Pre-checked on the live DB: zero company_id mismatches and zero orphans
--   across all three child tables, so these constraints validate cleanly.
-- =====================================================================

BEGIN;

-- 1. Composite-unique parent key (FK target). id is the PK so this is unique
--    by construction; the named unique constraint just makes it referenceable.
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_id_company_id_key UNIQUE (id, company_id);

-- 2. Composite tenant FKs on the child tables. ON DELETE CASCADE keeps the
--    existing delete-with-parent behaviour. These are IN ADDITION to the
--    original invoice_id FKs.
ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_invoice_company_fk
  FOREIGN KEY (invoice_id, company_id)
  REFERENCES public.invoices(id, company_id) ON DELETE CASCADE;

ALTER TABLE public.invoice_activity
  ADD CONSTRAINT invoice_activity_invoice_company_fk
  FOREIGN KEY (invoice_id, company_id)
  REFERENCES public.invoices(id, company_id) ON DELETE CASCADE;

ALTER TABLE public.invoice_disputes
  ADD CONSTRAINT invoice_disputes_invoice_company_fk
  FOREIGN KEY (invoice_id, company_id)
  REFERENCES public.invoices(id, company_id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT invoice_lines_invoice_company_fk ON public.invoice_lines IS
  'H-04: guarantees invoice_id belongs to the same company_id as this child row. Prevents cross-tenant child-row pollution that RLS (child company_id only) did not catch.';
COMMENT ON CONSTRAINT invoice_activity_invoice_company_fk ON public.invoice_activity IS
  'H-04: composite tenant FK - child company_id must match parent invoice company_id.';
COMMENT ON CONSTRAINT invoice_disputes_invoice_company_fk ON public.invoice_disputes IS
  'H-04: composite tenant FK - child company_id must match parent invoice company_id.';

COMMIT;
