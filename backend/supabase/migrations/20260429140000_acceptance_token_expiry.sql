-- Add expiry column to acceptance tokens (30 days default)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acceptance_token_expires_at TIMESTAMPTZ;
