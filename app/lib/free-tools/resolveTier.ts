/**
 * Server-side tier resolution for free tools API routes.
 *
 * Verifies the free-tools Supabase access token (if supplied) and checks
 * whether the user's email also has a QuoteCore+ app account. Never trusts
 * client-declared tier — the token is the only input.
 */

import { createClient } from '@supabase/supabase-js';
import { TIER_LIMITS, type FreeToolsTier } from './tiers';

const FREE_URL = process.env.NEXT_PUBLIC_FREE_SUPABASE_URL;
const FREE_ANON = process.env.NEXT_PUBLIC_FREE_SUPABASE_ANON_KEY;
const APP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const APP_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface ResolvedTier {
  tier: FreeToolsTier;
  userId: string | null;
  email: string | null;
  hasAppAccount: boolean;
  limits: (typeof TIER_LIMITS)[FreeToolsTier];
}

const ANON_RESULT: ResolvedTier = {
  tier: 1,
  userId: null,
  email: null,
  hasAppAccount: false,
  limits: TIER_LIMITS[1],
};

/**
 * Resolve the caller's tier from an optional `Authorization: Bearer <jwt>`
 * header value (the free-tools Supabase access token).
 *
 * - No/invalid token → tier 1 (anonymous)
 * - Valid free-tools user → tier 2
 * - Valid free-tools user whose email exists in the app's users table → tier 3
 */
export async function resolveFreeToolsTier(
  authHeader: string | null
): Promise<ResolvedTier> {
  if (!authHeader?.startsWith('Bearer ') || !FREE_URL || !FREE_ANON) {
    return ANON_RESULT;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return ANON_RESULT;

  try {
    const freeClient = createClient(FREE_URL, FREE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await freeClient.auth.getUser(token);
    if (error || !data.user?.email) return ANON_RESULT;

    const email = data.user.email.toLowerCase();
    const userId = data.user.id;

    // Tier 3 check: does this email have a QuoteCore+ app account?
    let hasAppAccount = false;
    if (APP_URL && APP_SERVICE) {
      try {
        const appClient = createClient(APP_URL, APP_SERVICE, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: appUser } = await appClient
          .from('users')
          .select('id')
          .ilike('email', email)
          .maybeSingle();
        hasAppAccount = !!appUser;
      } catch {
        // App lookup failure downgrades to tier 2 rather than failing the request
        hasAppAccount = false;
      }
    }

    const tier: FreeToolsTier = hasAppAccount ? 3 : 2;
    return { tier, userId, email, hasAppAccount, limits: TIER_LIMITS[tier] };
  } catch {
    return ANON_RESULT;
  }
}
