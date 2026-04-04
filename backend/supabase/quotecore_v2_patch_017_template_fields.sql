-- Patch 017: Add customer_template_id and notes to templates table
-- Date: 2026-04-04
-- Purpose: Store default customer quote template and notes for quote templates

-- Add customer_template_id column (optional link to customer quote template)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'templates' AND column_name = 'customer_template_id'
  ) THEN
    ALTER TABLE templates ADD COLUMN customer_template_id uuid REFERENCES customer_quote_templates(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added customer_template_id to templates';
  ELSE
    RAISE NOTICE 'Column customer_template_id already exists in templates';
  END IF;
END $$;

COMMENT ON COLUMN templates.customer_template_id IS 
'Optional: Default customer quote template to use when creating quotes from this template.';

-- Add notes column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'templates' AND column_name = 'notes'
  ) THEN
    ALTER TABLE templates ADD COLUMN notes text;
    RAISE NOTICE 'Added notes to templates';
  ELSE
    RAISE NOTICE 'Column notes already exists in templates';
  END IF;
END $$;

COMMENT ON COLUMN templates.notes IS 
'Internal notes about the template (e.g., when to use, what type of jobs it fits).';

-- Verification
SELECT id, name, customer_template_id, notes 
FROM templates 
LIMIT 5;

-- Rollback (if needed)
-- ALTER TABLE templates DROP COLUMN IF EXISTS customer_template_id;
-- ALTER TABLE templates DROP COLUMN IF EXISTS notes;

-- Patch 017 complete
