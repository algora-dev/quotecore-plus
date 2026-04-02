-- Patch 005: Add 'confirmed' to quote_status enum
-- Run after patch 004

ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'confirmed' BEFORE 'sent';
