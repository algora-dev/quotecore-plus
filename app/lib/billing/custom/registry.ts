import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireStripe } from '@/app/lib/billing/stripe';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { buildBillingCatalogue } from '@/app/components/pricing/calculator/billingCatalogue';
import { customScope } from './environment';
import { validateRegistryRows, selectSaleRegistry, verifyProviderPrice, type RegistryScope } from './contracts';

// Custom tables have not yet been generated into the host database types.
export async function loadRecognitionRegistry(scope: RegistryScope = customScope()) {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from('custom_billing_price_map').select('*')
    .eq('stripe_account_id', scope.accountId).eq('stripe_mode', scope.mode).eq('catalog_id', scope.catalogId);
  if (error) throw new Error(`retryable: custom price registry read failed: ${error.message}`);
  return validateRegistryRows(data ?? [], scope);
}
export async function loadSaleRegistry(codes: string[], scope: RegistryScope = customScope()) {
  const rows = await loadRecognitionRegistry(scope);
  const selected = selectSaleRegistry(rows, buildBillingCatalogue(PREVIEW_CATALOG), scope, codes);
  const stripe = requireStripe();
  await Promise.all(selected.map(async row => verifyProviderPrice(await stripe.prices.retrieve(row.stripe_price_id), row, true)));
  return selected;
}
/** Compatibility export for read-only adapters. Does not approve a sale. */
export async function loadCustomPriceMap() {
  const scope = customScope();
  const rows = await loadRecognitionRegistry(scope);
  return new Map(rows.filter(row => row.catalog_revision === scope.revision).map(row => [row.component_code, row.stripe_price_id]));
}
