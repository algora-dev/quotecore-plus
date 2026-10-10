/**
 * Custom-setup (V5) webhook reconciliation.
 *
 * Extends — never replaces — the legacy single-price webhook path. A
 * subscription is custom when OUR Checkout stamped
 * subscription_data.metadata.billing_model='custom_setup' (trusted server
 * metadata; the verified Price IDs define the purchased tools). The complete
 * item set is decoded against the DB price registry (fail closed on unknown
 * prices, duplicate products, partial pagination or non-1 quantities), the
 * latest invoice must be PAID before billing_model flips, and the snapshot +
 * period grant are written idempotently so webhook replays are safe.
 *
 * plan_code stays untouched (sacred); billing_model discriminates the path.
 */

import Stripe from 'stripe';
import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  requireStripe,
  stripeStatusToInternal,
} from '@/app/lib/billing/stripe';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import {
  decodeSubscriptionItems,
} from '@/app/components/pricing/calculator/billingCatalogue';
import type {
  StripePriceMap,
  CompleteSubscriptionItems,
} from '@/app/components/pricing/calculator/billingCatalogue';
import { loadCustomPriceMap, customStripeMode } from './checkout';

/* Custom billing tables are not in database.types.ts (assistant_v2_*
   precedent); companies updates carrying billing_model also bypass the
   stale generated types. Query through an untyped handle. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedTable = any;

export function isCustomSubscription(sub: Stripe.Subscription): boolean {
  return sub.metadata?.billing_model === 'custom_setup';
}

/** Retrieve the COMPLETE subscription item set; fail closed on pagination. */
export async function fetchAllSubscriptionItems(
  stripe: Stripe,
  subscriptionId: string,
): Promise<CompleteSubscriptionItems> {
  const items: { id: string; priceId: string; quantity: number }[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const res = await stripe.subscriptionItems.list({
      subscription: subscriptionId,
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    });
    for (const it of res.data) {
      items.push({ id: it.id, priceId: it.price.id, quantity: it.quantity ?? 0 });
    }
    if (!res.has_more) return { complete: true, items };
    const next = res.data[res.data.length - 1]?.id;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return { complete: false, items };
}

/**
 * customer.subscription.* for custom-setup subscriptions. Returns the
 * handler result string; THROWS retryable errors for transient failures
 * (Stripe retries the event; all writes below are idempotent).
 */
export async function reconcileCustomSubscription(opts: {
  sub: Stripe.Subscription;
  event: Stripe.Event;
  eventJson: unknown;
  company: { id: string; plan_code: string; subscription_status: string };
}): Promise<string> {
  const { sub, event, eventJson, company } = opts;
  const stripe = requireStripe();
  const admin = createAdminClient();
  const mode = customStripeMode();
  const nowIso = new Date().toISOString();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // --- Deletion: tear the custom state down, keep plan_code history. ---
  if (event.type === 'customer.subscription.deleted') {
    await (admin as UntypedTable)
      .from('company_custom_billing')
      .update({ provider_status: 'canceled', reconciled_at: nowIso })
      .eq('company_id', company.id)
      .eq('stripe_mode', mode);
    await (admin as UntypedTable)
      .from('companies')
      .update({ billing_model: 'legacy', subscription_status: 'canceled', cancel_at: null })
      .eq('id', company.id);
    await admin.from('subscription_events').insert({
      company_id: company.id,
      event_type: 'downgraded',
      from_plan_code: company.plan_code,
      to_plan_code: company.plan_code,
      from_status: company.subscription_status,
      to_status: 'canceled',
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      stripe_event_created: new Date(event.created * 1000).toISOString(),
      notes: 'custom_setup subscription deleted; billing_model reverted to legacy.',
      stripe_payload: eventJson as never,
    });
    return 'ok:custom_setup_deleted';
  }

  // --- Complete item set (fail closed). ---
  const snapshot = await fetchAllSubscriptionItems(stripe, sub.id);
  if (!snapshot.complete) throw new Error('retryable: incomplete subscription item pagination');

  // --- Decode against the server price registry. ---
  const codeToPrice = await loadCustomPriceMap();
  const map: StripePriceMap = Object.fromEntries(codeToPrice.entries());
  let decoded: ReturnType<typeof decodeSubscriptionItems>;
  try {
    decoded = decodeSubscriptionItems(snapshot, PREVIEW_CATALOG, map);
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 80) : 'unknown';
    return `quarantined:custom_setup_unrecognized_items:${detail}`;
  }

  // --- Lifecycle: keep last verified access on payment-trouble states. ---
  if (['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(sub.status)) {
    await (admin as UntypedTable)
      .from('company_custom_billing')
      .update({ provider_status: sub.status, reconciled_at: nowIso })
      .eq('company_id', company.id)
      .eq('stripe_mode', mode)
      .eq('stripe_subscription_id', sub.id);
    return `ok:custom_setup_${sub.status}_no_flip`;
  }
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return `quarantined:custom_setup_status_${sub.status}`;
  }

  // --- Prove the latest invoice is paid before flipping anything. ---
  const latestInvoiceId = typeof sub.latest_invoice === 'string'
    ? sub.latest_invoice
    : sub.latest_invoice?.id ?? null;
  if (!latestInvoiceId) throw new Error('retryable: subscription has no latest_invoice to verify');
  const invoice = await stripe.invoices.retrieve(latestInvoiceId);
  if (invoice.status !== 'paid') {
    throw new Error(`retryable: latest invoice ${invoice.id} status=${invoice.status ?? 'unknown'}; retry after payment`);
  }

  // --- Period bounds from the capacity item (single source of periods). ---
  const capacityPriceId = codeToPrice.get(`capacity_${decoded.capacity}`);
  const capacitySubItem = sub.items.data.find(it => it.price.id === capacityPriceId)
    ?? sub.items.data[0];
  const periodStartSec = capacitySubItem?.current_period_start;
  const periodEndSec = capacitySubItem?.current_period_end;
  if (!periodStartSec || !periodEndSec) {
    throw new Error('retryable: missing current_period bounds on capacity item');
  }
  const periodStartIso = new Date(periodStartSec * 1000).toISOString();
  const periodEndIso = new Date(periodEndSec * 1000).toISOString();

  // --- Snapshot payload. ---
  const entitlements = {
    capacity: decoded.capacity,
    quotes: decoded.limits.quotes,
    storageBytes: decoded.limits.storageBytes,
    digitalTakeoff: decoded.digitalTakeoff,
    scanTokens: decoded.limits.scanTokens,
    offcuts: decoded.offcuts,
    assistantTasks: decoded.limits.assistantTasks,
  };

  const { data: currentCompany } = await (admin as UntypedTable)
    .from('companies')
    .select('billing_model, plan_code')
    .eq('id', company.id)
    .maybeSingle();
  const cc = currentCompany as { billing_model: string; plan_code: string } | null;
  const legacySnapshot = cc && cc.billing_model !== 'custom_setup' ? cc.plan_code : null;

  // NOTE: companies.billing_model is new and absent from the generated types.
  const { data: prior } = await (admin as UntypedTable)
    .from('company_custom_billing')
    .select('legacy_plan_code_snapshot')
    .eq('company_id', company.id)
    .maybeSingle();

  const { data: mapRow } = await (admin as UntypedTable)
    .from('custom_billing_price_map')
    .select('stripe_account_id')
    .eq('stripe_mode', mode)
    .limit(1)
    .maybeSingle();
  if (!mapRow?.stripe_account_id) throw new Error('retryable: price registry has no account binding');
  const stripeAccountId = mapRow.stripe_account_id as string;
  const internalStatus = stripeStatusToInternal(sub.status);

  // --- Writes, ordered; webhook retries are idempotent (upserts + unique keys). ---
  const { error: snapErr } = await (admin as UntypedTable)
    .from('company_custom_billing')
    .upsert({
      company_id: company.id,
      stripe_account_id: stripeAccountId,
      stripe_mode: mode,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      catalog_id: PREVIEW_CATALOG.id,
      catalog_revision: PREVIEW_CATALOG.revision,
      component_codes: decoded.lines.map(l => l.code),
      purchased_entitlements: entitlements,
      provider_status: sub.status,
      currency: PREVIEW_CATALOG.currency.toLowerCase(),
      monthly_cents: decoded.monthlyCents,
      period_start: periodStartIso,
      period_end: periodEndIso,
      last_paid_invoice_id: invoice.id,
      legacy_plan_code_snapshot: prior?.legacy_plan_code_snapshot ?? legacySnapshot,
      reconciled_at: nowIso,
    }, { onConflict: 'company_id' });
  if (snapErr) throw new Error(`retryable: snapshot upsert: ${snapErr.message}`);

  const { error: coErr } = await (admin as UntypedTable)
    .from('companies')
    .update({
      billing_model: 'custom_setup',
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      subscription_status: internalStatus,
      current_period_end: periodEndIso,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    })
    .eq('id', company.id);
  if (coErr) throw new Error(`retryable: companies update: ${coErr.message}`);

  const { error: grantErr } = await (admin as UntypedTable)
    .from('custom_billing_period_grants')
    .upsert({
      company_id: company.id,
      stripe_mode: mode,
      subscription_id: sub.id,
      period_start: periodStartIso,
      period_end: periodEndIso,
      invoice_id: invoice.id,
      granted_limits: entitlements,
    }, { onConflict: 'company_id,stripe_mode,subscription_id,period_start' });
  if (grantErr) throw new Error(`retryable: period grant: ${grantErr.message}`);

  const operationId = sub.metadata?.operation_id;
  if (operationId) {
    await (admin as UntypedTable)
      .from('custom_billing_operations')
      .update({
        status: 'applied',
        subscription_id: sub.id,
        provider_invoice_id: invoice.id,
        confirmed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', operationId);
  }

  const { error: auditErr } = await admin.from('subscription_events').insert({
    company_id: company.id,
    event_type: 'updated',
    from_plan_code: company.plan_code,
    to_plan_code: company.plan_code,
    from_status: company.subscription_status,
    to_status: internalStatus,
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    stripe_event_created: new Date(event.created * 1000).toISOString(),
    notes: `custom_setup snapshot reconciled (${decoded.lines.length} items, $${(decoded.monthlyCents / 100).toFixed(2)}/mo, capacity ${decoded.capacity})`,
    stripe_payload: eventJson as never,
  });
  if (auditErr) throw new Error(`retryable: subscription_events insert: ${auditErr.message}`);

  return 'ok:custom_setup';
}

/**
 * invoice.payment_succeeded for custom setups: open the paid period grant
 * (once per period — PK company+mode+subscription+period_start, plus
 * UNIQUE(stripe_mode, invoice_id) replay dedupe) from the STORED snapshot
 * limits, and refresh the snapshot's paid-invoice pointer. No-op (ignored)
 * for companies without a custom snapshot, so the hook is safe to call on
 * every invoice.paid.
 */
export async function openCustomPeriodGrant(opts: {
  invoice: Stripe.Invoice;
  company: { id: string };
}): Promise<string> {
  const { invoice, company } = opts;
  const admin = createAdminClient();
  const mode = customStripeMode();
  const nowIso = new Date().toISOString();

  const { data: snap } = await (admin as UntypedTable)
    .from('company_custom_billing')
    .select('stripe_subscription_id, purchased_entitlements')
    .eq('company_id', company.id)
    .eq('stripe_mode', mode)
    .maybeSingle();
  if (!snap) return 'ignored:no_custom_snapshot';

  const invoiceSubRaw = (invoice as unknown as { subscription?: string | { id?: string } | null }).subscription;
  const invoiceSubId = !invoiceSubRaw ? null
    : typeof invoiceSubRaw === 'string' ? invoiceSubRaw
    : typeof invoiceSubRaw === 'object' && typeof invoiceSubRaw.id === 'string' ? invoiceSubRaw.id
    : null;
  if (invoiceSubId && invoiceSubId !== snap.stripe_subscription_id) {
    return 'ignored:stale_invoice_subscription';
  }

  const periodStart = invoice.period_start
    ? new Date(invoice.period_start * 1000).toISOString()
    : new Date(invoice.created * 1000).toISOString();
  const periodEnd = invoice.period_end
    ? new Date(invoice.period_end * 1000).toISOString()
    : new Date((invoice.period_start ?? invoice.created) * 1000 + 31 * 24 * 3600 * 1000).toISOString();

  const { error: grantErr } = await (admin as UntypedTable)
    .from('custom_billing_period_grants')
    .upsert({
      company_id: company.id,
      stripe_mode: mode,
      subscription_id: snap.stripe_subscription_id,
      period_start: periodStart,
      period_end: periodEnd,
      invoice_id: invoice.id,
      granted_limits: snap.purchased_entitlements,
    }, { onConflict: 'company_id,stripe_mode,subscription_id,period_start' });
  if (grantErr) throw new Error(`retryable: period grant upsert: ${grantErr.message}`);

  await (admin as UntypedTable)
    .from('company_custom_billing')
    .update({
      last_paid_invoice_id: invoice.id,
      period_start: periodStart,
      period_end: periodEnd,
      reconciled_at: nowIso,
    })
    .eq('company_id', company.id)
    .eq('stripe_mode', mode);

  return 'ok:custom_period_grant';
}
