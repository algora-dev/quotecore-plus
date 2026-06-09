'use server';

import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import {
  NOTIFICATION_CHANNELS,
  ALL_NOTIFICATION_KEYS,
  resolvePrefs,
  type NotificationChannel,
} from '@/app/lib/alerts/prefs';

/**
 * Message Center settings (company-level) — the in-app notification matrix.
 *
 * `companies.notification_prefs` is a JSONB map `{ "<alert_type>": boolean }`;
 * a MISSING key means default-ON. These toggles gate ONLY in-app OWNER alert
 * creation (enforced via `alertEnabled` at each insertion site). Recipient-
 * facing status updates, activity logs and emails are unaffected.
 *
 * NOTE: this is distinct from the Account → Notifications "Email me when in-app
 * alerts fire" toggle (`updateEmailNotificationsEnabled`), which controls
 * email COPIES of alerts, not which alerts fire. That one is left untouched.
 */

type Result = { ok: true } | { ok: false; error: string };

/** Read the raw stored prefs JSONB for the current company. */
async function loadRawPrefs(): Promise<{ companyId: string; raw: unknown }> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('companies')
    .select('notification_prefs')
    .eq('id', profile.company_id)
    .maybeSingle();
  return { companyId: profile.company_id, raw: data?.notification_prefs };
}

/**
 * Returns the resolved matrix: every known alert_type with its effective
 * boolean (stored override, else default true).
 */
export async function getNotificationPrefs(): Promise<Record<string, boolean>> {
  const { raw } = await loadRawPrefs();
  return resolvePrefs(raw);
}

/** Persist the merged prefs map and keep notify_on_recipient_view in sync. */
async function writePrefs(
  companyId: string,
  merged: Record<string, boolean>,
): Promise<Result> {
  const supabase = await createSupabaseServerClient();
  // Keep the legacy single column roughly in sync for any old reader: ON when
  // ANY of the three Read toggles is on (the per-channel prefs are now
  // authoritative for actual alert gating).
  const anyReadOn =
    (merged.quote_viewed ?? true) ||
    (merged.order_viewed ?? true) ||
    (merged.invoice_viewed ?? true);
  const { error } = await supabase
    .from('companies')
    .update({ notification_prefs: merged, notify_on_recipient_view: anyReadOn })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Toggle a single event's alert on/off. */
export async function updateNotificationPref(
  alertType: string,
  enabled: boolean,
): Promise<Result> {
  if (!ALL_NOTIFICATION_KEYS.includes(alertType)) {
    return { ok: false, error: 'Unknown notification type' };
  }
  const { companyId, raw } = await loadRawPrefs();
  const merged = { ...resolvePrefs(raw), [alertType]: enabled };
  return writePrefs(companyId, merged);
}

/** Bulk set every event in a channel (the channel MASTER toggle). */
export async function updateChannelMaster(
  channel: NotificationChannel,
  enabled: boolean,
): Promise<Result> {
  const keys = NOTIFICATION_CHANNELS[channel];
  if (!keys) return { ok: false, error: 'Unknown channel' };
  const { companyId, raw } = await loadRawPrefs();
  const merged = { ...resolvePrefs(raw) };
  for (const key of keys) merged[key] = enabled;
  return writePrefs(companyId, merged);
}
