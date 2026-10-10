/**
 * Custom-setup (V5 pricing calculator) checkout — server-side.
 *
 * Builds multi-item Stripe Checkout subscriptions from the calculator's
 * PlanIntent. The server is authoritative: the client sends only the opaque
 * serialized setup string; every code, price and amount is re-resolved here
 * against the DB registry (custom_billing_price_map) and the pinned
 * PREVIEW_CATALOG before Stripe is called.
 *
 * Mirrors the legacy createCheckoutSession guards (auth context, demo
 * egress, duplicate-subscription terminal check) and adds the durable
 * per-company operation lock (custom_billing_operations).
 */

import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireStripe } from '@/app/lib/billing/stripe';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { restoreSetup } from '@/app/components/pricing/calculator/persistence';
import { resolveIntent } from '@/app/components/pricing/calculator/routing';
import { expandBillingSelection } from '@/app/components/pricing/calculator/billingCatalogue';

export type CustomCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; code: string; message: string };

/* The custom billing tables are service-role-only and deliberately not added to
   database.types.ts (assistant_v2_* precedent). Query them through an untyped
   handle with local row interfaces for shape safety. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedTable = any;
interface PriceMapRow {
  component_code: string;
  stripe_price_id: string;
  monthly_cents: number;
  currency: string;
  catalog_revision: string;
  available_for_new_setups: boolean;
}

export function customStripeMode(): 'test' | 'live' {
  return process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
}

/**
 * Load the server-owned price registry for the pinned calculator catalogue.
 * Fails closed when the DB registry and the code catalogue disagree — the
 * display calculator and the charge amounts must never drift.
 */
export async function loadCustomPriceMap(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (admin as UntypedTable)
    .from('custom_billing_price_map')
    .select('component_code, stripe_price_id, monthly_cents, currency, catalog_revision, available_for_new_setups')
    .eq('stripe_mode', customStripeMode())
    .eq('catalog_id', PREVIEW_CATALOG.id);
  if (error) throw new Error(`price_map_read_failed: ${error.message}`);
  const typed = (rows ?? null) as PriceMapRow[] | null;
  if (!typed || typed.length !== 14) {
    throw new Error('price_map_incomplete: the custom billing registry does not carry the full 14-price catalogue.');
  }
  const revision = typed[0].catalog_revision;
  if (revision !== PREVIEW_CATALOG.revision) {
    throw new Error('catalog_changed: the pricing catalogue was updated. Re-run the pricing tool and review the new setup.');
  }
  const map = new Map<string, string>();
  for (const row of typed) {
    if (!row.available_for_new_setups) throw new Error(`price_unavailable: ${row.component_code}`);
    if (row.currency !== PREVIEW_CATALOG.currency) throw new Error('price_map_currency_mismatch');
    map.set(row.component_code, row.stripe_price_id);
  }
  return map;
}

/**
 * Validate the serialized calculator setup (same envelope the calculator
 * writes) and expand it to the purchased component selection, verified
 * against the DB registry. Returns the selection + total cents.
 */
export async function expandValidatedSetup(rawSetup: string) {
  const restored = restoreSetup(rawSetup, PREVIEW_CATALOG);
  if (restored.status !== 'restored' && restored.status !== 'updated') {
    const code = restored.status === 'expired' ? 'setup_expired' : 'setup_invalid';
    throw Object.assign(new Error('Your pricing setup could not be restored. Please re-run the pricing tool.'), { code });
  }
  const result = resolveIntent(restored.intent, PREVIEW_CATALOG);
  const selection = expandBillingSelection(result, PREVIEW_CATALOG);
  const map = await loadCustomPriceMap();
  const lineItems = selection.map((row) => {
    const price = map.get(row.code);
    if (!price) throw Object.assign(new Error(`component_not_registered: ${row.code}`), { code: 'setup_invalid' });
    return { price, quantity: 1 as const };
  });
  return { intent: restored.intent, result, selection, lineItems, monthlyCents: result.monthlyCents, operationKey: `checkout:${PREVIEW_CATALOG.revision}:${selection.map(s => s.code).sort().join('+')}` };
}

/**
 * Create (or deliberately supersede) the durable checkout operation row.
 * The partial unique index custom_billing_one_open_change guarantees at
 * most one open checkout per company+mode; a lost race surfaces as a
 * friendly retry error rather than two live Stripe sessions.
 */
