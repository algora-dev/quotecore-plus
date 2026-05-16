'use server';

/**
 * Billing server actions.
 *
 * Two entry points: createCheckoutSession (new subscription / plan change
 * for non-customers) and createCustomerPortalSession (existing customers
 * manage cards, invoices, cancel, switch plan). We deliberately keep both
 * thin — all real state changes happen via Stripe webhooks. These actions
 * only mint URLs.
 *
 * Both actions require an authenticated user with a company context. Both
 * verify the company exists before contacting Stripe so we don't burn a
 * Stripe API call on garbage input.
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import {
  requireStripe,
  resolveStripePriceForPlan,
} from '@/app/lib/billing/stripe';

/**
 * Compute the absolute base URL for return links.
 *
 * Stripe needs absolute success/cancel URLs; we read the current host from
 * request headers so this works correctly on previews (vercel.app subdomains)
 * AND on production AND on localhost — no env var needed.
 */
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (!host) throw new Error('billing actions: cannot determine request host');
  return `${proto}://${host}`;
}

export type BillingActionResult =
  | { ok: true; url: string }
  | { ok: false; code: string; message: string };

/**
 * Returns the Stripe-hosted Checkout URL for a plan upgrade.
 *
 * Flow:
 *   1. Resolve plan code -> Stripe Price ID (allowlist check).
 *   2. Mint a Checkout Session with mode='subscription',
 *      client_reference_id=company_id, customer (if we have one already)
 *      or customer_email for first-timers.
 *   3. Return the session URL; the page redirects to it.
 *
 * On success the user lands back at /<slug>/account?tab=billing&checkout=success.
 * On cancel they bounce to the same URL with checkout=canceled.
 *
 * State changes happen via the `customer.subscription.created` webhook
 * that fires moments after Checkout completes; this action does NOT write
 * to companies.* directly.
 */
export async function createCheckoutSession(
  planCode: string,
): Promise<BillingActionResult> {
  if (!planCode) {
    return { ok: false, code: 'missing_plan', message: 'A plan must be selected.' };
  }

  let ctx;
  try {
    ctx = await loadCompanyContext();
  } catch {
    return { ok: false, code: 'unauthenticated', message: 'Please sign in to manage billing.' };
  }
  const { profile, company: ctxCompany } = ctx;
  const slug = ctxCompany.slug;

  let priceId: string | null;
  try {
    priceId = await resolveStripePriceForPlan(planCode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'plan_lookup_failed';
    return { ok: false, code: 'plan_lookup_failed', message: msg };
  }
  if (!priceId) {
    return {
      ok: false,
      code: 'plan_not_configured',
      message: `Plan "${planCode}" is not yet available in this environment.`,
    };
  }

  const stripe = requireStripe();
  const admin = createAdminClient();

  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, stripe_customer_id')
    .eq('id', profile.company_id)
    .maybeSingle();
  if (companyErr || !company) {
    return { ok: false, code: 'company_not_found', message: 'Company record missing.' };
  }

  const { data: userRow } = await admin
    .from('users')
    .select('email')
    .eq('id', profile.id)
    .maybeSingle();

  const base = await baseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Anchor: ties this Checkout back to OUR company id. The webhook
      // reads this to associate the new Stripe customer with the company.
      client_reference_id: company.id,
      subscription_data: {
        metadata: {
          company_id: company.id,
          plan_code: planCode,
        },
      },
      ...(company.stripe_customer_id
        ? { customer: company.stripe_customer_id }
        : { customer_email: userRow?.email ?? undefined }),
      // {CHECKOUT_SESSION_ID} is Stripe's template literal; do NOT JS-interpolate.
      success_url: `${base}/${slug}/account?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${slug}/account?tab=billing&checkout=canceled`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return { ok: false, code: 'no_session_url', message: 'Stripe did not return a Checkout URL.' };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'stripe_checkout_failed';
    console.error('[billing] createCheckoutSession failed:', msg);
    return { ok: false, code: 'stripe_error', message: msg };
  }
}

/**
 * Returns the Stripe-hosted Customer Portal URL for an existing subscriber.
 *
 * The portal handles plan switches, card updates, invoice history, and
 * cancellation. We pass the company's stripe_customer_id; Stripe rejects
 * the call if the id doesn't exist or doesn't have an active subscription.
 *
 * On return Stripe sends the user back to /<slug>/account?tab=billing.
 */
export async function createCustomerPortalSession(): Promise<BillingActionResult> {
  let ctx;
  try {
    ctx = await loadCompanyContext();
  } catch {
    return { ok: false, code: 'unauthenticated', message: 'Please sign in to manage billing.' };
  }
  const { profile, company: ctxCompany } = ctx;
  const slug = ctxCompany.slug;

  const admin = createAdminClient();
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, stripe_customer_id')
    .eq('id', profile.company_id)
    .maybeSingle();
  if (companyErr || !company) {
    return { ok: false, code: 'company_not_found', message: 'Company record missing.' };
  }
  if (!company.stripe_customer_id) {
    return {
      ok: false,
      code: 'no_stripe_customer',
      message: 'No billing record yet. Subscribe first to manage your subscription.',
    };
  }

  const stripe = requireStripe();
  const base = await baseUrl();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: `${base}/${slug}/account?tab=billing`,
    });
    return { ok: true, url: session.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'stripe_portal_failed';
    console.error('[billing] createCustomerPortalSession failed:', msg);
    return { ok: false, code: 'stripe_error', message: msg };
  }
}
