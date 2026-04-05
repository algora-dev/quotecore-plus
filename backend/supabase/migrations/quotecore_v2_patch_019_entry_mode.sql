-- Migration: Add entry_mode column to quotes table
-- Date: 2026-04-05
-- Purpose: Support Manual vs Digital takeoff entry modes

-- Add entry_mode column
ALTER TABLE quotes 
ADD COLUMN entry_mode TEXT DEFAULT 'manual' 
CHECK (entry_mode IN ('manual', 'digital'));

-- Update existing quotes to manual mode
UPDATE quotes SET entry_mode = 'manual' WHERE entry_mode IS NULL;

-- Add index for performance (optional)
CREATE INDEX idx_quotes_entry_mode ON quotes(entry_mode);

-- Add comment for documentation
COMMENT ON COLUMN quotes.entry_mode IS 'Quote entry method: manual (traditional quote builder) or digital (digital takeoff canvas)';
