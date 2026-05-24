/**
 * Stripe webhook handler.
 *
 * ---------------------------------------------------------------------------
 * Invariants (DO NOT VIOLATE)
 * ---------------------------------------------------------------------------
 *  1. SIGNATURE FIRST. Read the raw body, verify the Stripe signature
 *     against STRIPE_WEBHOOK_SECRET. Reject 400 on failure. Never mutate
 *     state from an unverified payload.
 *
 *  2. RAW LOG FIRST, MUTATION SECOND. The first DB write is into
 *     webhook_deliveries with the entire payload. The UNIQUE constraint
 *     on (provider, event_id) is our idempotency anchor. On a duplicate
 *     event we read the prior row's processed_at: if set, idempotent-200;
 *     if NULL (prior attempt 500ed under invariant 6), reprocess now so
 *     Stripe's retry actually makes progress (Gerald audit H-01R).
 *
 *  3. PLAN_CODE IS SACRED. We NEVER overwrite companies.plan_code from a
 *     payment failure. Failed payments drive subscription_status and the
 *     dunning timers. plan_code only changes when the user purchases or
 *     switches plan via Checkout or the Customer Portal.
 *
 *  4. PRICE ID ALLOWLIST. We only accept transitions to plan codes that
 *     resolve from a Price ID present in subscription_plans for the
 *     current Stripe mode. Unknown Price IDs are logged with
 *     processing_result='error:unknown_price' and 200-acked so Stripe
 *     stops retrying. (200 with no mutation is correct: the event was
 *     received and is on file; we just refused to act on it.)
 *
 *  5. LIVE STATE FETCH. After major events (subscription.created/updated/
 *     deleted) we re-fetch the live subscription from Stripe rather than
 *     trusting the event payload. Webhook events can arrive out of order;
 *     subscription.retrieve(...) always returns the current truth.
 *
 *  6. CORRECT RETRY SEMANTICS (Gerald audit H-01). Stripe retries any
 *     non-2xx for up to 3 days with exponential backoff. We return:
 *       - 400 on signature failure (never retry; the event was malformed)
 *       - 200 on duplicate-event (UNIQUE constraint hit; already handled)
 *       - 200 on `quarantined:*` results (business no-op; event is on
 *         file but we deliberately won't act on it - unknown_price,
 *         stale_subscription, customer_not_found, etc.)
 *       - 500 on retryable infra/Stripe/DB failures (handler threw via
 *         the `retryable()` helper). processed_at stays NULL so Stripe
 *         retries us and the idempotency table absorbs the duplicate
 *         later when processing actually succeeds.
 *
 *  7. SUBSCRIPTION ID VALIDATION (Gerald audit H-03). Subscription and
 *     invoice events validate against `companies.stripe_subscription_id`.
 *     Events whose sub-id doesn't match the company's current sub are
 *     quarantined so a stale event from a replaced/cancelled sub cannot
 *     bounce the company into past_due/grace. The one exception is
 *     `customer.subscription.created` for a company with no current
 *     sub - the first-link case.
 *
 * ---------------------------------------------------------------------------
 * Events handled (phase 1)
 * ---------------------------------------------------------------------------
 *   - checkout.session.completed
 *       First link between a company and a Stripe customer. Reads
 *       client_reference_id (set to company_id by createCheckoutSession)
 *       and writes companies.stripe_customer_id + stripe_subscription_id.
 *
 *   - customer.subscription.created / .updated / .deleted
 *       Refetch the subscription, resolve its primary Price ID to a plan
 *       code, update companies.plan_code + subscription_status +
 *       current_period_end + cancel_at_period_end.
 *
 *   - invoice.payment_succeeded
 *       Subscription is paid. Clear first_payment_failure_at /
 *       dunning_stage_entered_at. If we were in past_due/grace, move back
 *       to active. Write a 'reactivated' subscription_events row.
 *
 *   - invoice.payment_failed
 *       First payment failure: set first_payment_failure_at = now()
 *       (if not already set), subscription_status = 'past_due'. The
 *       dunning cron decides when to escalate to grace/pending_data_purge.
 *
 *   - charge.dispute.created
 *       Set subscription_status = 'disputed'. Create a payment_dispute
 *       support_tickets row (auto_close_at = now()+48h). User stays on
 *       their current tier until resolution.
 *
 *   - charge.dispute.closed
 *       Won: subscription_status = 'active'. Lost: subscription_status =
 *       'canceled'. Close the support ticket either way.
 *
 * Phase 2 events (not yet handled, just logged): customer.created /
 * .updated, price.created, payment_method.attached / .detached. We log
 * those into webhook_deliveries with processing_result='ignored:phase_2'
 * so they don't retry.
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  requireStripe,
  resolvePlanCodeForStripePrice,
  stripeStatusToInternal,
} from '@/app/lib/billing/stripe';

export const runtime = 'nodejs';
// Stripe needs the raw bytes for signature verification, so this route
// MUST be dynamic (no static optimisation) and we MUST NOT parse the body
// as JSON before verifying.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook/stripe] STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 });
  }

  // Read the raw body BEFORE parsing. Next exposes this via .text().
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = requireStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'signature_verification_failed';
    console.error('[webhook/stripe] signature verification failed:', msg);
    return NextResponse.json({ error: 'signature_invalid', message: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  // Stripe.Event is JSON-serialisable but the SDK's nominal type doesn't
  // satisfy supabase-js's generated `Json` type. Round-trip through
  // JSON.parse(JSON.stringify(...)) to get a plain structural value.
  const eventJson = JSON.parse(JSON.stringify(event));

  // Invariant 2: raw log first. UNIQUE(provider, event_id) is the
  // idempotency anchor BUT (Gerald audit H-01R) we must distinguish
  // 'already-processed duplicate' (200 idempotent) from 'previously-
  // attempted-then-500ed duplicate' (must reprocess so Stripe's retry
  // actually causes progress).
  const { data: existing, error: insertErr } = await admin
    .from('webhook_deliveries')
    .insert({
      provider: 'stripe',
      event_id: event.id,
      event_type: event.type,
      signature_verified: true,
      payload: eventJson,
    })
    .select('id, processed_at')
    .single();

  let deliveryId: string;

  if (insertErr) {
    if ((insertErr as { code?: string }).code !== '23505') {
      console.error('[webhook/stripe] failed to log webhook delivery:', insertErr);
      // Non-23505 insert error is a real infra problem; return 500 so Stripe
      // retries us.
      return NextResponse.json({ error: 'log_failed' }, { status: 500 });
    }

    // Duplicate event: fetch the existing row to read its processed_at
    // state. The original insert path lost this distinction and 200-acked
    // every duplicate, which silently swallowed Stripe's retry after a
    // transient 500.
    const { data: prior, error: fetchErr } = await admin
      .from('webhook_deliveries')
      .select('id, processed_at')
      .eq('provider', 'stripe')
      .eq('event_id', event.id)
      .maybeSingle();
    if (fetchErr || !prior) {
      console.error('[webhook/stripe] duplicate-event fetch failed:', fetchErr);
      // Treat as retryable infra failure.
      return NextResponse.json({ error: 'duplicate_fetch_failed' }, { status: 500 });
    }

    if (prior.processed_at) {
      console.log(`[webhook/stripe] duplicate event ${event.id} already processed; idempotent ack`);
      return NextResponse.json({ ok: true, idempotent: true });
    }

    // processed_at IS NULL -> prior attempt ended in a retryable failure.
    // Fall through and process now using the freshly-verified payload
    // from THIS request (the existing row's payload is the same event id
    // either way; signature was just re-verified above).
    console.log(`[webhook/stripe] duplicate event ${event.id} reprocessing (prior attempt unprocessed)`);
    deliveryId = prior.id;
  } else {
    deliveryId = existing.id;
  }

  // ----- Dispatch -----
  //
  // Handler contract (H-01):
  //   - Return a string starting with 'ok' or 'quarantined:' or
  //     'ignored:' for events we deliberately won't retry.
  //   - THROW for transient infra failures we want Stripe to retry.
  // Strings starting with 'error:' from a handler are legacy and treated
  // as quarantined (handler decided the event is invalid and shouldn't
  // retry). Truly retryable errors should throw.
  let result: string;
  let retryable = false;
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        result = await handleSubscriptionEvent(event, eventJson);
        break;
      case 'invoice.payment_succeeded':
        result = await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        result = await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      case 'charge.dispute.created':
        result = await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      case 'charge.dispute.closed':
        result = await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;
      default:
        result = 'ignored:phase_2';
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook/stripe] retryable error on ${event.type}:`, msg);
    result = `retryable_error:${msg.slice(0, 200)}`;
    retryable = true;
  }

  if (retryable) {
    // Leave processed_at NULL so a retry attempts processing again. The
    // payload + signature_verified flag are already persisted so we
    // don't lose the event. Record the latest attempt's failure reason
    // so on-call has visibility without grepping logs.
    await admin
      .from('webhook_deliveries')
      .update({ processing_result: result })
      .eq('id', deliveryId);
    return NextResponse.json({ ok: false, retry: true, result }, { status: 500 });
  }

  // Mark processed (idempotent UPDATE).
  await admin
    .from('webhook_deliveries')
    .update({ processed_at: new Date().toISOString(), processing_result: result })
    .eq('id', deliveryId);

  return NextResponse.json({ ok: true, result });
}

// ---------------------------------------------------------------------------
// Helper: tag retryable infra errors so handlers can THROW them cleanly.
// ---------------------------------------------------------------------------
function retryable(msg: string): Error {
  return new Error(`retryable: ${msg}`);
}

// Stripe's TS types for `Invoice` omit the `subscription` field in some
// API versions even though it's present on the wire. Read it defensively.
function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as unknown as { subscription?: string | { id?: string } | null }).subscription;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && typeof raw.id === 'string') return raw.id;
  return null;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Initial Checkout completion. The frontend created the session with
 * client_reference_id = our company_id, so the linkage is unambiguous.
 *
 * On success we write companies.stripe_customer_id + stripe_subscription_id
 * but leave plan_code / subscription_status alone. Those will be
 * authoritatively set by the subsequent customer.subscription.created
 * webhook which fires right after (usually within a second).
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<string> {
  const companyId = session.client_reference_id;
  if (!companyId) return 'quarantined:no_client_reference_id';

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!customerId || !subscriptionId) {
    // Checkout completed but no subscription was created: unexpected for
    // our flow (we only create subscription-mode sessions). Quarantine.
    return 'quarantined:missing_customer_or_subscription';
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('companies')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    })
    .eq('id', companyId);

  // DB failure on the canonical first-link write IS retryable.
  if (error) throw retryable(`companies update: ${error.message}`);
  return 'ok';
}

/**
 * customer.subscription.created / .updated / .deleted.
 *
 * Re-fetch the subscription from Stripe (invariant 5) so we get the
 * authoritative current state, not a possibly out-of-order webhook
 * payload. Resolve the primary Price ID to a plan code (invariant 4):
 * if unknown, no-op with an audit row so we don't accidentally upgrade
 * a customer to "starter" on a misconfigured price.
 */
