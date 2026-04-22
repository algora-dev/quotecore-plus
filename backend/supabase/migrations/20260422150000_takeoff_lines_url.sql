-- Add takeoff_lines_url for lines-only canvas export (no background image)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS takeoff_lines_url TEXT DEFAULT NULL;

COMMENT ON COLUMN quotes.takeoff_lines_url IS 'URL for lines-only canvas export from digital takeoff (white background, no plan image)';
