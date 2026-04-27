-- Add copilot_visible column to copilot_progress
ALTER TABLE copilot_progress ADD COLUMN IF NOT EXISTS copilot_visible boolean DEFAULT true;
