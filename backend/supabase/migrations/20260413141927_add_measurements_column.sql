-- Add measurements column for clean measurement data
-- This stores structured business data separate from canvas rendering data

ALTER TABLE flashing_library 
ADD COLUMN measurements JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN flashing_library.measurements IS 
'Clean measurement data for order forms. Array of {id, type, sequence, value, unit, pointIndices, label?, visible?, placement?}. Example: [{"id":"length-1","type":"length","sequence":1,"value":125,"unit":"mm","pointIndices":[0,1]}]';

-- Index for faster JSON queries (optional but recommended)
CREATE INDEX idx_flashing_library_measurements ON flashing_library USING gin(measurements);
