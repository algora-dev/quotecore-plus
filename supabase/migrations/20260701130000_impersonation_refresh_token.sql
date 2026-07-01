-- Add admin_refresh_token column for session restoration
-- Migration: 20260701130000
-- Date: 2026-07-01
-- Purpose: Impersonation magic-link approach requires storing admin's refresh
--          token to restore their session when exiting impersonation.

ALTER TABLE admin_impersonation_sessions
  ADD COLUMN IF NOT EXISTS admin_refresh_token TEXT;
