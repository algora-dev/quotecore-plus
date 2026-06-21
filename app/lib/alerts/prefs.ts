import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

/**
 * Message Center - notification preferences (the Settings matrix).
 *
 * `companies.notification_prefs` is a JSONB map keyed by `alert_type`. Each
 * value records BOTH delivery surfaces for that event:
 *   `{ "<alert_type>": { "app": boolean, "email": boolean } }`
 *
 * - `app`   = create the in-app Message Center alert (gates alert insertion).
 * - `email` = also send a notification email to the company alert recipients.
 *
 * A MISSING key - or a missing sub-field - falls back to defaults:
 *   - app   defaults ON for every event.
 *   - email defaults ON only for the high-signal events in EMAIL_DEFAULTS,
 *     and OFF for everything else.
 *
 * BACK-COMPAT: earlier versions stored a BARE BOOLEAN per key meaning the
 * in-app on/off state. When parsing we treat a boolean `v` as
 * `{ app: v, email: <email default for that key> }`, so old companies keep
 * their in-app choices and pick up sensible email defaults with no migration.
 *
 * IMPORTANT: these toggles gate ONLY notification DELIVERY. Status updates
 * (viewed_at, accepted_at, invoice status, activity logs, lifecycle stamps)
 * always happen regardless of either toggle.
 */

/** The complete, real alert-type taxonomy surfaced in the Settings matrix. */
export const NOTIFICATION_CHANNELS = {
  quotes: ['quote_accepted', 'quote_declined', 'revision_requested', 'quote_viewed', 'quote_expired'],
  orders: ['order_accepted', 'order_declined', 'order_info_requested', 'order_viewed'],
  invoices: ['invoice_payment_reported', 'invoice_disputed', 'invoice_viewed'],
} as const;

export type NotificationChannel = keyof typeof NOTIFICATION_CHANNELS;

/** Which delivery surface a pref controls. */
export type PrefSurface = 'app' | 'email';

/** Per-event preference: one boolean per delivery surface. */
export type EventPref = { app: boolean; email: boolean };

/** Flat list of every known alert_type that the matrix controls. */
export const ALL_NOTIFICATION_KEYS: string[] = Object.values(NOTIFICATION_CHANNELS).flat();

/**
 * EMAIL default-ON set - only the high-signal events email by default.
 * Everything else (declines, "viewed/read" events, payment-reported) defaults
 * OFF for email to keep inbox volume sane. In-app always defaults ON.
 */
export const EMAIL_ON_BY_DEFAULT: ReadonlySet<string> = new Set([
  'quote_accepted',
  'quote_expired',
  'revision_requested',
  'order_accepted',
  'order_info_requested',
  'invoice_disputed',
]);

/** The default EMAIL value for a given alert_type (false for unknown keys). */
export function emailDefault(alertType: string): boolean {
  return EMAIL_ON_BY_DEFAULT.has(alertType);
}

/** Anything Supabase-ish with a usable `.from()`. Admin or server client. */
type AnyClient = SupabaseClient<Database>;

/**
 * Parse the raw JSONB value into `{ [alertType]: { app, email } }`, handling
 * BOTH the new object shape and the legacy bare-boolean shape. Only the
 * explicitly stored sub-fields are filled in here; defaults are applied by
 * `resolvePrefs` / the `*AlertEnabled` helpers, so the distinction between
 * "stored" and "defaulted" survives a round-trip and we never persist noise.
 */
function asPrefMap(raw: unknown): Record<string, Partial<EventPref>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Partial<EventPref>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') {
      // Legacy shape: bare boolean was the in-app pref. Email picks up its
      // default (we don't know the old email intent - there wasn't one).
      out[k] = { app: v };
    } else if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      const entry: Partial<EventPref> = {};
      if (typeof obj.app === 'boolean') entry.app = obj.app;
      if (typeof obj.email === 'boolean') entry.email = obj.email;
      out[k] = entry;
    }
  }
  return out;
}

/**
 * Returns whether the company wants an IN-APP alert created for `alertType`.
 * Missing -> default ON (true). This is the guard every owner-alert insertion
 * site calls before inserting into `alerts`.
 */
export async function alertEnabled(
  client: AnyClient,
  companyId: string,
  alertType: string,
): Promise<boolean> {
  const { data } = await client
    .from('companies')
    .select('notification_prefs')
    .eq('id', companyId)
    .maybeSingle();
  const prefs = asPrefMap(data?.notification_prefs);
  return prefs[alertType]?.app ?? true;
}

/**
 * Returns whether the company wants an EMAIL sent for `alertType`.
 * Missing -> per-event default (EMAIL_ON_BY_DEFAULT). This gates ONLY the
 * email send; the in-app alert is gated independently by `alertEnabled`.
 */
export async function emailAlertEnabled(
  client: AnyClient,
  companyId: string,
  alertType: string,
): Promise<boolean> {
  const { data } = await client
    .from('companies')
    .select('notification_prefs')
    .eq('id', companyId)
    .maybeSingle();
  const prefs = asPrefMap(data?.notification_prefs);
  return prefs[alertType]?.email ?? emailDefault(alertType);
}

/**
 * Resolve the full matrix for the UI: every known key with its EFFECTIVE
 * `{ app, email }` (stored override, else defaults). Pass the already-fetched
 * raw JSONB to avoid a second round-trip.
 */
export function resolvePrefs(raw: unknown): Record<string, EventPref> {
  const stored = asPrefMap(raw);
  const resolved: Record<string, EventPref> = {};
  for (const key of ALL_NOTIFICATION_KEYS) {
    resolved[key] = {
      app: stored[key]?.app ?? true,
      email: stored[key]?.email ?? emailDefault(key),
    };
  }
  return resolved;
}
