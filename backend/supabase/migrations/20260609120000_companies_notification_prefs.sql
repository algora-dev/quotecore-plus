-- Message Center notification matrix: per-channel / per-event in-app alert prefs.
-- Shape: { "<alert_type>": boolean, ... }. A MISSING key means default-ON (true);
-- only explicit overrides are stored. Backward-compat: notify_on_recipient_view
-- column is kept, but the per-channel Read toggles (quote_viewed/order_viewed/
-- invoice_viewed) inside notification_prefs are now authoritative for Read alerts.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