async function handleSubscriptionEvent(
  event: Stripe.Event,
  eventJson: unknown,
): Promise<string> {
  const stripe = requireStripe();
  const subFromEvent = event.data.object as Stripe.Subscription;
  // Refetch authoritative state. Stripe API failures are retryable.
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subFromEvent.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw retryable(`stripe.subscriptions.retrieve: ${msg}`);
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const admin = createAdminClient();
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, plan_code, subscription_status, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (companyErr) throw retryable(`companies lookup: ${companyErr.message}`);
  if (!company) return 'quarantined:company_not_found_for_customer';

  // Gerald audit H-03: validate the event's subscription id against the
  // company's current subscription. Mismatches happen when:
  //   - a stale event from a previously-cancelled sub arrives late
  //   - duplicate subs exist (which H-02 prevents on our side, but Stripe
  //     dashboard/manual operations could still create them)
  //   - the user replaced their sub via the Customer Portal and the
  //     `customer.subscription.deleted` for the old sub races us
  // We accept the event ONLY when:
  //   - it matches the current subscription_id, OR
  //   - the company has no subscription_id yet AND the event type is
  //     `customer.subscription.created` (the first-link case).
  const isFirstLink =
    !company.stripe_subscription_id && event.type === 'customer.subscription.created';
  if (!isFirstLink && company.stripe_subscription_id && sub.id !== company.stripe_subscription_id) {
    return `quarantined:stale_subscription:${sub.id}_vs_current_${company.stripe_subscription_id}`;
  }

  // Resolve the primary Price ID to our plan code.
  const priceId = sub.items.data[0]?.price?.id;
  if (!priceId) return 'quarantined:no_price_on_subscription';

  const planCode = await resolvePlanCodeForStripePrice(priceId);
  if (!planCode) {
    // Allowlist miss. Log & skip mutation. The user is on a plan in Stripe
    // that we don't recognise; manual intervention needed.
    return 'quarantined:unknown_price';
  }

  const newStatus = event.type === 'customer.subscription.deleted'
    ? ('canceled' as const)
    : stripeStatusToInternal(sub.status);

  // current_period_end moved to per-item in newer Stripe API versions.
  // Read it from the first subscription item; falls back to null if absent.
  const periodEndSeconds = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEndSeconds
    ? new Date(periodEndSeconds * 1000).toISOString()
    : null;

  const update: {
    plan_code: string;
    subscription_status: string;
    stripe_subscription_id: string;
    stripe_price_id: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    cancel_at: string | null;
    trial_ends_at?: string;
  } = {
    plan_code: planCode,
    subscription_status: newStatus,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    // Stripe's explicit scheduled cancellation timestamp. Distinct from
    // cancel_at_period_end; populated by some Dashboard flows and
    // Subscription Schedules. Mirrored here so the trial-activation gate
    // can treat a sub as 'winding down' without waiting for the period
    // to elapse. Cleared on subscription.deleted so a stale value doesn't
    // outlive the subscription itself.
    cancel_at:
      event.type === 'customer.subscription.deleted'
        ? null
        : sub.cancel_at
          ? new Date(sub.cancel_at * 1000).toISOString()
          : null,
  };

  // Trial linkage: Stripe carries the trial end on the subscription.
  if (sub.trial_end) {
    update.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
  }

  const { error: updErr } = await admin.from('companies').update(update).eq('id', company.id);
  if (updErr) throw retryable(`companies update: ${updErr.message}`);

  // Audit row.
  const { error: auditErr } = await admin.from('subscription_events').insert({
    company_id: company.id,
    event_type: event.type === 'customer.subscription.deleted' ? 'downgraded' : 'updated',
    from_plan_code: company.plan_code,
    to_plan_code: planCode,
    from_status: company.subscription_status,
    to_status: newStatus,
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    stripe_event_created: new Date(event.created * 1000).toISOString(),
    stripe_payload: eventJson as never,
  });
  if (auditErr) throw retryable(`subscription_events insert: ${auditErr.message}`);

  return 'ok';
}

