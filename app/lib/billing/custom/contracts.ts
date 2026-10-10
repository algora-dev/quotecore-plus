/** Pure billing contracts. No credentials, network calls, UI state or access grants. */
import type { BillingPrice } from '@/app/components/pricing/calculator/billingCatalogue';

export type StripeMode = 'test' | 'live';
export type BillingFamily = BillingPrice['productKey'];
export class BillingContractError extends Error {
  constructor(public readonly code: string, message = code) { super(message); this.name = 'BillingContractError'; }
}
export function insist(condition: unknown, code: string): asserts condition {
  if (!condition) throw new BillingContractError(code);
}
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function referenceId(value: unknown): string | null {
  if (typeof value === 'string' && value.length) return value;
  const id = object(value).id;
  return typeof id === 'string' && id.length ? id : null;
}
/** Support old and Basil+ Invoice shapes. Contradictory identities are not accepted. */
export function invoiceSubscriptionId(value: unknown): string | null {
  const invoice = object(value);
  const oldId = referenceId(invoice.subscription);
  const newId = referenceId(object(object(invoice.parent).subscription_details).subscription);
  insist(!oldId || !newId || oldId === newId, 'conflicting_invoice_subscription');
  return newId ?? oldId;
}
export function isTerminalSubscription(status: string): boolean {
  // A local suspended account is NOT proof Stripe stopped billing it.
  return status === 'canceled' || status === 'incomplete_expired';
}
export function requireMode(value: unknown, mode: StripeMode): void {
  insist(object(value).livemode === (mode === 'live'), 'stripe_mode_mismatch');
}
export function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function sameCodes(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().every((code, i) => code === [...b].sort()[i]);
}
export interface RegistryRow {
  stripe_account_id: string; stripe_mode: StripeMode; catalog_id: string; catalog_revision: string;
  component_code: string; stripe_product_id: string; stripe_price_id: string; currency: string;
  monthly_cents: number; available_for_new_setups: boolean; entitlements: BillingPrice['entitlements'];
}
export interface RegistryScope { accountId: string; mode: StripeMode; catalogId: string; revision: string; currency: string }
export function validateRegistryRows(raw: unknown, scope: RegistryScope): RegistryRow[] {
  insist(Array.isArray(raw), 'price_registry_unavailable');
  const prices = new Set<string>(); const codeVersions = new Set<string>();
  return raw.map(value => {
    const row = object(value);
    insist(row.stripe_account_id === scope.accountId && row.stripe_mode === scope.mode && row.catalog_id === scope.catalogId, 'price_registry_scope_mismatch');
    insist(typeof row.catalog_revision === 'string' && row.catalog_revision.length > 0, 'price_registry_revision_missing');
    insist(typeof row.component_code === 'string' && row.component_code.length > 0, 'price_registry_code_missing');
    insist(typeof row.stripe_price_id === 'string' && /^price_[A-Za-z0-9]+$/.test(row.stripe_price_id), 'price_registry_id_invalid');
    insist(typeof row.stripe_product_id === 'string' && /^prod_[A-Za-z0-9]+$/.test(row.stripe_product_id), 'price_registry_product_invalid');
    insist(typeof row.currency === 'string' && row.currency.toLowerCase() === scope.currency.toLowerCase(), 'price_registry_currency_mismatch');
    insist(nonNegativeInteger(row.monthly_cents), 'price_registry_amount_invalid');
    insist(typeof row.available_for_new_setups === 'boolean', 'price_registry_sale_flag_invalid');
    insist(row.entitlements && typeof row.entitlements === 'object' && !Array.isArray(row.entitlements), 'price_registry_entitlements_invalid');
    const key = `${row.catalog_revision}:${row.component_code}`;
    insist(!prices.has(row.stripe_price_id) && !codeVersions.has(key), 'price_registry_duplicate');
    prices.add(row.stripe_price_id); codeVersions.add(key);
    return row as unknown as RegistryRow;
  });
}
/** New purchases are pinned to the displayed catalogue. Retired rows remain readable. */
export function selectSaleRegistry(rows: RegistryRow[], expected: BillingPrice[], scope: RegistryScope, selectedCodes: string[]): RegistryRow[] {
  const current = rows.filter(row => row.catalog_revision === scope.revision);
  insist(current.length === expected.length, 'price_registry_incomplete');
  const familyProducts = new Map<string, string>();
  for (const expectedRow of expected) {
    const row = current.find(item => item.component_code === expectedRow.code);
    insist(row, 'price_registry_component_missing');
    insist(row.monthly_cents === expectedRow.monthlyCents, 'price_registry_amount_mismatch');
    insist(canonical(row.entitlements) === canonical(expectedRow.entitlements), 'price_registry_entitlements_mismatch');
    const product = familyProducts.get(expectedRow.productKey);
    insist(!product || product === row.stripe_product_id, 'price_registry_family_split');
    familyProducts.set(expectedRow.productKey, row.stripe_product_id);
  }
  insist(new Set(familyProducts.values()).size === familyProducts.size, 'price_registry_product_shared');
  insist(new Set(selectedCodes).size === selectedCodes.length, 'duplicate_selection');
  return selectedCodes.map(code => {
    const row = current.find(item => item.component_code === code);
    insist(row, 'price_registry_component_missing');
    insist(row.available_for_new_setups, 'price_unavailable');
    return row;
  });
}
export function verifyProviderPrice(raw: unknown, row: RegistryRow, sale: boolean): void {
  const price = object(raw); const recurring = object(price.recurring);
  requireMode(price, row.stripe_mode);
  insist(price.id === row.stripe_price_id && referenceId(price.product) === row.stripe_product_id, 'provider_price_identity_mismatch');
  insist(price.currency === row.currency.toLowerCase() && price.unit_amount === row.monthly_cents, 'provider_price_amount_mismatch');
  insist(price.type === 'recurring' && recurring.interval === 'month' && recurring.interval_count === 1 && recurring.usage_type === 'licensed', 'provider_price_interval_mismatch');
  insist(price.billing_scheme === 'per_unit' && price.transform_quantity == null, 'provider_price_shape_unsupported');
  if (sale) insist(price.active === true, 'provider_price_inactive');
}
export interface PurchasedLimits { capacity: 'low'|'medium'|'high'; quotes: number; storageBytes: number; digitalTakeoff: boolean; scanTokens: number; offcuts: boolean; assistantTasks: number }
export function parsePurchasedLimits(raw: unknown): PurchasedLimits {
  const v = object(raw);
  insist(['low','medium','high'].includes(String(v.capacity)), 'snapshot_capacity_invalid');
  for (const key of ['quotes','storageBytes','scanTokens','assistantTasks']) insist(nonNegativeInteger(v[key]), `snapshot_${key}_invalid`);
  insist(typeof v.digitalTakeoff === 'boolean' && typeof v.offcuts === 'boolean', 'snapshot_flags_invalid');
  insist(v.digitalTakeoff || (v.scanTokens === 0 && v.offcuts === false), 'snapshot_tools_incompatible');
  return v as unknown as PurchasedLimits;
}
export const ZERO_LIMITS: PurchasedLimits = { capacity: 'low', quotes: 0, storageBytes: 0, digitalTakeoff: false, scanTokens: 0, offcuts: false, assistantTasks: 0 };
export interface DecodedPurchase {
  codes: string[]; rows: RegistryRow[]; itemIds: string[]; monthlyCents: number;
  limits: PurchasedLimits; periodStart: number; periodEnd: number; revision: string;
}
/** Uses historical registry entitlements, not today's marketing catalogue. */
export function decodeRegisteredItems(rawItems: unknown[], subscription: unknown, rows: RegistryRow[], definitions: BillingPrice[]): DecodedPurchase {
  const sub = object(subscription);
  insist(rawItems.length >= 2 && rawItems.length <= 6, 'subscription_item_count_invalid');
  const families = new Set<BillingFamily>(); const itemIds: string[] = []; const selected: RegistryRow[] = [];
  let start: number | undefined; let end: number | undefined;
  for (const raw of rawItems) {
    const item = object(raw); const priceId = referenceId(item.price);
    const row = rows.find(r => r.stripe_price_id === priceId);
    insist(row, 'unknown_subscription_price');
    const def = definitions.find(d => d.code === row.component_code);
    insist(def && !families.has(def.productKey), 'duplicate_or_unknown_subscription_family');
    insist(item.quantity === 1 && typeof item.id === 'string' && /^si_[A-Za-z0-9]+$/.test(item.id) && !itemIds.includes(item.id), 'subscription_quantity_or_id_invalid');
    verifyProviderPrice(item.price, row, false);
    const s = item.current_period_start ?? sub.current_period_start;
    const e = item.current_period_end ?? sub.current_period_end;
    insist(nonNegativeInteger(s) && nonNegativeInteger(e) && s > 0 && e > s, 'subscription_period_missing');
    insist((start === undefined || start === s) && (end === undefined || end === e), 'subscription_periods_not_aligned');
    start = s; end = e; families.add(def.productKey); itemIds.push(item.id); selected.push(row);
  }
  insist(families.has('core') && families.has('capacity') && (!(families.has('scan') || families.has('offcuts')) || families.has('digital')), 'subscription_prerequisite_missing');
  insist(new Set(selected.map(row => row.catalog_revision)).size === 1, 'subscription_revisions_mixed');
  const byFamily = (family: BillingFamily) => selected.find(row => definitions.find(d => d.code === row.component_code)?.productKey === family);
  // Registry data is server-owned, but malformed entitlements must still fail closed.
  const core = byFamily('core')!; const capacity = byFamily('capacity')!; const scan = byFamily('scan'); const assistant = byFamily('assistant');
  insist(core.entitlements.coreAccess === true, 'core_access_missing');
  if (byFamily('digital')) insist(byFamily('digital')!.entitlements.digitalTakeoff === true, 'digital_flag_invalid');
  if (byFamily('offcuts')) insist(byFamily('offcuts')!.entitlements.offcuts === true, 'offcuts_flag_invalid');
  const limits = parsePurchasedLimits({ capacity: capacity.component_code.replace('capacity_', ''), quotes: capacity.entitlements.quotes,
    storageBytes: capacity.entitlements.storageBytes, digitalTakeoff: families.has('digital'), scanTokens: scan?.entitlements.scanTokens ?? 0,
    offcuts: families.has('offcuts'), assistantTasks: assistant?.entitlements.assistantTasks ?? 0 });
  return { codes: selected.map(r => r.component_code), rows: selected, itemIds, monthlyCents: selected.reduce((total,row) => total + row.monthly_cents, 0),
    limits, periodStart: start!, periodEnd: end!, revision: selected[0].catalog_revision };
}
/** Stable read fence: changing prices/items at the same total is still a change. */
export function purchasedFingerprint(purchase: DecodedPurchase): string {
  return JSON.stringify({
    items: purchase.rows.map((row, index) => ({ item: purchase.itemIds[index], price: row.stripe_price_id, code: row.component_code }))
      .sort((a,b) => a.item.localeCompare(b.item)),
    revision: purchase.revision, start: purchase.periodStart, end: purchase.periodEnd,
    monthlyCents: purchase.monthlyCents, limits: purchase.limits,
  });
}
/** Capacity item periods are not Invoice.period_start/end. Validate actual recurring lines. */
export function verifyPaidPeriod(invoiceRaw: unknown, lines: unknown[], subRaw: unknown, purchase: DecodedPurchase, mode: StripeMode): void {
  const invoice = object(invoiceRaw); const sub = object(subRaw);
  requireMode(invoice, mode); requireMode(sub, mode);
  insist(invoice.status === 'paid' && invoice.amount_remaining === 0, 'invoice_not_paid');
  insist(invoiceSubscriptionId(invoice) === sub.id && referenceId(invoice.customer) === referenceId(sub.customer), 'invoice_ownership_mismatch');
  insist(referenceId(sub.latest_invoice) === invoice.id, 'invoice_not_current');
  insist(['subscription_create','subscription_cycle'].includes(String(invoice.billing_reason)), 'invoice_not_renewal');
  insist(invoice.currency === purchase.rows[0].currency.toLowerCase(), 'invoice_currency_mismatch');
  const seen = new Set<string>();
  for (const rawLine of lines) {
    const line = object(rawLine); const parent = object(object(line.parent).subscription_item_details);
    const itemId = referenceId(parent.subscription_item) ?? referenceId(line.subscription_item);
    if (!itemId) continue; // One-off invoice lines do not mint allowances.
    insist(purchase.itemIds.includes(itemId), 'invoice_contains_other_subscription_item');
    insist(parent.proration !== true && line.proration !== true, 'invoice_contains_proration');
    insist(!seen.has(itemId), 'invoice_duplicate_subscription_item');
    const idx = purchase.itemIds.indexOf(itemId); const row = purchase.rows[idx];
    const linePrice = referenceId(object(object(line.pricing).price_details).price) ?? referenceId(line.price);
    insist(linePrice === row.stripe_price_id && line.quantity === 1, 'invoice_price_mismatch');
    const period = object(line.period);
    insist(period.start === purchase.periodStart && period.end === purchase.periodEnd, 'invoice_period_mismatch');
    seen.add(itemId);
  }
  insist(seen.size === purchase.itemIds.length, 'invoice_items_incomplete');
}
export type ChangeKind = 'none'|'increase'|'decrease'|'mixed';
export function classifyChange(before: PurchasedLimits, after: PurchasedLimits, sameSelection: boolean): ChangeKind {
  if (sameSelection) return 'none';
  const a = [before.quotes, before.storageBytes, +before.digitalTakeoff, before.scanTokens, +before.offcuts, before.assistantTasks];
  const b = [after.quotes, after.storageBytes, +after.digitalTakeoff, after.scanTokens, +after.offcuts, after.assistantTasks];
  const down = b.some((n,i) => n < a[i]); const up = b.some((n,i) => n > a[i]);
  // Same-price/same-limit product replacements still require a reviewed renewal change.
  return down && up ? 'mixed' : down ? 'decrease' : up ? 'increase' : 'mixed';
}
export interface AccessCompany {
  billing_model: string; subscription_status: string; stripe_mode: string | null; stripe_subscription_id: string | null;
  stripe_customer_id: string | null; admin_override_plan_code: string | null; admin_override_until: string | null; comp_until: string | null;
}
export interface AccessSnapshot {
  stripe_account_id: string; stripe_mode: string; stripe_subscription_id: string; stripe_customer_id: string;
  provider_status: string; period_start: string; period_end: string; purchased_entitlements: unknown;
}
export function customAccess(company: AccessCompany, snap: AccessSnapshot | null, scope: { mode: StripeMode; accountId: string }, now = Date.now()) {
  const override = !!company.admin_override_plan_code && Date.parse(company.admin_override_until ?? '') > now;
  const comp = Date.parse(company.comp_until ?? '') > now;
  if (company.billing_model !== 'custom_setup' || override || comp) return { source: 'legacy' as const, limits: null, available: true, reason: override || comp ? 'admin_override' : 'legacy' };
  // Do not infer model from a stale snapshot and never fall back to pro_plus.
  insist(snap, 'custom_snapshot_missing');
  insist(snap.stripe_account_id === scope.accountId && snap.stripe_mode === scope.mode && company.stripe_mode === scope.mode, 'custom_snapshot_mode_mismatch');
  insist(snap.stripe_subscription_id === company.stripe_subscription_id && snap.stripe_customer_id === company.stripe_customer_id, 'custom_snapshot_identity_mismatch');
  const limits = parsePurchasedLimits(snap.purchased_entitlements);
  const start = Date.parse(snap.period_start); const end = Date.parse(snap.period_end);
  insist(Number.isFinite(start) && Number.isFinite(end) && end > start, 'custom_snapshot_period_invalid');
  const lifecycle = ['active','trialing','past_due','disputed'].includes(company.subscription_status) && ['active','trialing','past_due','unpaid','disputed'].includes(snap.provider_status);
  const available = lifecycle && start <= now && now < end;
  return { source: 'custom' as const, limits: available ? limits : { ...ZERO_LIMITS }, available, reason: !lifecycle ? 'lifecycle_restricted' : available ? 'paid_period' : 'paid_period_expired' };
}
