-- Allow source_state='withdrawn' on quote_revision_requests, complementing
-- the new quote-withdrawal flow added in 20260507150000_quote_withdrawal.sql.

ALTER TABLE quote_revision_requests
  DROP CONSTRAINT IF EXISTS quote_revision_requests_source_state_check;

ALTER TABLE quote_revision_requests
  ADD CONSTRAINT quote_revision_requests_source_state_check
  CHECK (source_state IN ('active', 'expired', 'responded', 'withdrawn'));
