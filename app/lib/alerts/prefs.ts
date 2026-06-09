import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

/**
 * Message Center — in-app notification preferences (the Settings matrix).
 *
 * `companies.notification_prefs` is a JSONB map of `{ "<alert_type>": boolean }`.
 * A MISSING key means default-ON (true) — we only ever persist explicit
 * overrides, so a fresh company (`{}`) has every alert enabled. This module is
 * the single source of truth for that semantics; it is imported both by the
 * owner-alert insertion sites (to GATE alert creation) and by the inbox
 * settings server actions (to read/resolve the matrix for the UI).
 *
 * IMPORTANT: these toggles gate ONLY the in-app OWNER alert insertion. Status
 * updates (viewed_at, accepted_at, invoice status, activity logs, emails) must
 * still happen regardless of the toggle.
 */

/** The complete, real alert-type taxonomy surfaced in the Settings matrix. */
export const NOTIFICATION_CHANNELS = {
  quotes: ['quote_accepted', 'quote_declined', 'revision_requested', 'quote_viewed'],
  orders: ['order_accepted', 'order_declined', 'order_info_requested', 'order_viewed'],
  invoices: ['invoice_payment_reported', 'invoice_disputed', 'invoice_viewed'],
} as const;

export type NotificationChannel = keyof typeof NOTIFICATION_CHANNELS;

/** Flat list of every known alert_type that the matrix controls. */
export const ALL_NOTIFICATION_KEYS: string[] = Object.values(NOTIFICATION_CHANNELS).flat();

/** Anything Supabase-ish with a usable `.from()`. Admin or server client. */
type AnyClient = SupabaseClient<Database>;

/** Parse the raw JSONB value into a plain `{ [alertType]: boolean }` map. */
function asPrefMap(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * Returns whether the company wants an in-app alert created for `alertType`.
 * Missing key -> default ON (true). This is the ONE guard every owner-alert
 * insertion site calls before inserting into `alerts`.
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
  return prefs[alertType] ?? true;
}

/**
 * Resolve the full matrix for the UI: every known key with its EFFECTIVE
 * boolean (stored override, else default true). Pass the already-fetched raw
 * JSONB to avoid a second round-trip.
 */
export function resolvePrefs(raw: unknown): Record<string, boolean> {
  const stored = asPrefMap(raw);
  const resolved: Record<string, boolean> = {};
  for (const key of ALL_NOTIFICATION_KEYS) {
    resolved[key] = stored[key] ?? true;
  }
  return resolved;
}
