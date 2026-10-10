/** Durable, recoverable new-customer Checkout. Existing subscriptions are never changed here. */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireStripe } from '@/app/lib/billing/stripe';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { restoreSetup } from '@/app/components/pricing/calculator/persistence';
import { resolveIntent } from '@/app/components/pricing/calculator/routing';
import { expandBillingSelection } from '@/app/components/pricing/calculator/billingCatalogue';
import { BillingContractError, insist, isTerminalSubscription, referenceId, requireMode } from './contracts';
import { verifyCustomAccount, requireCustomCheckoutEnabled, customStripeMode } from './environment';
import { loadSaleRegistry, loadCustomPriceMap } from './registry';
export { customStripeMode, loadCustomPriceMap };
export type CustomCheckoutResult = { ok: true; url: string } | { ok: false; code: string; message: string };

export async function expandValidatedSetup(rawSetup: string) {
  insist(typeof rawSetup === 'string' && rawSetup.length <= 4096, 'setup_invalid');
  const restored = restoreSetup(rawSetup, PREVIEW_CATALOG);
  if (restored.status === 'updated') throw new BillingContractError('catalog_changed', 'The catalogue changed. Review your setup again before paying.');
  insist(restored.status === 'restored', restored.status === 'expired' ? 'setup_expired' : 'setup_invalid');
  // Test Checkout is explicitly enabled by its server gate. Never mutate the shared UI catalogue.
  // Live payments still require PREVIEW_CATALOG.stage='approved' plus the separate launch flag.
  const serverCatalog = customStripeMode() === 'test' ? { ...PREVIEW_CATALOG, stage: 'approved' as const } : PREVIEW_CATALOG;
  const result = resolveIntent(restored.intent, serverCatalog);
  const selection = expandBillingSelection(result, PREVIEW_CATALOG);
  const registry = await loadSaleRegistry(selection.map(row => row.code));
  return { intent: restored.intent, result, selection, lineItems: registry.map(row => ({ price: row.stripe_price_id, quantity: 1 as const })),
    monthlyCents: result.monthlyCents, operationKey: `${PREVIEW_CATALOG.id}:${PREVIEW_CATALOG.revision}:${selection.map(row => row.code).sort().join('+')}` };
}
interface CheckoutOperation {
  id: string; selection_key: string; status: string; checkout_request: Record<string, unknown> | null;
  provider_checkout_id: string | null; created_at: string; lease_token: string; previous_subscription_id: string | null;
}
function publicFailure(error: unknown): CustomCheckoutResult {
  const code = error instanceof BillingContractError ? error.code : 'checkout_retry_required';
  const messages: Record<string, string> = {
    subscription_exists: 'You already have a subscription. Manage that subscription instead of paying for a second one.',
    checkout_busy: 'Checkout is already being prepared. Try again in a moment.',
    checkout_completed: 'Your payment is being confirmed. Return to Billing rather than starting another checkout.',
    checkout_recovery_required: 'An earlier checkout needs to be checked by our team before another can start. No new checkout was created.',
    catalog_changed: 'The catalogue changed. Review your setup again before paying.',
    setup_expired: 'Your saved setup expired. Review your choices again.',
    setup_invalid: 'Your saved setup could not be verified. Review your choices again.',
    custom_checkout_disabled: 'Custom setup checkout is not available yet. No payment has been taken.',
    custom_live_not_approved: 'Custom setup checkout is not approved for live payments yet.',
    company_mode_mismatch: 'This billing account belongs to a different environment. Contact our team.',
  };
  return { ok: false, code, message: messages[code] ?? 'Checkout could not be confirmed. Please retry the same setup. Our team can help if this continues.' };
}
/** Updates are fenced by the operation lease. Never silently ignore a DB failure. */
async function saveOperation(id: string, lease: string, update: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient() as any).from('custom_billing_operations')
    .update({ ...update, updated_at: new Date().toISOString() }).eq('id', id).eq('lease_token', lease).eq('status', 'pending').select('id');
  if (error) throw new Error(`retryable: checkout operation update failed: ${error.message}`);
  insist(data?.length === 1, 'checkout_busy');
}
export async function createCustomCheckoutSession(opts: {
  rawSetup: string; companyId: string; userId: string | null; baseUrl: string;
  stripeCustomerEmail?: string | null; existingStripeCustomerId?: string | null;
  existingStripeSubscriptionId?: string | null; existingSubscriptionStatus?: string | null;
}): Promise<CustomCheckoutResult> {
  try {
    requireCustomCheckoutEnabled();
    const scope = await verifyCustomAccount(); const stripe = requireStripe(); const admin = createAdminClient();
    // Fresh identity, not caller-supplied subscription status. Mode separation matters on the shared DB.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: company, error } = await (admin as any).from('companies')
      .select('id, billing_model, stripe_mode, stripe_customer_id, stripe_subscription_id, subscription_status, admin_paused')
      .eq('id', opts.companyId).maybeSingle();
    if (error) throw new Error(`retryable: company read: ${error.message}`);
    insist(company && !company.admin_paused, 'company_unavailable');
    insist(!company.stripe_mode || company.stripe_mode === scope.mode, 'company_mode_mismatch');
    if (company.stripe_subscription_id) {
      const current = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
      requireMode(current, scope.mode);
      insist(!company.stripe_customer_id || referenceId(current.customer) === company.stripe_customer_id, 'subscription_ownership_mismatch');
      insist(isTerminalSubscription(current.status), 'subscription_exists');
    }
    if (company.stripe_customer_id) {
      // Also catch a provider subscription that has not reached our webhook yet.
      for await (const subscription of stripe.subscriptions.list({ customer: company.stripe_customer_id, status: 'all', limit: 100 })) {
        requireMode(subscription, scope.mode);
        insist(isTerminalSubscription(subscription.status), 'subscription_exists');
      }
    }
    const expanded = await expandValidatedSetup(opts.rawSetup);
    const origin = new URL(opts.baseUrl);
    insist(origin.origin === opts.baseUrl && !origin.username && !origin.password &&
      (origin.protocol === 'https:' || (scope.mode === 'test' && origin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(origin.hostname))), 'checkout_origin_invalid');
    const request = {
      mode: 'subscription', line_items: expanded.lineItems, client_reference_id: company.id,
      ...(company.stripe_customer_id ? { customer: company.stripe_customer_id } : { customer_email: opts.stripeCustomerEmail ?? undefined }),
      allow_promotion_codes: true,
      success_url: `${origin.origin}/paywall?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.origin}/paywall?checkout=canceled`,
      subscription_data: { metadata: { company_id: company.id, billing_model: 'custom_setup', catalog_id: scope.catalogId, catalog_revision: scope.revision } },
    };
    // At most one old session can be recovered and expired before claiming a fresh operation.
    for (let attempt = 0; attempt < 3; attempt++) {
      const lease = randomUUID();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: claimError } = await (admin as any).rpc('qcp_claim_custom_checkout', {
        p_company_id: company.id, p_mode: scope.mode, p_selection_key: expanded.operationKey,
        p_request: JSON.parse(JSON.stringify(request)), p_codes: expanded.selection.map(row => row.code),
        p_revision: scope.revision, p_user_id: opts.userId, p_lease: lease,
        p_previous_subscription_id: company.stripe_subscription_id ?? null,
      });
      if (claimError) throw new Error(`retryable: checkout claim: ${claimError.message}`);
      if (data?.code) throw new BillingContractError(data.code);
      const op = data as CheckoutOperation;
      insist(op?.id && op.checkout_request, 'checkout_recovery_required');
      let session;
      if (op.provider_checkout_id) session = await stripe.checkout.sessions.retrieve(op.provider_checkout_id);
      else {
        // Never replay an uncertain create after Stripe may have pruned its idempotency key.
        insist(Date.now() - Date.parse(op.created_at) < 23 * 60 * 60 * 1000, 'checkout_recovery_required');
        const frozen = op.checkout_request;
        const subscriptionData = frozen.subscription_data as { metadata: Record<string, string> };
        session = await stripe.checkout.sessions.create({ ...frozen,
          subscription_data: { ...subscriptionData, metadata: { ...subscriptionData.metadata, operation_id: op.id } },
          metadata: { company_id: company.id, billing_model: 'custom_setup', operation_id: op.id },
        // The frozen request is validated before claim and can only be written by the service role.
        } as Parameters<typeof stripe.checkout.sessions.create>[0], { idempotencyKey: `custom-checkout-${op.id}` });
        await saveOperation(op.id, lease, { provider_checkout_id: session.id });
      }
      requireMode(session, scope.mode);
      insist(session.mode === 'subscription' && session.client_reference_id === company.id, 'checkout_identity_mismatch');
      if (session.status === 'complete') {
        // An expired initial payment may leave a completed Checkout behind.
        // Only provider-terminal state permits another attempt. A merely local
        // suspended/canceled flag or unpaid invoice is not sufficient proof.
        const priorSubId = referenceId(session.subscription);
        insist(priorSubId, 'checkout_completed');
        const priorSub = await stripe.subscriptions.retrieve(priorSubId);
        requireMode(priorSub, scope.mode);
        insist(priorSub.metadata?.company_id === company.id, 'checkout_identity_mismatch');
        insist(isTerminalSubscription(priorSub.status), 'checkout_completed');
        await saveOperation(op.id, lease, { status: 'canceled', lease_token: null, lease_until: null });
        continue;
      }
      if (session.status === 'open' && op.selection_key === expanded.operationKey) {
        insist(typeof session.url === 'string' && session.url.startsWith('https://'), 'checkout_url_missing');
        await saveOperation(op.id, lease, { lease_token: null, lease_until: null });
        return { ok: true, url: session.url };
      }
      if (session.status === 'open') {
        // Do NOT release the DB lock while the previous session can still accept payment.
        session = await stripe.checkout.sessions.expire(session.id);
      }
      insist(session.status === 'expired', 'checkout_completed');
      await saveOperation(op.id, lease, { status: 'canceled', lease_token: null, lease_until: null });
    }
    throw new BillingContractError('checkout_busy');
  } catch (error) {
    console.error('[billing/custom] checkout stopped:', error instanceof Error ? error.message : 'unknown');
    // Do not mark uncertain Stripe outcomes failed or open a second operation. A retry recovers the SAME request.
    return publicFailure(error);
  }
}
