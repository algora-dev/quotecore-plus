-- Quote revision requests: customers click "Request Re-Quote" from the public
-- acceptance URL (active, expired, or already-responded states) and submit a
-- note. The user sees this as an alert in their dashboard and can reach back
-- out via mailto. No SMTP — we keep the existing user-driven email pattern.

CREATE TABLE IF NOT EXISTS quote_revision_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  -- Customer-supplied contact info. Both optional — they may already be in the
  -- quote record, but capturing them here keeps the request self-contained
  -- (and lets the customer override if they want to be reached differently).
  customer_name TEXT,
  customer_email TEXT,
  notes TEXT NOT NULL,
  -- Hint about the quote state at the time of submission so the user can
  -- prioritise (an expired-link request signals an existing relationship vs a
  -- live-quote tweak request).
  source_state TEXT NOT NULL DEFAULT 'active'
    CHECK (source_state IN ('active', 'expired', 'responded')),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_requests_quote
  ON quote_revision_requests(quote_id);

CREATE INDEX IF NOT EXISTS idx_revision_requests_company_unresolved
  ON quote_revision_requests(company_id) WHERE resolved_at IS NULL;

-- RLS: only the owning company can read/update; anonymous inserts are handled
-- via the service role admin client in the server action (same pattern the
-- existing accept/decline flow uses).
ALTER TABLE quote_revision_requests ENABLE ROW LEVEL SECURITY;

-- Drop and recreate so the migration is idempotent against re-runs.
DROP POLICY IF EXISTS "revision_requests_company_access" ON quote_revision_requests;
CREATE POLICY "revision_requests_company_access" ON quote_revision_requests
  FOR ALL USING (company_id = current_company_id());

COMMENT ON TABLE quote_revision_requests IS 'Customer-submitted re-quote / revision requests from the public acceptance URL.';
COMMENT ON COLUMN quote_revision_requests.source_state IS 'State of the quote/link when the request was submitted.';
