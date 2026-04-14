-- Migration: Add Logo to Order Templates
-- Date: 2026-04-14
-- Purpose: Allow templates to store company logos

-- Add logo column to templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'material_order_templates' 
    AND column_name = 'default_logo_url'
  ) THEN
    ALTER TABLE material_order_templates 
      ADD COLUMN default_logo_url TEXT;
    
    COMMENT ON COLUMN material_order_templates.default_logo_url IS 'URL to company logo for order headers';
  END IF;
END $$;
