-- Quote acceptance system: token-based URL for customers to accept/decline quotes
-- Also creates alerts table for in-app notifications

-- Add acceptance fields to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acceptance_token UUID DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ DEFAULT NULL;

-- Create unique index on acceptance_token (for fast public lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_acceptance_token ON quotes(acceptance_token) WHERE acceptance_token IS NOT NULL;

-- Alerts table for in-app notifications
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'quote_accepted', 'quote_declined'
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_company_unread ON alerts(company_id, is_read) WHERE is_read = false;

-- RLS for alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_company_access" ON alerts
  FOR ALL USING (company_id = current_company_id());

COMMENT ON COLUMN quotes.acceptance_token IS 'UUID token for public quote acceptance URL';
COMMENT ON COLUMN quotes.accepted_at IS 'Timestamp when customer accepted the quote';
COMMENT ON COLUMN quotes.declined_at IS 'Timestamp when customer declined the quote';
