-- 20260804160000_supplier_takeoff_builder_enabled.sql
-- Add takeoff_builder_enabled flag to supplier_profiles so suppliers can opt in/out
-- of the free roofing takeoff builder from their self-service dashboard.

ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS takeoff_builder_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN supplier_profiles.takeoff_builder_enabled IS
  'When true, this supplier appears in the free roofing takeoff builder and their branded URL is active.';