/**
 * invoice.payment_succeeded. Clear payment-failure timers. If we were
 * past_due / grace, restore active. plan_code is never touched here.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<string> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return 'quarantined:no_customer_on_invoice';

  // Gerald audit H-03: invoice events also have to validate against the
  // company's current subscription_id. invoice.subscription points at
  // the sub that generated the invoice; if it's not the current one,
  // ignore the event so a stale dunning event from a replaced sub can't
  // bounce the company into past_due/grace.
  const invoiceSubId = extractInvoiceSubscriptionId(invoice);

  const admin = createAdminClient();
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, subscription_status, plan_code, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (companyErr) throw retryable(`companies lookup: ${companyErr.message}`);
  if (!company) return 'quarantined:company_not_found_for_customer';

  if (invoiceSubId && company.stripe_subscription_id && invoiceSubId !== company.stripe_subscription_id) {
    return `quarantined:stale_subscription:${invoiceSubId}_vs_current_${company.stripe_subscription_id}`;
  }

  // Restore to active if we were in any payment-failure state.
  const wasRecovering = ['past_due', 'grace', 'pending_data_purge'].includes(
    company.subscription_status,
  );

  const update: {
    first_payment_failure_at: string | null;
    dunning_stage_entered_at: string | null;
    subscription_status?: string;
  } = {
    first_payment_failure_at: null,
    dunning_stage_entered_at: null,
  };
  if (wasRecovering) update.subscription_status = 'active';

  const { error: updErr } = await admin.from('companies').update(update).eq('id', company.id);
  if (updErr) throw retryable(`companies update: ${updErr.message}`);

  if (wasRecovering) {
    const { error: auditErr } = await admin.from('subscription_events').insert({
      company_id: company.id,
      event_type: 'reactivated',
      from_status: company.subscription_status,
      to_status: 'active',
      notes: `Recovered from ${company.subscription_status} on invoice.payment_succeeded`,
    });
    if (auditErr) throw retryable(`subscription_events insert: ${auditErr.message}`);
  }
  return 'ok';
}

/**
 * invoice.payment_failed. Set first_payment_failure_at if unset, move
 * to past_due. The dunning cron will escalate later.
 */
