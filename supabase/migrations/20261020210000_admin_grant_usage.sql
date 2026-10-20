-- Admin-grant hard enforcement usage ledger (owner decisions 2026-10-20:
-- the ONLY count quota is quotes, consumed at email send or acceptance-URL
-- commit, never at creation/drafting. Libraries, attachments and drawings
-- carry no per-item caps - they simply consume the combined storage
-- allowance).
-- Service-role only: server actions enforce via createAdminClient. RLS on,
-- no anon/authenticated policies or grants (Oct 30 2026 rule: explicit
-- grants only where the Data API needs them; this ledger never does).
CREATE TABLE IF NOT EXISTS public.company_admin_grant_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('quote_sent')),
  ref_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_grant_usage_unique UNIQUE (company_id, kind, ref_id)
);

CREATE INDEX IF NOT EXISTS admin_grant_usage_period_idx
  ON public.company_admin_grant_usage (company_id, kind, occurred_at);

ALTER TABLE public.company_admin_grant_usage ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.company_admin_grant_usage TO service_role;
