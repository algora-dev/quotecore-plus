/**
 * Server-side tier resolution for free tools API routes.
 *
 * UNIFIED AUTH (2026-07-14): free tools authenticate against the MAIN app
 * Supabase project. Tiers are derived from the app's own tables:
 *
 *   Tier 1 — no/invalid token (anonymous)
 *   Tier 2 — valid auth user, but no app profile OR company onboarding
 *            not completed yet
 *   Tier 3 — valid auth user with a company whose onboarding_completed_at
 *            is set (fully onboarded app account)
 *
 * Never trusts client-declared tier — the JWT is the only input.
 */

import { createClient } from '@supabase/supabase-js';
import { TIER_LIMITS, type FreeToolsTier } from './tiers';

const APP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const APP_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface ResolvedTier {
  tier: FreeToolsTier;
  userId: string | null;
  email: string | null;
  /** True only when the user has a fully onboarded app account (tier 3). */
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
 * header value (a main-project Supabase access token).
 */
export async function resolveFreeToolsTier(
  authHeader: string | null
): Promise<ResolvedTier> {
  if (!authHeader?.startsWith('Bearer ') || !APP_URL || !APP_ANON) {
    return ANON_RESULT;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return ANON_RESULT;

  try {
    const anonClient = createClient(APP_URL, APP_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anonClient.auth.getUser(token);
    if (error || !data.user) return ANON_RESULT;

    const userId = data.user.id;
    const email = data.user.email?.toLowerCase() ?? null;

    // Tier 3 check: profile row -> company -> onboarding completed?
    // Service role is used because free-tools callers may not have RLS
    // visibility into companies. Failure degrades to tier 2, never blocks.
    let onboarded = false;
    if (APP_SERVICE) {
      try {
        const admin = createClient(APP_URL, APP_SERVICE, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: profile } = await admin
          .from('users')
          .select('company_id, companies!inner(onboarding_completed_at)')
          .eq('id', userId)
          .maybeSingle();
        const company = (profile as { companies?: { onboarding_completed_at: string | null } } | null)?.companies;
        onboarded = !!company?.onboarding_completed_at;
      } catch {
        onboarded = false;
      }
    }

    const tier: FreeToolsTier = onboarded ? 3 : 2;
    return { tier, userId, email, hasAppAccount: onboarded, limits: TIER_LIMITS[tier] };
  } catch {
    return ANON_RESULT;
  }
}
