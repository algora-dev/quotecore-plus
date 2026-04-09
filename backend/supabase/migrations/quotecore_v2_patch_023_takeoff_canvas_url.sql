-- Migration: Add takeoff_canvas_url to quotes table
-- Date: 2026-04-09
-- Purpose: Store exported canvas image from digital takeoff

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS takeoff_canvas_url TEXT;

COMMENT ON COLUMN quotes.takeoff_canvas_url IS 'URL to the exported canvas image showing all measurements drawn on the uploaded plan';
