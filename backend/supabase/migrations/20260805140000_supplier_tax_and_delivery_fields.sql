-- 20260805140000_supplier_tax_and_delivery_fields.sql
-- Supplier tax treatment and delivery coverage fields
-- Requested by Ron for supplier dashboard enhancements

-- === Tax treatment columns ===
ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS tax_treatment text DEFAULT 'exclusive'
    CHECK (tax_treatment IN ('inclusive', 'exclusive', 'not_applicable'));

ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS tax_name text;

ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2);

-- === Delivery coverage: text -> text[] ===
-- Step 1: Drop existing CHECK constraint (compares text = ANY(text[]), incompatible with text[])
ALTER TABLE supplier_profiles
  DROP CONSTRAINT IF EXISTS supplier_profiles_delivery_coverage_chk;

-- Step 2: Drop the default (it's text type, can't cast to text[])
ALTER TABLE supplier_profiles
  ALTER COLUMN delivery_coverage DROP DEFAULT;

-- Step 3: Migrate existing values to new enum names
-- Old: local, regional, national, international
-- New: local, regional, nationwide, pickup_only
UPDATE supplier_profiles
  SET delivery_coverage = CASE
    WHEN delivery_coverage = 'national' THEN 'nationwide'
    WHEN delivery_coverage = 'international' THEN 'nationwide'
    ELSE delivery_coverage
  END
  WHERE delivery_coverage IS NOT NULL;

-- Step 4: Convert text column to text[] column
ALTER TABLE supplier_profiles
  ALTER COLUMN delivery_coverage TYPE text[]
  USING CASE
    WHEN delivery_coverage IS NULL THEN NULL
    ELSE ARRAY[delivery_coverage::text]
  END;

-- Step 5: Add new CHECK constraint (using <@ "is contained by" operator)
ALTER TABLE supplier_profiles
  ADD CONSTRAINT supplier_profiles_delivery_coverage_check
  CHECK (delivery_coverage IS NULL OR delivery_coverage <@ ARRAY['nationwide', 'regional', 'local', 'pickup_only']::text[]);

-- Comments
COMMENT ON COLUMN supplier_profiles.tax_treatment IS 'How tax is applied to prices: inclusive (prices include tax), exclusive (tax added at checkout), not_applicable (no tax)';
COMMENT ON COLUMN supplier_profiles.tax_name IS 'Display name for tax, e.g. GST, VAT';
COMMENT ON COLUMN supplier_profiles.tax_rate IS 'Tax rate as percentage, e.g. 15.00 for 15%';
COMMENT ON COLUMN supplier_profiles.delivery_coverage IS 'Array of coverage types: nationwide, regional, local, pickup_only';