async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<string> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return 'quarantined:no_customer_on_invoice';

  const invoiceSubId = extractInvoiceSubscriptionId(invoice);

  const admin = createAdminClient();
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, subscription_status, plan_code, first_payment_failure_at, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (companyErr) throw retryable(`companies lookup: ${companyErr.message}`);
  if (!company) return 'quarantined:company_not_found_for_customer';

  if (invoiceSubId && company.stripe_subscription_id && invoiceSubId !== company.stripe_subscription_id) {
    return `quarantined:stale_subscription:${invoiceSubId}_vs_current_${company.stripe_subscription_id}`;
  }

  const now = new Date().toISOString();
  const update: {
    subscription_status: string;
    first_payment_failure_at?: string;
    dunning_stage_entered_at?: string;
  } = {
    subscription_status: 'past_due',
  };
  // Don't overwrite an existing timer on a 2nd / 3rd retry.
  if (!company.first_payment_failure_at) {
    update.first_payment_failure_at = now;
    update.dunning_stage_entered_at = now;
  }

  const { error: updErr } = await admin.from('companies').update(update).eq('id', company.id);
  if (updErr) throw retryable(`companies update: ${updErr.message}`);

  const { error: auditErr } = await admin.from('subscription_events').insert({
    company_id: company.id,
    event_type: 'payment_failed',
    from_status: company.subscription_status,
    to_status: 'past_due',
    notes: 'invoice.payment_failed webhook',
  });
  if (auditErr) throw retryable(`subscription_events insert: ${auditErr.message}`);
  return 'ok';
}

