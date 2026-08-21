import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Central resolution for the admin-signups API key and the unsubscribe HMAC
 * secret, backed by the Supabase `app_runtime_config` table so they can be
 * rotated/fixed with SQL (no Vercel env re-paste, no desync between what is
 * deployed and what agents hold). Env vars remain as a fallback only.
 *
 * Keys:
 *   admin_signups_api_key   - bearer key Barry uses for /api/admin/signups
 *                             and /api/admin/unsubscribe-link. Rotating it
 *                             does NOT affect unsubscribe links.
 *   unsubscribe_hmac_secret - signs/verifies unsubscribe tokens. Deliberately
 *                             NEVER rotate: every rotation invalidates every
 *                             link ever sent.
 */

interface CacheEntry {
  value: string | null;
  fetchedAt: number;
}

let cache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 60_000;

async function getConfigValue(key: string): Promise<string | null> {
  const hit = cache[key];
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.value;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('app_runtime_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    const value = error ? null : data?.value ?? null;
    cache[key] = { value: value ?? process.env.ADMIN_SIGNUPS_API_KEY ?? null, fetchedAt: Date.now() };
    return cache[key].value;
  } catch {
    cache[key] = { value: process.env.ADMIN_SIGNUPS_API_KEY ?? null, fetchedAt: Date.now() };
    return cache[key].value;
  }
}

/** Bearer key for the admin signups feed + unsubscribe-link generator. */
export function getAdminSignupsApiKey(): Promise<string | null> {
  return getConfigValue('admin_signups_api_key');
}

/** Long-lived secret for signing unsubscribe tokens. Never rotate. */
export function getUnsubscribeHmacSecret(): Promise<string | null> {
  return getConfigValue('unsubscribe_hmac_secret');
}
