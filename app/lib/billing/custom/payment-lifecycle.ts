import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireStripe } from '@/app/lib/billing/stripe';
import { customScope } from './environment';
import { referenceId } from './contracts';

const NOTICE_AFTER_DAYS = 7;

function eventTime(event: Stripe.Event): string {
  return new Date(event.created * 1000).toISOString();
}

function noticeDue(firstFailedAt: string): string {
  return new Date(Date.parse(firstFailedAt) + NOTICE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Durable operational attention record for custom billing failures/recovery.
 * This table NEVER grants quota; qcp_usage_context only uses an OPEN record
 * to extend the previous paid grant for at most seven days.
 */
export async function recordCustomPaymentLifecycle(input: {
  event: Stripe.Event;
  companyId: string;
  subscriptionId: string;
  invoiceId?: string | null;
}): Promise<void> {
  const { event, companyId, subscriptionId } = input;
  const scope = customScope();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  if (event.type === 'invoice.payment_failed') {
    const invoiceId = input.invoiceId ?? (event.data.object as { id?: string }).id;
    if (!invoiceId) throw new Error('retryable: failed invoice id missing');
    const failedAt = eventTime(event);
    const prior = await admin.from('qcp_payment_attention')
      .select('id, status, failure_count, first_failed_at, last_failed_at, resolved_at, last_event_id')
      .eq('stripe_account_id', scope.accountId).eq('stripe_mode', scope.mode)
      .eq('invoice_id', invoiceId).maybeSingle();
    if (prior.error) throw new Error(`retryable: payment attention lookup: ${prior.error.message}`);
    if (prior.data) {
      if (prior.data.last_event_id === event.id) return;
      // Stripe does not promise webhook delivery order. Never let an older
      // failed event reopen an invoice that a newer paid event recovered, or
      // move an open record's last-failure timestamp backwards.
      const failedMs = Date.parse(failedAt);
      const resolvedMs = Date.parse(prior.data.resolved_at ?? '');
      const lastFailedMs = Date.parse(prior.data.last_failed_at ?? '');
      if ((prior.data.status !== 'open' && Number.isFinite(resolvedMs) && resolvedMs >= failedMs)
          || (Number.isFinite(lastFailedMs) && lastFailedMs > failedMs)) return;
      const updated = await admin.from('qcp_payment_attention').update({
        status: 'open',
        last_failed_at: failedAt,
        failure_count: Number(prior.data.failure_count ?? 0) + 1,
        resolved_at: null,
        last_event_id: event.id,
        updated_at: new Date().toISOString(),
      }).eq('id', prior.data.id);
      if (updated.error) throw new Error(`retryable: payment attention update: ${updated.error.message}`);
      return;
    }
    const inserted = await admin.from('qcp_payment_attention').insert({
      company_id: companyId,
      stripe_account_id: scope.accountId,
      stripe_mode: scope.mode,
      subscription_id: subscriptionId,
      invoice_id: invoiceId,
      status: 'open',
      first_failed_at: failedAt,
      last_failed_at: failedAt,
      failure_count: 1,
      notice_due_at: noticeDue(failedAt),
      last_event_id: event.id,
    });
    if (inserted.error) throw new Error(`retryable: payment attention insert: ${inserted.error.message}`);
    return;
  }

  if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.paid') {
    const invoiceId = input.invoiceId ?? (event.data.object as { id?: string }).id;
    if (!invoiceId) return;
    const recovered = await admin.from('qcp_payment_attention').update({
      status: 'recovered',
      resolved_at: eventTime(event),
      last_event_id: event.id,
      updated_at: new Date().toISOString(),
    }).eq('stripe_account_id', scope.accountId).eq('stripe_mode', scope.mode)
      .eq('company_id', companyId).eq('subscription_id', subscriptionId)
      .eq('invoice_id', invoiceId).eq('status', 'open').lte('last_failed_at', eventTime(event));
    if (recovered.error) throw new Error(`retryable: payment attention recovery: ${recovered.error.message}`);
    return;
  }

  if (event.type === 'customer.subscription.deleted') {
    const closed = await admin.from('qcp_payment_attention').update({
      status: 'subscription_deleted',
      resolved_at: eventTime(event),
      last_event_id: event.id,
      updated_at: new Date().toISOString(),
    }).eq('stripe_account_id', scope.accountId).eq('stripe_mode', scope.mode)
      .eq('company_id', companyId).eq('subscription_id', subscriptionId).eq('status', 'open');
    if (closed.error) throw new Error(`retryable: payment attention close: ${closed.error.message}`);
  }
}

type RefundLike = Stripe.Refund & {
  charge?: string | Stripe.Charge | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
};

async function chargeForRefund(refund: RefundLike): Promise<Stripe.Charge | null> {
  const stripe = requireStripe();
  const chargeId = referenceId(refund.charge ?? null);
  if (chargeId) return stripe.charges.retrieve(chargeId);
  const paymentIntentId = referenceId(refund.payment_intent ?? null);
  if (!paymentIntentId) return null;
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const latestChargeId = referenceId(pi.latest_charge);
  return latestChargeId ? stripe.charges.retrieve(latestChargeId) : null;
}

async function observeRefund(event: Stripe.Event, refund: RefundLike): Promise<string> {
  const charge = await chargeForRefund(refund);
  if (!charge) return 'quarantined:refund_charge_not_found';
  const customerId = referenceId(charge.customer);
  if (!customerId) return 'quarantined:refund_customer_not_found';
  const scope = customScope();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const companyResult = await admin.from('companies')
    .select('id').eq('stripe_customer_id', customerId).maybeSingle();
  if (companyResult.error) throw new Error(`retryable: refund company lookup: ${companyResult.error.message}`);
  if (!companyResult.data) return 'quarantined:refund_company_not_found';

  const paymentIntentId = referenceId(refund.payment_intent ?? charge.payment_intent ?? null);
  const invoiceId = referenceId((charge as unknown as { invoice?: string | { id: string } | null }).invoice ?? null);
  const write = await admin.from('qcp_refund_observations').upsert({
    refund_id: refund.id,
    stripe_account_id: scope.accountId,
    stripe_mode: scope.mode,
    company_id: companyResult.data.id,
    charge_id: charge.id,
    payment_intent_id: paymentIntentId,
    invoice_id: invoiceId,
    amount_cents: refund.amount,
    currency: refund.currency,
    status: refund.status ?? 'unknown',
    reason: refund.reason ?? null,
    provider_created_at: new Date(refund.created * 1000).toISOString(),
    last_event_id: event.id,
    observed_at: new Date().toISOString(),
  }, { onConflict: 'stripe_account_id,stripe_mode,refund_id' });
  if (write.error) throw new Error(`retryable: refund observation: ${write.error.message}`);
  return 'ok:refund_observed';
}

/**
 * Observe manually-created Stripe refunds without changing QuoteCore usage,
 * grants, subscription state, or cancellation state.
 */
export async function observeStripeRefundEvent(event: Stripe.Event): Promise<string | null> {
  if (!['refund.created', 'refund.updated', 'refund.failed', 'charge.refunded'].includes(event.type)) return null;
  const stripe = requireStripe();
  if (event.type !== 'charge.refunded') {
    const id = (event.data.object as { id?: string }).id;
    if (!id) return 'quarantined:refund_id_missing';
    const refund = await stripe.refunds.retrieve(id) as RefundLike;
    return observeRefund(event, refund);
  }

  const chargeId = (event.data.object as { id?: string }).id;
  if (!chargeId) return 'quarantined:refund_charge_id_missing';
  let cursor: string | undefined;
  let observed = 0;
  for (let page = 0; page < 10; page += 1) {
    const refunds = await stripe.refunds.list({ charge: chargeId, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    for (const refund of refunds.data) {
      const result = await observeRefund(event, refund as RefundLike);
      if (result.startsWith('ok:')) observed += 1;
    }
    if (!refunds.has_more) return observed > 0 ? 'ok:refunds_observed' : 'quarantined:no_refunds_on_refunded_charge';
    cursor = refunds.data[refunds.data.length - 1]?.id;
    if (!cursor) throw new Error('retryable: refund pagination stalled');
  }
  throw new Error('retryable: refund pagination exceeded safety bound');
}
