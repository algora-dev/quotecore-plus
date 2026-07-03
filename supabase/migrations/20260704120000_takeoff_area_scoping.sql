-- Migration: 20260704120000_takeoff_area_scoping.sql
-- Purpose: Add quote_roof_area_id to quote_takeoff_measurements so measurements
--          link directly to areas (not indirectly via takeoff_pages).
-- Approach: ADDITIVE only — nullable column, backfill from takeoff_pages, indexes.
--           No NOT NULL constraint yet (added in a later migration after all code
--           paths populate the column). Old save_takeoff_atomic RPC continues to
--           work unchanged — the new column is optional.
-- Rollback: ALTER TABLE quote_takeoff_measurements DROP COLUMN quote_roof_area_id;
--           DROP INDEX idx_takeoff_measurements_area; DROP INDEX idx_takeoff_pages_area;

-- 1. Add nullable column
ALTER TABLE quote_takeoff_measurements
  ADD COLUMN quote_roof_area_id uuid REFERENCES quote_roof_areas(id) ON DELETE CASCADE;

-- 2. Backfill from takeoff_pages.quote_roof_area_id
UPDATE quote_takeoff_measurements m
SET quote_roof_area_id = p.quote_roof_area_id
FROM takeoff_pages p
WHERE m.page_id = p.id
  AND p.quote_roof_area_id IS NOT NULL
  AND m.quote_roof_area_id IS NULL;

-- 3. Index for area-scoped queries (partial — only rows where the column is set)
CREATE INDEX idx_takeoff_measurements_area
  ON quote_takeoff_measurements(quote_roof_area_id)
  WHERE quote_roof_area_id IS NOT NULL;

-- 4. Index for area-scoped page lookups
CREATE INDEX idx_takeoff_pages_area
  ON takeoff_pages(quote_roof_area_id)
  WHERE quote_roof_area_id IS NOT NULL;