/**
 * charge.dispute.created. subscription_status='disputed', auto
 * support_tickets row, auto_close_at = now()+48h. User stays on their
 * tier until resolution.
 */
async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<string> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return 'quarantined:no_charge_on_dispute';

  // Look up the company via the charge -> customer -> companies path.
  const stripe = requireStripe();
  let charge: Stripe.Charge;
  try {
    charge = await stripe.charges.retrieve(chargeId);
  } catch (err) {
    throw retryable(`stripe.charges.retrieve: ${err instanceof Error ? err.message : String(err)}`);
  }
  const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
  if (!customerId) return 'quarantined:no_customer_on_charge';

  const admin = createAdminClient();
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, subscription_status, plan_code')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (companyErr) throw retryable(`companies lookup: ${companyErr.message}`);
  if (!company) return 'quarantined:company_not_found_for_customer';

  const { error: updErr } = await admin
    .from('companies')
    .update({ subscription_status: 'disputed' })
    .eq('id', company.id);
  if (updErr) throw retryable(`companies update: ${updErr.message}`);

  // Auto-create the support ticket. 48h auto-close per brief. user_id is
  // NOT NULL on support_tickets; pick the company's first user as a
  // best-effort owner of the system ticket (admin can re-assign).
  const autoCloseAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: firstUser } = await admin
    .from('users')
    .select('id')
    .eq('company_id', company.id)
    .limit(1)
    .maybeSingle();
  if (firstUser?.id) {
    await admin.from('support_tickets').insert({
      company_id: company.id,
      user_id: firstUser.id,
      category: 'payment_dispute',
      subject: `Payment dispute opened: ${dispute.reason || 'no reason'}`,
      body:
        `A dispute has been opened against your subscription payment.\n\n` +
        `Reason: ${dispute.reason || 'not specified'}\n` +
        `Amount: ${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}\n\n` +
        `Please respond within 48 hours to resolve.`,
      status: 'open',
      priority: 'high',
      related_stripe_dispute_id: dispute.id,
      related_stripe_charge_id: chargeId,
      auto_close_at: autoCloseAt,
      created_by_system: true,
    });
  } else {
    console.warn(`[webhook/stripe] no user on company ${company.id}; skipping support_tickets insert`);
  }

  await admin.from('subscription_events').insert({
    company_id: company.id,
    event_type: 'dispute_opened',
    from_status: company.subscription_status,
    to_status: 'disputed',
    notes: `Stripe dispute ${dispute.id}: ${dispute.reason || 'no reason'}`,
  });
  return 'ok';
}

/**
 * charge.dispute.closed. Won = back to active. Lost = canceled.
 */
async function handleDisputeClosed(dispute: Stripe.Dispute): Promise<string> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return 'quarantined:no_charge_on_dispute';

  const stripe = requireStripe();
  let charge: Stripe.Charge;
  try {
    charge = await stripe.charges.retrieve(chargeId);
  } catch (err) {
    throw retryable(`stripe.charges.retrieve: ${err instanceof Error ? err.message : String(err)}`);
  }
  const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
  if (!customerId) return 'quarantined:no_customer_on_charge';

  const admin = createAdminClient();
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .select('id, subscription_status')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (companyErr) throw retryable(`companies lookup: ${companyErr.message}`);
  if (!company) return 'quarantined:company_not_found_for_customer';

  const won = dispute.status === 'won';
  const newStatus = won ? 'active' : 'canceled';
  const { error: updErr } = await admin
    .from('companies')
    .update({ subscription_status: newStatus })
    .eq('id', company.id);
  if (updErr) throw retryable(`companies update: ${updErr.message}`);

  // Close the auto-created support ticket.
  await admin
    .from('support_tickets')
    .update({ status: 'resolved' })
    .eq('related_stripe_dispute_id', dispute.id);

  await admin.from('subscription_events').insert({
    company_id: company.id,
    event_type: 'dispute_closed',
    from_status: company.subscription_status,
    to_status: newStatus,
    notes: `Stripe dispute ${dispute.id} closed as ${dispute.status}`,
  });

  return 'ok';
}
