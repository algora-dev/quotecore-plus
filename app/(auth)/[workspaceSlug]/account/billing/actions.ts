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
 * thin - all real state changes happen via Stripe webhooks. These actions
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

  let checkout: { priceId: string } | null;
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
  const { priceId } = checkout;

  const stripe = requireStripe();
  const admin = createAdminClient();

  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, stripe_customer_id, stripe_subscription_id, subscription_status, cancel_at_period_end, cancel_at')
    .eq('id', profile.company_id)
    .maybeSingle();
  if (companyErr || !company) {
    return { ok: false, code: 'company_not_found', message: 'Company record missing.' };
  }

  // Gerald audit H-02: prevent duplicate-subscription Checkout. If the
  // company already has a Stripe subscription that isn't in a final
  // terminal state, route them through the Customer Portal instead so
  // Stripe handles proration/replacement. Treat cancel_at_period_end /
  // future cancel_at as STILL ACTIVE - the sub is winding down but not
  // yet replaced; a fresh Checkout would create a second concurrent sub.
  // Only `canceled` (Stripe has sent customer.subscription.deleted) or
  // `suspended` (we've stopped charging entirely) are safe to bypass.
  const TERMINAL_STATUSES = new Set(['canceled', 'suspended']);
  if (
    company.stripe_subscription_id &&
    !TERMINAL_STATUSES.has(company.subscription_status)
  ) {
    return {
      ok: false,
      code: 'subscription_exists',
      message:
        'You already have an active subscription. Use Manage Subscription to change plans, update payment, or cancel.',
    };
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
      // No coupon scheme: the Price IS the deal price. Allow manual promo
      // codes (e.g. one-off offers you create in the Stripe dashboard).
      allow_promotion_codes: true,
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
 * IN-APP plan change for an EXISTING active subscriber (no Stripe Portal,
 * no second subscription). This is the upgrade/downgrade path that replaces
 * routing the user to the cancel-only Customer Portal.
 *
 *   - UPGRADE (higher sort_order): swap the subscription item to the target
 *     plan's (already launch-discounted) Price, prorate the difference, and
 *     charge immediately. Effective right away.
 *   - DOWNGRADE (lower sort_order): schedule the price change for the END of
 *     the current period via a Subscription Schedule, so the customer keeps
 *     the higher tier they already paid for until the period rolls over.
 *     No immediate charge or credit.
 *
 * State changes are persisted by the `customer.subscription.updated` webhook
 * (LIVE STATE FETCH invariant), exactly like Checkout - this action does NOT
 * write companies.* directly. It only drives Stripe; the webhook reconciles.
 *
 * Defence-in-depth: target must be an active, Stripe-priced plan in the
 * current mode; trial is never a valid target here; the company must have a
 * real active subscription (not winding down / canceled).
 */
export async function changePlan(
  targetPlanCode: string,
): Promise<BillingActionResult> {
  if (!targetPlanCode || targetPlanCode === 'trial') {
    return { ok: false, code: 'invalid_target', message: 'Pick a paid plan to switch to.' };
  }

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
    .select('id, plan_code, subscription_status, stripe_subscription_id, cancel_at_period_end, cancel_at')
    .eq('id', profile.company_id)
    .maybeSingle();
  if (companyErr || !company) {
    return { ok: false, code: 'company_not_found', message: 'Company record missing.' };
  }

  // Must have a real, non-winding-down subscription to modify.
  const windingDown =
    company.cancel_at_period_end ||
    (company.cancel_at != null && new Date(company.cancel_at).getTime() > Date.now());
  const TERMINAL = new Set(['canceled', 'suspended']);
  if (
    !company.stripe_subscription_id ||
    TERMINAL.has(company.subscription_status) ||
    windingDown
  ) {
    return {
      ok: false,
      code: 'no_active_subscription',
      message: 'No active subscription to change. Choose a plan to subscribe first.',
    };
  }

  if (targetPlanCode === company.plan_code) {
    return { ok: false, code: 'already_on_plan', message: 'You are already on that plan.' };
  }

  // Resolve current + target plan sort_order (direction) and the target Price.
  const { data: planRows, error: planErr } = await admin
    .from('subscription_plans')
    .select('code, sort_order, active')
    .in('code', [company.plan_code, targetPlanCode]);
  if (planErr || !planRows) {
    return { ok: false, code: 'plan_lookup_failed', message: 'Could not read plan data.' };
  }
  const currentRow = planRows.find((p) => p.code === company.plan_code);
  const targetRow = planRows.find((p) => p.code === targetPlanCode);
  if (!targetRow || !targetRow.active) {
    return { ok: false, code: 'invalid_target', message: 'That plan is not available.' };
  }

  const checkout = await resolveStripeCheckoutForPlan(targetPlanCode);
  if (!checkout) {
    return {
      ok: false,
      code: 'plan_not_configured',
      message: 'That plan is not set up for billing in this environment yet.',
    };
  }
  const targetPriceId = checkout.priceId;

  const isUpgrade =
    typeof currentRow?.sort_order === 'number'
      ? targetRow.sort_order > currentRow.sort_order
      : true; // unknown current => treat as upgrade (charge now, safest for us)

  const stripe = requireStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
    const item = sub.items.data[0];
    if (!item) {
      return { ok: false, code: 'stripe_error', message: 'Subscription has no billable item.' };
    }
    // No-op guard: already on the target price.
    if (item.price?.id === targetPriceId) {
      return { ok: false, code: 'already_on_plan', message: 'You are already on that plan.' };
    }

    if (isUpgrade) {
      // Immediate switch + proration; charge the difference now.
      await stripe.subscriptions.update(company.stripe_subscription_id, {
        items: [{ id: item.id, price: targetPriceId }],
        proration_behavior: 'create_prorations',
        payment_behavior: 'pending_if_incomplete',
        metadata: {
          company_id: company.id,
          plan_code: targetPlanCode,
        },
      });
    } else {
      // Downgrade: take effect at period end so the customer keeps what they
      // paid for. Use a Subscription Schedule anchored to the current sub.
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: company.stripe_subscription_id,
      });
      const phase = schedule.phases[0];
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        phases: [
          {
            // Keep the current phase exactly as-is until period end.
            items: [{ price: item.price.id, quantity: item.quantity ?? 1 }],
            start_date: phase.start_date,
            end_date: phase.end_date,
          },
          {
            // Then roll onto the target plan's price.
            items: [{ price: targetPriceId, quantity: 1 }],
            metadata: {
              company_id: company.id,
              plan_code: targetPlanCode,
            },
          },
        ],
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'stripe_change_failed';
    console.error('[billing] changePlan failed:', msg);
    return { ok: false, code: 'stripe_error', message: msg };
  }

  // The webhook reconciles companies.* from the live subscription. Revalidate
  // so the page re-reads once the user lands back (the success banner explains
  // the few-second sync window).
  revalidatePath(`/${slug}/account`);
  const base = await baseUrl();
  const flag = isUpgrade ? 'upgraded' : 'downgrade_scheduled';
  return { ok: true, url: `${base}/${slug}/account?tab=billing&change=${flag}` };
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
    const msg = err instanceof Error ? err.message : '';
    // Detect mode-mismatch or "no such customer" errors and attempt repair
    if (
      msg.includes('No such customer') ||
      msg.includes('a similar object exists in test mode') ||
      msg.includes('a similar object exists in live mode')
    ) {
      const { repairStripeCustomerIfStale } = await import('@/app/lib/billing/stripe');
      const repair = await repairStripeCustomerIfStale(company.id);
      if (!repair.ok) {
        return { ok: false, code: 'stripe_error', message: repair.message };
      }
      // Repair succeeded - re-fetch the updated customer ID and retry once
      const { data: fixed } = await (await import('@/app/lib/supabase/admin')).createAdminClient()
        .from('companies')
        .select('stripe_customer_id')
        .eq('id', company.id)
        .maybeSingle();
      if (!fixed?.stripe_customer_id) {
        return { ok: false, code: 'stripe_error', message: 'Billing record repaired but no customer ID available. Please try again.' };
      }
      const retrySession = await stripe.billingPortal.sessions.create({
        customer: fixed.stripe_customer_id,
        return_url: `${base}/${slug}/account?tab=billing`,
      });
      return { ok: true, url: retrySession.url };
    }
    console.error('[billing] createCustomerPortalSession failed:', msg);
    return { ok: false, code: 'stripe_error', message: msg || 'stripe_portal_failed' };
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
    .select('id, plan_code, subscription_status, stripe_subscription_id, stripe_customer_id, cancel_at_period_end, cancel_at, trial_ends_at, trial_started_at')
    .eq('id', profile.company_id)
    .maybeSingle();
  if (companyErr || !company) {
    return { ok: false, code: 'company_not_found', message: 'Company record missing.' };
  }

  // Gerald audit M-01R: durable once-per-company trial marker. Previously
  // we used `stripe_customer_id` as the proxy, which only fires after
  // first Checkout - a non-paying company whose trial expired could
  // re-invoke this action and get another 14 days. `trial_started_at` is
  // set on first successful activation and is the authoritative gate.
  if (company.trial_started_at) {
    return {
      ok: false,
      code: 'trial_not_available',
      message: 'The free trial is for new accounts only. Pick a paid plan to keep using QuoteCore+.',
    };
  }

  // Belt-and-braces: stripe_customer_id is a separate proxy for "this
  // company has paid us at some point". Keep blocking on it too.
  if (company.stripe_customer_id) {
    return {
      ok: false,
      code: 'trial_not_available',
      message: 'The free trial is for new accounts only. Pick a paid plan to keep using QuoteCore+.',
    };
  }

  // Belt-and-braces: even with no stripe_customer_id, refuse if there's
  // somehow an active Stripe sub on record (this should never happen given
  // the customer/sub pairing is set together by the webhook, but it's
  // cheap insurance against a partial state).
  const isWindingDown =
    company.cancel_at_period_end
    || (company.cancel_at != null && new Date(company.cancel_at).getTime() > Date.now());
  if (company.stripe_subscription_id && !isWindingDown) {
    return {
      ok: false,
      code: 'has_active_subscription',
      message: 'You have an active paid subscription. Cancel it via "Manage subscription" before starting a trial.',
    };
  }

  // If we get here trial_started_at is NULL, so this is the first-ever
  // activation for this company. Friendly already-active check is still
  // useful for the (impossible-after-M-01R) edge case where state got
  // poked into 'trialing' without setting trial_started_at.
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

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await admin
    .from('companies')
    .update({
      plan_code: 'trial',
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      // M-01R: stamp the durable once-per-company marker. Subsequent calls
      // refuse via the trial_started_at guard above.
      trial_started_at: nowIso,
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
  // Schema mirrors what the Stripe webhook handler writes - the
  // distinguishing field is event_type='trial.activated'.
  await admin.from('subscription_events').insert({
    company_id: company.id,
    event_type: 'trial.activated',
    from_plan_code: company.plan_code,
    to_plan_code: 'trial',
    stripe_event_type: null,
  });

  // The success URL goes back to the billing tab so we can flash a
  // banner - keep the same pattern as Stripe checkout success.
  const base = await baseUrl();
  revalidatePath(`/${slug}/account`);
  return { ok: true, url: `${base}/${slug}/account?tab=billing&trial=activated` };
}