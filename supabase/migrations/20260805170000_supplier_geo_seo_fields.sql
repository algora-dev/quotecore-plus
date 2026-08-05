-- 20260805170000_supplier_geo_seo_fields.sql
-- Phase 6: Add geo, opening hours, and price range fields to supplier_profiles
-- for LocalBusiness JSON-LD enrichment (geo coordinates, openingHoursSpecification, priceRange)

ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS branch_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS branch_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_range TEXT DEFAULT NULL;

COMMENT ON COLUMN supplier_profiles.branch_latitude IS 'Branch latitude for geo schema. Nullable when supplier has no physical location.';
COMMENT ON COLUMN supplier_profiles.branch_longitude IS 'Branch longitude for geo schema. Nullable when supplier has no physical location.';
COMMENT ON COLUMN supplier_profiles.opening_hours IS 'OpeningHoursSpecification JSON array, e.g. [{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday"],"opens":"08:00","closes":"17:00"}]. Null = not specified.';
COMMENT ON COLUMN supplier_profiles.price_range IS 'Schema.org priceRange indicator, e.g. "$" or "$$-$$$". Null = not specified.';
