/**
 * Stripe client + helpers.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * Single source of truth for:
 *   - the Stripe SDK instance (one per server process; safe to import anywhere)
 *   - the live vs test mode resolver (which key set + which price IDs we use)
 *   - the Stripe Price ID -> internal plan_code mapping (allowlisted)
 *
 * No business logic lives here. State transitions are in
 * `app/api/webhooks/stripe/route.ts` and the cron handlers; this module is
 * pure plumbing.
 *
 * ---------------------------------------------------------------------------
 * Live vs test mode
 * ---------------------------------------------------------------------------
 * We use STRIPE_MODE (explicit) as the primary toggle; if unset we fall
 * back to checking whether STRIPE_SECRET_KEY starts with `sk_live_`. This
 * lets us run test mode on the dev Vercel project AND on local laptops
 * without a separate switch, and flip to live mode on the main project
 * with a single env var change.
 *
 * The plan -> Price ID resolver reads either `stripe_price_id_live` or
 * `stripe_price_id_test` from `subscription_plans` based on this mode.
 * That column is nullable; until the corresponding mode's prices are
 * created in the Stripe dashboard, Checkout will refuse with a typed error
 * so we don't silently start charging the wrong currency / amount.
 *
 * ---------------------------------------------------------------------------
 * Price ID allowlist (M-05 / brief §11)
 * ---------------------------------------------------------------------------
 * The webhook handler MUST NOT trust a Stripe subscription's price ID
 * blindly. A malicious or misconfigured webhook delivery could reference
 * a Price ID we don't recognise. `resolvePlanCodeForStripePrice()` looks
 * up the active mode's column on `subscription_plans` and returns null
 * if the Price ID isn't allowlisted. The webhook then writes a
 * `webhook_deliveries` row with `processing_result='error:unknown_price'`
 * and returns 200 (so Stripe stops retrying) without mutating company state.
 */

import 'server-only';

import Stripe from 'stripe';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Resolves the active Stripe mode for this process.
 *
 * Order of precedence:
 *   1. `STRIPE_MODE` env var ('live' | 'test') if explicitly set.
 *   2. Sniff `STRIPE_SECRET_KEY` prefix (sk_live_ -> live, sk_test_ -> test).
 *   3. Default 'test' to fail-safe in development.
 */
export function getStripeMode(): 'live' | 'test' {
  const explicit = (process.env.STRIPE_MODE ?? '').toLowerCase();
  if (explicit === 'live' || explicit === 'test') return explicit;
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (key.startsWith('sk_live_')) return 'live';
  return 'test';
}

/**
 * Lazily-initialised Stripe SDK instance. Cached at module scope so
 * subsequent imports reuse the same instance (Stripe internally maintains
 * its own pool of HTTPS keepalive sockets).
 *
 * We do NOT throw at import time if STRIPE_SECRET_KEY is missing \u2014 that
 * would crash unrelated routes (e.g. /health) on a fresh deploy where
 * the env var hasn't been added yet. Instead each callsite goes through
 * `requireStripe()` which throws a clear error.
 */
let _stripe: Stripe | null = null;

export function getStripeOrNull(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key, {
    // Pin the API version we developed against. Match the SDK's default
    // (currently 2026-04-22.dahlia); bump explicitly when we upgrade the SDK.
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    appInfo: { name: 'QuoteCore+', version: '0.1.0' },
  });
  return _stripe;
}

/**
 * Same as getStripeOrNull but throws a clear error if not configured.
 * Use this in code paths that genuinely need Stripe to be live (Checkout,
 * Portal, webhook handler). Read-only paths that only render the current
 * plan from our DB should NOT need Stripe at all and shouldn't call this.
 */
export function requireStripe(): Stripe {
  const s = getStripeOrNull();
  if (!s) {
    throw new Error(
      'Stripe is not configured: set STRIPE_SECRET_KEY in this environment.',
    );
  }
  return s;
}

/**
 * Returns the column name on `subscription_plans` that holds Price IDs
 * for the current mode. Used by the resolver below.
 */
export function priceIdColumn(): 'stripe_price_id_live' | 'stripe_price_id_test' {
  return getStripeMode() === 'live' ? 'stripe_price_id_live' : 'stripe_price_id_test';
}

/**
 * Resolve a Stripe Price ID to one of our internal plan codes by looking
 * it up on `subscription_plans`. Returns null if the Price ID is not in
 * the allowlist for the current mode.
 *
 * The webhook handler uses this to decide whether to apply a state
 * transition (allowlisted = yes; unknown = log and ignore).
 */
export async function resolvePlanCodeForStripePrice(
  stripePriceId: string,
): Promise<string | null> {
  if (!stripePriceId) return null;
  const admin = createAdminClient();
  const column = priceIdColumn();
  const { data, error } = await admin
    .from('subscription_plans')
    .select('code')
    .eq(column, stripePriceId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[stripe] resolvePlanCodeForStripePrice query failed:', error);
    return null;
  }
  return data?.code ?? null;
}

/**
 * Inverse direction: given an internal plan code, return the Stripe Price
 * ID we should send the user to Checkout for. Returns null if the plan is
 * not yet wired up to Stripe in the current mode.
 *
 * Throws if the plan code itself doesn't exist (programmer error).
 */
export async function resolveStripePriceForPlan(
  planCode: string,
): Promise<string | null> {
  if (!planCode) throw new Error('resolveStripePriceForPlan: planCode is required');
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('subscription_plans')
    .select('stripe_price_id_live, stripe_price_id_test, active')
    .eq('code', planCode)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`resolveStripePriceForPlan: ${error.message}`);
  if (!data) throw new Error(`resolveStripePriceForPlan: plan "${planCode}" not found`);
  if (!data.active) return null;
  return getStripeMode() === 'live' ? data.stripe_price_id_live : data.stripe_price_id_test;
}

/**
 * Map a Stripe subscription status string onto our internal lifecycle
 * status. We deliberately collapse some Stripe states because our state
 * machine is coarser than Stripe's:
 *
 *   Stripe              ->  Our subscription_status
 *   ----------------       ----------------------
 *   trialing            ->  trialing
 *   active              ->  active
 *   past_due            ->  past_due
 *   unpaid              ->  past_due  (we treat unpaid as past_due; dunning
 *                                       cron decides when to escalate)
 *   incomplete          ->  past_due  (checkout payment failed; user can
 *                                       still retry)
 *   incomplete_expired  ->  canceled
 *   canceled            ->  canceled
 *   paused              ->  active    (Stripe-side pause keeps service)
 *
 * Note: this is the LIFECYCLE state only. Grace / pending_data_purge /
 * suspended come from OUR dunning cron, not from Stripe directly.
 */
export function stripeStatusToInternal(
  stripeStatus: Stripe.Subscription.Status,
):
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled' {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
    case 'paused':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'past_due';
    case 'incomplete_expired':
    case 'canceled':
      return 'canceled';
    default:
      // Future Stripe states we don't yet recognise: keep account in the
      // safest state (past_due) so the dunning cron can decide. Logged so
      // we notice and update the map.
      console.warn('[stripe] unknown subscription status mapped to past_due:', stripeStatus);
      return 'past_due';
  }
}
