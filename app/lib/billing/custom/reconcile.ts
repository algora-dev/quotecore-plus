/** Custom billing adapter. Legacy events fall through to the existing handler. */
import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireStripe, resolvePlanCodeForStripePrice } from '@/app/lib/billing/stripe';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { buildBillingCatalogue, type CompleteSubscriptionItems } from '@/app/components/pricing/calculator/billingCatalogue';
import { customScope, verifyCustomAccount } from './environment';
import { loadRecognitionRegistry } from './registry';
import { BillingContractError, decodeRegisteredItems, insist, invoiceSubscriptionId, object, referenceId, requireMode, verifyPaidPeriod, purchasedFingerprint } from './contracts';

export function isCustomSubscription(sub: Stripe.Subscription): boolean { return sub.metadata?.billing_model === 'custom_setup'; }
/** A complete provider list, not just the first expanded page on Subscription. */
export async function collectPages<T extends { id: string }>(read: (cursor?: string) => Promise<{ data: T[]; has_more: boolean }>): Promise<T[]> {
  const all: T[] = []; const ids = new Set<string>(); let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const result = await read(cursor);
    insist(Array.isArray(result.data) && typeof result.has_more === 'boolean', 'provider_pagination_invalid');
    for (const item of result.data) {
      insist(typeof item.id === 'string' && !ids.has(item.id), 'provider_pagination_duplicate');
      ids.add(item.id); all.push(item);
    }
    if (!result.has_more) return all;
    const next = result.data[result.data.length - 1]?.id;
    insist(next && next !== cursor, 'provider_pagination_stalled'); cursor = next;
  }
  throw new Error('retryable: provider pagination exceeded safety bound');
}
export async function fetchFullSubscriptionItems(stripe: Stripe, subscriptionId: string) {
  return collectPages(cursor => stripe.subscriptionItems.list({ subscription: subscriptionId, limit: 100, ...(cursor ? { starting_after: cursor } : {}) }));
}
export async function fetchAllSubscriptionItems(stripe: Stripe, subscriptionId: string): Promise<CompleteSubscriptionItems> {
  const items = await fetchFullSubscriptionItems(stripe, subscriptionId);
  return { complete: true, items: items.map(item => ({ id: item.id, priceId: item.price.id, quantity: item.quantity ?? 0 })) };
}
async function loadCompany(customerId: string, metadataCompanyId?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const columns = 'id, plan_code, billing_model, stripe_mode, stripe_customer_id, stripe_subscription_id, subscription_status, admin_paused';
  const first = await admin.from('companies').select(columns).eq('stripe_customer_id', customerId).maybeSingle();
  if (first.error) throw new Error(`retryable: company lookup: ${first.error.message}`);
  if (first.data) return first.data;
  if (!metadataCompanyId) return null;
  const second = await admin.from('companies').select(columns).eq('id', metadataCompanyId).maybeSingle();
  if (second.error) throw new Error(`retryable: metadata company lookup: ${second.error.message}`);
  return second.data;
}
const SUPPORTED = new Set([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.pending_update_applied', 'customer.subscription.pending_update_expired',
  'invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed',
]);
/** null means a verified legacy candidate; no custom business mutation occurred. */
export async function handleCustomStripeEvent(event: Stripe.Event, eventJson: unknown): Promise<string | null> {
  if (!SUPPORTED.has(event.type)) return null;
  const stripe = requireStripe();
  let subscriptionId: string | null = null;
  let checkoutCompanyId: string | undefined;
  // Every SUPPORTED event type carries a top-level object id. Narrow the SDK
  // union once and fail closed on any payload shape without a string id.
  const eventObjectId = (event.data.object as { id?: string | null }).id;
  if (typeof eventObjectId !== 'string') return null;
  if (event.type.startsWith('checkout.session.')) {
    const session = await stripe.checkout.sessions.retrieve(eventObjectId);
    subscriptionId = referenceId(session.subscription);
    checkoutCompanyId = session.client_reference_id ?? undefined;
    if (!subscriptionId) return session.metadata?.billing_model === 'custom_setup' ? 'deferred:checkout_not_subscribed' : null;
  } else if (event.type.startsWith('invoice.')) {
    const invoice = await stripe.invoices.retrieve(eventObjectId);
    subscriptionId = invoiceSubscriptionId(invoice);
    // A one-off DFY invoice must never reset subscriptions, quotas or dunning.
    if (!subscriptionId) return 'ignored:non_subscription_invoice';
  } else subscriptionId = eventObjectId;
  let subscription = await stripe.subscriptions.retrieve(subscriptionId);
  let customerId = referenceId(subscription.customer);
  insist(customerId, 'subscription_customer_missing');
  const company = await loadCompany(customerId, subscription.metadata?.company_id ?? checkoutCompanyId);
  const storedCustom = company?.billing_model === 'custom_setup' && company?.stripe_subscription_id === subscription.id;
  const markedCustom = isCustomSubscription(subscription);
  // Recognized old single-price subscriptions do not depend on custom registry configuration.
  if (!markedCustom && !storedCustom && subscription.items.has_more === false && subscription.items.data.length === 1) {
    if (await resolvePlanCodeForStripePrice(subscription.items.data[0].price.id)) return null;
  }
  const scope = customScope();
  const rows = await loadRecognitionRegistry(scope);
  const knownCustom = subscription.items.data.some(item => rows.some(row => row.stripe_price_id === item.price.id));
  if (!markedCustom && !storedCustom && !knownCustom) {
    if (subscription.items.has_more || subscription.items.data.length !== 1) return 'quarantined:unrecognized_multi_item_subscription';
    return null;
  }
  if (!company) return 'quarantined:custom_company_not_found';
  if (company.admin_paused) return 'ok:admin_paused';
  if (company.stripe_mode && company.stripe_mode !== scope.mode) return 'quarantined:company_mode_mismatch';
  await verifyCustomAccount();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const begin = await admin.rpc('qcp_begin_custom_reconcile', { p_company_id: company.id, p_mode: scope.mode });
  if (begin.error) throw new Error(`retryable: reconciliation ticket: ${begin.error.message}`);
  insist(typeof begin.data === 'number' && Number.isSafeInteger(begin.data), 'reconciliation_ticket_invalid');
  // Fetch AFTER the fencing ticket. Never apply stale event object contents.
  subscription = await stripe.subscriptions.retrieve(subscriptionId);
  requireMode(subscription, scope.mode); requireMode(event, scope.mode);
  customerId = referenceId(subscription.customer);
  insist(customerId && (!company.stripe_customer_id || company.stripe_customer_id === customerId), 'subscription_customer_mismatch');
  insist(!subscription.metadata?.company_id || subscription.metadata.company_id === company.id, 'subscription_company_mismatch');
  const payload: Record<string, unknown> = {
    kind: 'state', stripe_account_id: scope.accountId, stripe_mode: scope.mode,
    stripe_customer_id: customerId, stripe_subscription_id: subscription.id, provider_status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
    operation_id: subscription.metadata?.operation_id ?? null,
  };
  try {
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      const items = await fetchFullSubscriptionItems(stripe, subscription.id);
      const purchase = decodeRegisteredItems(items, subscription, rows, buildBillingCatalogue(PREVIEW_CATALOG));
      const invoiceId = referenceId(subscription.latest_invoice);
      if (!invoiceId) return 'deferred:awaiting_first_invoice';
      const invoice = await stripe.invoices.retrieve(invoiceId);
      // Stripe will send the payment event when money settles. A 500 retry loop is not a payment workflow.
      if (invoice.status !== 'paid') return 'deferred:awaiting_current_invoice_payment';
      if (subscription.pending_update) return 'deferred:pending_subscription_update';
      if (!['subscription_create','subscription_cycle'].includes(invoice.billing_reason ?? '')) return 'deferred:nonrenewal_invoice_requires_review';
      const lines = await collectPages(cursor => stripe.invoices.listLineItems(invoice.id, { limit: 100, ...(cursor ? { starting_after: cursor } : {}) }));
      verifyPaidPeriod(invoice, lines, subscription, purchase, scope.mode);
      // A changed subscription during the read is retried, never merged into a hybrid snapshot.
      const final = await stripe.subscriptions.retrieve(subscription.id);
      if (final.status !== subscription.status || referenceId(final.latest_invoice) !== invoiceId || final.pending_update
          || final.cancel_at_period_end !== subscription.cancel_at_period_end || final.cancel_at !== subscription.cancel_at) {
        throw new Error('retryable: subscription changed during verification');
      }
      const finalItems = await fetchFullSubscriptionItems(stripe, subscription.id);
      const finalPurchase = decodeRegisteredItems(finalItems, final, rows, buildBillingCatalogue(PREVIEW_CATALOG));
      if (purchasedFingerprint(finalPurchase) !== purchasedFingerprint(purchase)) {
        throw new Error('retryable: subscription items changed during verification');
      }
      Object.assign(payload, { kind: 'paid', catalog_id: scope.catalogId, catalog_revision: purchase.revision,
        component_codes: purchase.codes, purchased_entitlements: purchase.limits, currency: scope.currency.toLowerCase(),
        monthly_cents: purchase.monthlyCents, period_start: new Date(purchase.periodStart * 1000).toISOString(),
        period_end: new Date(purchase.periodEnd * 1000).toISOString(), last_paid_invoice_id: invoice.id });
    }
    const applied = await admin.rpc('qcp_apply_custom_reconcile', { p_company_id: company.id, p_fence: begin.data, p_payload: payload, p_event: eventJson });
    if (applied.error) throw new Error(`retryable: custom reconciliation transaction: ${applied.error.message}`);
    insist(typeof applied.data === 'string', 'reconciliation_result_invalid');
    return applied.data;
  } catch (error) {
    if (error instanceof BillingContractError) return `quarantined:${error.code}`;
    throw error;
  }
}