async function openCheckoutOperation(companyId: string, userId: string | null, operationKey: string, componentCodes: string[]) {
  const admin = createAdminClient();
  // Deliberately supersede any pending checkout with a different target.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as UntypedTable)
    .from('custom_billing_operations')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('stripe_mode', customStripeMode())
    .eq('kind', 'checkout')
    .eq('status', 'pending')
    .neq('operation_key', operationKey);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insert = await (admin as UntypedTable)
    .from('custom_billing_operations')
    .insert({
      company_id: companyId,
      stripe_mode: customStripeMode(),
      operation_key: operationKey,
      kind: 'checkout',
      status: 'pending',
      catalog_revision: PREVIEW_CATALOG.revision,
      proposed_component_codes: componentCodes,
      requested_by: userId,
    })
    .select('id')
    .single();
  if (insert.error) {
    const msg = insert.error.message.includes('custom_billing_one_open_change')
      ? 'A checkout is already being prepared for your account. Wait a moment and try again.'
      : `operation_lock_failed: ${insert.error.message}`;
    throw Object.assign(new Error(msg), { code: 'checkout_in_progress' });
  }
  return (insert.data as { id: string }).id;
}

/**
 * Full new-customer custom checkout. All state changes land via the Stripe
 * webhook (P5); this only mints a URL and records the operation.
 */
export async function createCustomCheckoutSession(opts: {
  rawSetup: string;
  companyId: string;
  userId: string | null;
  stripeCustomerEmail?: string | null;
  existingStripeCustomerId?: string | null;
  existingStripeSubscriptionId?: string | null;
  existingSubscriptionStatus?: string | null;
  baseUrl: string;
}): Promise<CustomCheckoutResult> {
  let expanded;
  try {
    expanded = await expandValidatedSetup(opts.rawSetup);
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'setup_invalid';
    const message = err instanceof Error ? err.message : 'The pricing setup could not be verified.';
    return { ok: false, code, message };
  }

  // Duplicate-subscription guard, same policy as legacy checkout: a live
  // (non-terminal) subscription routes to manage/portal instead of a second
  // concurrent Checkout. cancel_at_period_end still counts as active.
  const TERMINAL_STATUSES = new Set(['canceled', 'suspended']);
  if (opts.existingStripeSubscriptionId && !TERMINAL_STATUSES.has(opts.existingSubscriptionStatus ?? '')) {
    return {
      ok: false,
      code: 'subscription_exists',
      message: 'You already have an active subscription. Use Manage Subscription to change your setup.',
    };
  }

  const admin = createAdminClient();
  // A stored custom snapshot also blocks a second checkout unless terminal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: custom } = await (admin as UntypedTable)
    .from('company_custom_billing')
    .select('provider_status')
    .eq('company_id', opts.companyId)
    .maybeSingle();
  const customRow = custom as { provider_status: string } | null;
  if (customRow && !TERMINAL_STATUSES.has(customRow.provider_status)) {
    return {
      ok: false,
      code: 'subscription_exists',
      message: 'You already have an active custom setup subscription. Use Manage Subscription to change it.',
    };
  }

  let operationId: string;
  try {
    operationId = await openCheckoutOperation(opts.companyId, opts.userId, expanded.operationKey, expanded.selection.map(s => s.code));
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'operation_lock_failed';
    return { ok: false, code, message: err instanceof Error ? err.message : 'Could not start checkout.' };
  }

  const stripe = requireStripe();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: expanded.lineItems,
      // Anchor: the webhook correlates the session/subscription back to us.
      client_reference_id: opts.companyId,
      subscription_data: {
        metadata: {
          company_id: opts.companyId,
          billing_model: 'custom_setup',
          catalog_id: PREVIEW_CATALOG.id,
          catalog_revision: PREVIEW_CATALOG.revision,
          operation_id: operationId,
        },
      },
      ...(opts.existingStripeCustomerId
        ? { customer: opts.existingStripeCustomerId }
        : { customer_email: opts.stripeCustomerEmail ?? undefined }),
      allow_promotion_codes: true,
      // {CHECKOUT_SESSION_ID} is Stripe's template literal; do NOT interpolate.
      success_url: `${opts.baseUrl}/paywall?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${opts.baseUrl}/paywall?checkout=canceled`,
    }, { idempotencyKey: `custom-checkout-${operationId}` });

    await (admin as UntypedTable)
      .from('custom_billing_operations')
      .update({ provider_checkout_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', operationId);

    if (!session.url) {
      return { ok: false, code: 'no_session_url', message: 'Stripe did not return a Checkout URL.' };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'stripe_checkout_failed';
    console.error('[billing] createCustomCheckoutSession failed:', message);
    await (admin as UntypedTable)
      .from('custom_billing_operations')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', operationId)
      .eq('status', 'pending');
    return { ok: false, code: 'stripe_error', message };
  }
}
