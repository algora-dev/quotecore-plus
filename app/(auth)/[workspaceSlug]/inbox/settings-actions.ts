'use server';

import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import {
  NOTIFICATION_CHANNELS,
  ALL_NOTIFICATION_KEYS,
  resolvePrefs,
  type NotificationChannel,
  type PrefSurface,
  type EventPref,
} from '@/app/lib/alerts/prefs';

/**
 * Message Center settings (company-level) — the notification matrix.
 *
 * `companies.notification_prefs` is a JSONB map
 * `{ "<alert_type>": { "app": boolean, "email": boolean } }`; a MISSING key (or
 * sub-field) falls back to defaults (app ON, email per EMAIL_ON_BY_DEFAULT).
 * The `app` surface gates in-app OWNER alert creation; the `email` surface
 * gates whether a notification email is also sent. Recipient-facing status
 * updates, activity logs and lifecycle stamps are unaffected by either.
 *
 * This is now the SINGLE place email alerts are configured — the old
 * Account → Notifications per-user master has been removed.
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
 * `{ app, email }` (stored override, else defaults).
 */
export async function getNotificationPrefs(): Promise<Record<string, EventPref>> {
  const { raw } = await loadRawPrefs();
  return resolvePrefs(raw);
}

/** Persist the merged prefs map and keep notify_on_recipient_view in sync. */
async function writePrefs(
  companyId: string,
  merged: Record<string, EventPref>,
): Promise<Result> {
  const supabase = await createSupabaseServerClient();
  // Keep the legacy single column roughly in sync for any old reader: ON when
  // ANY of the three in-app Read toggles is on (the per-event prefs are now
  // authoritative for actual alert gating). Based on the APP surface only,
  // matching its historic meaning.
  const anyReadOn =
    (merged.quote_viewed?.app ?? true) ||
    (merged.order_viewed?.app ?? true) ||
    (merged.invoice_viewed?.app ?? true);
  const { error } = await supabase
    .from('companies')
    .update({ notification_prefs: merged, notify_on_recipient_view: anyReadOn })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Toggle a single event's surface (in-app OR email) on/off. */
export async function updateNotificationPref(
  alertType: string,
  surface: PrefSurface,
  enabled: boolean,
): Promise<Result> {
  if (!ALL_NOTIFICATION_KEYS.includes(alertType)) {
    return { ok: false, error: 'Unknown notification type' };
  }
  if (surface !== 'app' && surface !== 'email') {
    return { ok: false, error: 'Unknown surface' };
  }
  const { companyId, raw } = await loadRawPrefs();
  const resolved = resolvePrefs(raw);
  const merged = {
    ...resolved,
    [alertType]: { ...resolved[alertType], [surface]: enabled },
  };
  return writePrefs(companyId, merged);
}

/**
 * Bulk set one SURFACE for every event in a channel (the channel MASTER).
 * Each surface (in-app / email) has its own master so they toggle
 * independently.
 */
export async function updateChannelMaster(
  channel: NotificationChannel,
  surface: PrefSurface,
  enabled: boolean,
): Promise<Result> {
  const keys = NOTIFICATION_CHANNELS[channel];
  if (!keys) return { ok: false, error: 'Unknown channel' };
  if (surface !== 'app' && surface !== 'email') {
    return { ok: false, error: 'Unknown surface' };
  }
  const { companyId, raw } = await loadRawPrefs();
  const resolved = resolvePrefs(raw);
  const merged: Record<string, EventPref> = { ...resolved };
  for (const key of keys) {
    merged[key] = { ...resolved[key], [surface]: enabled };
  }
  return writePrefs(companyId, merged);
}
