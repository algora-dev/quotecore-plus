-- Add job_status column to quotes table for tracking confirmed quote progress
-- Separate from 'status' which tracks draft/confirmed workflow
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS job_status text DEFAULT 'unsent';

-- Add comment for clarity
COMMENT ON COLUMN quotes.job_status IS 'Job progress tracking for confirmed quotes: unsent, sent, accepted, declined, deposit_paid, materials_ordered, install, invoice_sent, invoice_paid, finished';
