-- quotecore_v2_patch_026_notification_prefs_email.sql
--
-- Message Center: per-event EMAIL notification toggles.
--
-- SHAPE CHANGE (no column type change — stays JSONB):
--   OLD: companies.notification_prefs = { "<alert_type>": boolean }
--        (a bare boolean meant the IN-APP alert on/off; missing key = ON)
--   NEW: companies.notification_prefs = { "<alert_type>": { "app": boolean, "email": boolean } }
--        - app   gates the in-app Message Center alert (default ON)
--        - email gates whether a notification email is also sent
--          (default ON only for high-signal events: quote_accepted,
--           revision_requested, order_accepted, order_info_requested,
--           invoice_disputed; default OFF for everything else)
--
-- BACK-COMPAT: the application parser (app/lib/alerts/prefs.ts) reads BOTH
-- shapes — a bare boolean `v` is treated as { app: v, email: <event default> }.
-- A hard data migration is therefore NOT required and is intentionally
-- omitted here to avoid touching live rows: stored legacy values keep working
-- and are upgraded in-place the next time a company saves any toggle.
--
-- No-op DDL: the column already exists and its type is unchanged. This file
-- exists to DOCUMENT the shape change alongside the code that introduced it.
-- (users.email_notifications_enabled is retained for back-compat but is no
--  longer read/written — the per-event company-level email pref replaces it.)

COMMENT ON COLUMN companies.notification_prefs IS
  'Message Center per-event notification prefs. JSONB map: { "<alert_type>": { "app": bool, "email": bool } }. Missing key/sub-field falls back to defaults (app ON; email ON only for quote_accepted, revision_requested, order_accepted, order_info_requested, invoice_disputed). Legacy bare-boolean values are read as the app pref.';
