import 'server-only';
import { getStripeMode, requireStripe } from '@/app/lib/billing/stripe';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { BillingContractError, insist, type RegistryScope } from './contracts';

export function customStripeMode() { return getStripeMode(); }
export function customScope(): RegistryScope {
  const mode = getStripeMode();
  insist(mode === 'test' || mode === 'live', 'stripe_mode_invalid');
  const accountId = process.env.CUSTOM_BILLING_STRIPE_ACCOUNT_ID;
  insist(accountId && /^acct_[A-Za-z0-9]+$/.test(accountId), 'custom_billing_account_not_configured');
  return { accountId, mode, catalogId: PREVIEW_CATALOG.id, revision: PREVIEW_CATALOG.revision, currency: PREVIEW_CATALOG.currency };
}
export async function verifyCustomAccount(): Promise<RegistryScope> {
  const scope = customScope();
  const account = await requireStripe().accounts.retrieve(scope.accountId);
  insist(account.id === scope.accountId, 'stripe_account_mismatch');
  return scope;
}
/** Catalogue the payment contract resolves against: test mode is explicitly
 * enabled by its server gate; live mode still requires the catalogue itself
 * to be approved plus the separate launch flag. */
export function paymentCatalog() {
  return customStripeMode() === 'test' ? { ...PREVIEW_CATALOG, stage: 'approved' as const } : PREVIEW_CATALOG;
}
/** Kill switch affects new purchases only. Existing renewal processing must continue. */
export function requireCustomCheckoutEnabled(): void {
  if (process.env.CUSTOM_BILLING_CHECKOUT_ENABLED !== 'true') {
    throw new BillingContractError('custom_checkout_disabled', 'Custom setup checkout is not available yet. No payment has been taken.');
  }
  if (getStripeMode() === 'live' && (process.env.CUSTOM_BILLING_LIVE_APPROVED !== 'true' || PREVIEW_CATALOG.stage !== 'approved')) {
    throw new BillingContractError('custom_live_not_approved', 'Custom setup checkout is not approved for live payments yet.');
  }
}

/** True when the V5 calculator pricing model replaces legacy plan pricing on
 *  this deployment (testing cutover, owner decision 2026-10-11: no legacy
 *  pricing anywhere on testing, regardless of entry path). Main keeps the
 *  legacy plan surfaces until the cutover decision. */
export function customPricingOnly(): boolean {
  return process.env.CUSTOM_BILLING_CHECKOUT_ENABLED === 'true';
}
