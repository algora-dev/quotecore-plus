-- Migration: 20260728180000_catalog_service_areas.sql
-- Add service_areas to catalogs so suppliers can set locations per-catalogue

ALTER TABLE catalogs
  ADD COLUMN IF NOT EXISTS service_areas TEXT[];
