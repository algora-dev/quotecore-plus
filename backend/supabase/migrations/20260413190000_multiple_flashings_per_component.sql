-- Migration: Multiple Flashings Per Component
-- Date: 2026-04-13
-- Purpose: Allow components to have multiple flashings (not just one default)

-- Drop the old single-flashing column
ALTER TABLE component_library
  DROP COLUMN IF EXISTS default_flashing_id;

-- Add new array column for multiple flashings
ALTER TABLE component_library
  ADD COLUMN flashing_ids UUID[] DEFAULT ARRAY[]::UUID[];

COMMENT ON COLUMN component_library.flashing_ids IS 'Array of flashing IDs assigned to this component for material orders';

-- Create index for array queries
CREATE INDEX IF NOT EXISTS idx_component_library_flashing_ids ON component_library USING GIN(flashing_ids);
