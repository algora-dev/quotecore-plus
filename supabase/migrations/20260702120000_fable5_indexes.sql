-- ============================================================================
-- Fable 5 audit F-17: Add missing indexes for hot query paths
-- ============================================================================
-- All indexes are partial (WHERE ...) where the query pattern only targets
-- a subset of rows. This keeps indexes small and fast to maintain.
-- ============================================================================

-- 1. admin_impersonation_sessions: active session lookups by target user
--    Query: WHERE target_user_id = ? AND ended_at IS NULL AND started_at > ?
--    Was doing a full table scan on every impersonation check.
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_active_target
  ON admin_impersonation_sessions (target_user_id, started_at DESC)
  WHERE ended_at IS NULL;

-- 2. scheduled_messages: dispatch sweep queries
--    Query: WHERE status = 'scheduled' AND fire_at <= now()
--    Partial index on scheduled rows only keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
  ON scheduled_messages (fire_at)
  WHERE status = 'scheduled';

-- 3. alerts: unread alerts per user (bell icon, inbox)
--    Query: WHERE user_id = ? AND is_read = false
--    Note: alerts table uses company_id not user_id; bell_cleared_at tracks
--    dismissal. Index on unread + company for the bell query.
CREATE INDEX IF NOT EXISTS idx_alerts_unread_company
  ON alerts (company_id, created_at DESC)
  WHERE is_read = false;

-- 4. quotes: list page filters by company + status
--    Query: WHERE company_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_quotes_company_status
  ON quotes (company_id, status);

-- 5. rate_limits: prune job scans by key
--    Query (prune): DELETE FROM rate_limits WHERE updated_at < ?
--    The prune cron already has a daily job; this index helps if we ever
--    need to scan by key for debugging or admin views.
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_updated
  ON rate_limits (bucket_key, updated_at DESC);

-- 6. webhook_deliveries: already has UNIQUE on (provider, event_id)
--    but the quarantine replay scan looks up by processing_result.
--    Query: WHERE processing_result = 'quarantined' AND provider = ?
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_quarantine
  ON webhook_deliveries (provider, received_at DESC)
  WHERE processing_result = 'quarantined';
