-- Admin Expansion: impersonation sessions, app settings, cron execution log
-- Migration: 20260701120000
-- Date: 2026-07-01
-- Gerald pre-build audit findings incorporated (H-01, H-02, H-03, M-01..M-04)

-- =====================================================================
-- 1. admin_impersonation_sessions (Feature 6)
--    Gerald H-01: NO admin_session_backup column. Opaque session id only.
-- =====================================================================

CREATE TABLE admin_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  exit_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_can_read_own_sessions ON admin_impersonation_sessions
  FOR SELECT USING (auth.uid() = admin_user_id);

CREATE POLICY admin_can_insert_own_sessions ON admin_impersonation_sessions
  FOR INSERT WITH CHECK (auth.uid() = admin_user_id);

CREATE POLICY admin_can_update_own_sessions ON admin_impersonation_sessions
  FOR UPDATE USING (auth.uid() = admin_user_id);

-- No DELETE policy — sessions are never deleted, only marked ended_at.

CREATE INDEX idx_impersonation_sessions_target ON admin_impersonation_sessions(target_user_id)
  WHERE ended_at IS NULL;
CREATE INDEX idx_impersonation_sessions_admin_active ON admin_impersonation_sessions(admin_user_id)
  WHERE ended_at IS NULL;

-- =====================================================================
-- 2. app_settings (Feature 7)
--    Gerald M-02: No RLS policies. Service-role only.
-- =====================================================================

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- No policies — access is service-role only (server actions with is_admin check).

INSERT INTO app_settings (key, value, updated_by_user_id)
VALUES (
  'global_announcement',
  '{"active": false, "message": "", "type": "info", "starts_at": null, "ends_at": null, "dismissible": true}'::jsonb,
  NULL
)
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- 3. cron_execution_log (Feature 7b)
--    For scheduled messages dispatch cron only (most important).
-- =====================================================================

CREATE TABLE cron_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT,
  details JSONB
);

ALTER TABLE cron_execution_log ENABLE ROW LEVEL SECURITY;
-- No policies — service-role only.

CREATE INDEX idx_cron_log_job_started ON cron_execution_log(job_name, started_at DESC);
