-- Add per-upload tax inclusion flags to supplier_profiles
-- price_list_includes_tax: whether the uploaded price list (PDF/CSV) includes tax
-- takeoff_library_includes_tax: whether the component library assigned to the takeoff builder includes tax
-- Both use tax_name + tax_rate from the supplier profile as the source of truth for the tax identity

ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS price_list_includes_tax boolean DEFAULT null,
  ADD COLUMN IF NOT EXISTS takeoff_library_includes_tax boolean DEFAULT null;

COMMENT ON COLUMN supplier_profiles.price_list_includes_tax IS 'Whether the uploaded price list file includes tax. Null = not specified.';
COMMENT ON COLUMN supplier_profiles.takeoff_library_includes_tax IS 'Whether the takeoff builder component library prices include tax. Null = not specified.';
