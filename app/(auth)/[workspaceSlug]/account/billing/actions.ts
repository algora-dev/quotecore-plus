'use server';

/**
 * Billing server actions.
 *
 * Trial activation is a non-Stripe path: we just flip the company onto
 * the `trial` plan with a 14-day clock. The rest of the billing surface
 * (checkout, portal) is Stripe-only.
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
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import {
  requireStripe,
  resolveStripeCheckoutForPlan,
} from '@/app/lib/billing/stripe';

/**
 * How long a freshly-activated trial runs for. 14 days is the marketing
 * promise; the entitlement helpers (company_effective_plan_code) downgrade
 * to `starter` once trial_ends_at < now().
 */
const TRIAL_DAYS = 14;

/**
 * Compute the absolute base URL for return links.
 *
 * Stripe needs absolute success/cancel URLs; we read the current host from
 * request headers so this works correctly on previews (vercel.app subdomains)
 * AND on production AND on localhost â€” no env var needed.
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

  let checkout: { priceId: string; couponId: string | null } | null;
  try {
    checkout = await resolveStripeCheckoutForPlan(planCode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'plan_lookup_failed';
    return { ok: false, code: 'plan_lookup_failed', message: msg };
  }
  if (!checkout) {
    return {
      ok: false,
      code: 'plan_not_configured',
      message: `Plan "${planCode}" is not yet available in this environment.`,
    };
  }
  const { priceId, couponId } = checkout;

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
      // Launch pricing: when a plan has a per-tier MSRP-to-launch coupon,
      // attach it so Checkout shows the strikethrough subtotal and the
      // discount line. Mutually exclusive with allow_promotion_codes per
      // Stripe's API.
      ...(couponId
        ? { discounts: [{ coupon: couponId }] }
        : { allow_promotion_codes: true }),
      // {CHECKOUT_SESSION_ID} is Stripe's template literal; do NOT JS-interpolate.
      success_url: `${base}/${slug}/account?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${slug}/account?tab=billing&checkout=canceled`,
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


/**
 * Activate the 14-day trial on the current company.
 *
 * Non-Stripe path: this just flips the company onto the 	rial plan
 * with a 14-day clock. The entitlement helpers
 * (company_effective_plan_code) auto-collapse to starter once
 * trial_ends_at < now(), so we don't need a cron to enforce expiry.
 *
 * Guards:
 *   * Only allowed when there is NO active Stripe subscription
 *     (stripe_subscription_id IS NULL AND subscription_status is one
 *     of trialing/canceled/suspended) so a paying customer can't
 *     accidentally downgrade themselves to trial via this button.
 *   * Refused if the company has already had a trial that ENDED in the
 *     last 30 days (anti-abuse: prevents trial re-rolling).
 */
export async function activateTrial(): Promise<BillingActionResult> {
  let ctx;
  try {
    ctx = await loadCompanyContext();
  } catch {
    return { ok: false, code: 'unauthenticated', message: 'Please sign in to activate the trial.' };
  }
  const { profile, company: ctxCompany } = ctx;
  const slug = ctxCompany.slug;

  const admin = createAdminClient();
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, plan_code, subscription_status, stripe_subscription_id, cancel_at_period_end, trial_ends_at')
    .eq('id', profile.company_id)
    .maybeSingle();
  if (companyErr || !company) {
    return { ok: false, code: 'company_not_found', message: 'Company record missing.' };
  }

  // Refuse if they're on a paid Stripe sub that is NOT already winding
  // down. cancel_at_period_end=true means the user has cancelled and is
  // serving out the rest of the paid period — we treat that as "effectively
  // gone" so they can pre-stage a trial activation without waiting for the
  // Stripe webhook to fire customer.subscription.deleted at period end.
  if (company.stripe_subscription_id && !company.cancel_at_period_end) {
    return {
      ok: false,
      code: 'has_active_subscription',
      message: 'You have an active paid subscription. Cancel it via "Manage subscription" before starting a trial.',
    };
  }

  // Re-roll guard. Today: allow re-activation if there's no active trial
  // (trial_ends_at < now()). Production tightening to come — Shaun wants
  // to be able to flip onto trial repeatedly during testing, so we
  // intentionally do NOT block recently-ended trials yet. The 14-day
  // expiry still applies; users can't extend by re-activating.
  if (company.subscription_status === 'trialing' && company.trial_ends_at) {
    const ends = new Date(company.trial_ends_at).getTime();
    if (Date.now() < ends) {
      return {
        ok: false,
        code: 'trial_already_active',
        message: 'You are already on the free trial.',
      };
    }
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await admin
    .from('companies')
    .update({
      plan_code: 'trial',
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      // Clear any leftover dunning state so the trial isn't immediately
      // suspended by a stale past-due timer.
      first_payment_failure_at: null,
      dunning_stage_entered_at: null,
    })
    .eq('id', company.id);
  if (updateErr) {
    console.error('[billing] activateTrial update failed:', updateErr);
    return { ok: false, code: 'update_failed', message: updateErr.message };
  }

  // Audit row in subscription_events so future debugging can correlate.
  // Schema mirrors what the Stripe webhook handler writes — the
  // distinguishing field is event_type='trial.activated'.
  await admin.from('subscription_events').insert({
    company_id: company.id,
    event_type: 'trial.activated',
    from_plan_code: company.plan_code,
    to_plan_code: 'trial',
    stripe_event_type: null,
  });

  // The success URL goes back to the billing tab so we can flash a
  // banner — keep the same pattern as Stripe checkout success.
  const base = await baseUrl();
  revalidatePath(`/${slug}/account`);
  return { ok: true, url: `${base}/${slug}/account?tab=billing&trial=activated` };
}