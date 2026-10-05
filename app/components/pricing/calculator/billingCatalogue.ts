import type { CalculatorCatalog, Calculation, UsageTier } from './types';
import { assertCatalog } from './validation';
import { resolveIntent } from './routing';

export const BILLING_PRODUCTS = [
  { key: 'core', name: 'QuoteCore+ Core', description: 'Core access for turning measurements into prices and quotes.' },
  { key: 'capacity', name: 'QuoteCore+ Capacity', description: 'Monthly quote allowance and active account storage.' },
  { key: 'digital', name: 'Digital Takeoff', description: 'Measure directly from digital plans and use the measurements to price jobs.' },
  { key: 'scan', name: 'Roof Scan Assist · Beta', description: 'Find roof outlines and roofing details for you to check and confirm.' },
  { key: 'offcuts', name: 'Offcut Optimiser', description: 'Estimate real-world long-run roofing material use from cut lengths and reusable offcuts.' },
  { key: 'assistant', name: 'Smart Assistant · V1 Beta', description: 'Create, edit and send quotes and handle everyday tasks by text or voice.' },
] as const;
export type BillingProductKey = typeof BILLING_PRODUCTS[number]['key'];
export interface BillingPrice {
  code: string;
  productKey: BillingProductKey;
  productName: string;
  priceLabel: string;
  description: string;
  monthlyCents: number;
  currency: 'USD' | 'NZD';
  interval: 'month';
  lookupKey: string;
  tier?: UsageTier | 'light' | 'regular' | 'heavy';
  entitlements: { coreAccess?: true; quotes?: number; storageBytes?: number; digitalTakeoff?: true; scanTokens?: number; offcuts?: true; assistantTasks?: number };
}
export type StripePriceMap = Record<string, string>;
export interface SubscriptionItem { id: string; priceId: string; quantity: number }
export interface CompleteSubscriptionItems { complete: boolean; items: SubscriptionItem[] }
export type ItemChange = { price: string; quantity: 1; id?: string } | { id: string; deleted: true };
const TIERS = ['low', 'medium', 'high'] as const;
const LABELS = { low: 'Low', medium: 'Medium', high: 'High', light: 'Light', regular: 'Regular', heavy: 'Heavy' } as const;
/** Suggested trade-flavoured labels only. They do NOT imply staff count or skill. */
export const CAPACITY_ALIASES = { low: 'Toolbox', medium: 'Workbench', high: 'Workshop' } as const;

/** The UI retains 13 V3 selection codes. Stripe uses 14 prices across six products:
 * split its single core_low/medium/high line into core_access + capacity_X. */
export function buildBillingCatalogue(c: CalculatorCatalog): BillingPrice[] {
  assertCatalog(c);
  const rows: BillingPrice[] = [];
  function add(key: BillingProductKey, code: string, monthlyCents: number, priceLabel: string, description: string,
    entitlements: BillingPrice['entitlements'], tier?: BillingPrice['tier']) {
    const product = BILLING_PRODUCTS.find(p => p.key === key)!;
    rows.push({ code, productKey: key, productName: product.name, priceLabel, description, monthlyCents,
      currency: c.currency, interval: 'month', lookupKey: `qcp_${code}_${c.currency.toLowerCase()}_monthly_v4`, entitlements, ...(tier ? { tier } : {}) });
  }
  add('core', 'core_access', c.baseMonthlyCents, 'Monthly core access', BILLING_PRODUCTS[0].description, { coreAccess: true });
  for (const tier of TIERS) {
    const row = c.core[tier];
    add('capacity', `capacity_${tier}`, row.capacityCents, `${LABELS[tier]} capacity`,
      `${row.quotes} quotes per billing month and ${row.storageBytes / 1e9} GB active storage.`, { quotes: row.quotes, storageBytes: row.storageBytes }, tier);
  }
  add('digital', c.digital.code, c.digital.monthlyCents, 'Digital Takeoff', BILLING_PRODUCTS[2].description, { digitalTakeoff: true });
  for (const tier of TIERS) {
    const row = c.scan[tier];
    add('scan', row.code, row.monthlyCents, `${LABELS[tier]} · ${row.tokens} Scan Tokens`,
      `${row.tokens} Scan Tokens per billing month. Two scans normally cover a roof plan; review every result.`, { scanTokens: row.tokens }, tier);
  }
  for (const tier of TIERS) {
    const row = c.offcuts[tier];
    add('offcuts', row.code, row.monthlyCents, `${LABELS[tier]} workload`,
      `Offcut optimisation with Digital Takeoff, priced for ${tier} stated workload. No per-optimisation charge.`, { offcuts: true }, tier);
  }
  for (const tier of ['light', 'regular', 'heavy'] as const) {
    const row = c.assistant[tier];
    add('assistant', row.code, row.monthlyCents, `${LABELS[tier]} · ${row.tasks.toLocaleString('en-US')} Assistant Tasks`,
      `${row.tasks.toLocaleString('en-US')} Assistant Tasks per billing month. One use is one task or request.`, { assistantTasks: row.tasks }, tier);
  }
  if (rows.length !== 14 || new Set(rows.map(r => r.code)).size !== 14) throw new Error('Billing component codes must be unique.');
  return rows;
}
/** Pure expansion only. Payment callers must resolveIntent against the SERVER first. */
export function expandBillingSelection(result: Calculation, c: CalculatorCatalog): BillingPrice[] {
  const codes = ['core_access', `capacity_${result.selectedCapacity}`];
  if (result.digitalEnabled) codes.push(c.digital.code);
  if (result.scanEnabled) codes.push(c.scan[result.selectedScan].code);
  if (result.offcutsEnabled) codes.push(c.offcuts[result.usage].code);
  if (result.selectedAssistant !== 'none') codes.push(c.assistant[result.selectedAssistant].code);
  const rows = buildBillingCatalogue(c);
  const selected = codes.map(code => {
    const row = rows.find(r => r.code === code);
    if (!row) throw new Error('Unknown billing component.');
    return row;
  });
  if (selected.reduce((n,r) => n+r.monthlyCents, 0) !== result.monthlyCents) throw new Error('Billing expansion does not match the resolved subtotal.');
  return selected;
}
export function validateStripePriceMap(map: StripePriceMap, c: CalculatorCatalog): void {
  const rows = buildBillingCatalogue(c);
  const values = rows.map(row => map?.[row.code]);
  if (!map || Object.keys(map).length !== rows.length || values.some(v => typeof v !== 'string' || !/^price_[A-Za-z0-9]+$/.test(v)) || new Set(values).size !== rows.length) {
    throw new Error('Configure 14 distinct server-owned Stripe Price IDs for this catalogue.');
  }
}
/** No Stripe SDK or network side effects. The authenticated host creates ONE Checkout
 * Session in subscription mode with these 2–6 recurring items, quantity 1 each. */
export function buildCheckoutLineItems(intent: unknown, serverCatalog: CalculatorCatalog, serverMap: StripePriceMap): { price: string; quantity: 1 }[] {
  const result = resolveIntent(intent, serverCatalog);
  validateStripePriceMap(serverMap, serverCatalog);
  return expandBillingSelection(result, serverCatalog).map(r => ({ price: serverMap[r.code], quantity: 1 as const }));
}
/** Consume only a complete list retrieved by your server from Stripe. Unknown/legacy
 * prices, duplicate products, partial pagination and quantities other than one fail closed.
 * This decodes purchased components, NOT payment status or workspace authorization. */
export function decodeSubscriptionItems(snapshot: CompleteSubscriptionItems, c: CalculatorCatalog, map: StripePriceMap) {
  validateStripePriceMap(map, c);
  if (snapshot?.complete !== true || !Array.isArray(snapshot.items) || snapshot.items.length < 2 || snapshot.items.length > 6) throw new Error('A complete subscription item list is required.');
  const rows = buildBillingCatalogue(c);
  const seen = new Set<BillingProductKey>(); const ids = new Set<string>();
  const lines = snapshot.items.map(item => {
    const row = rows.find(r => map[r.code] === item.priceId);
    if (!row || item.quantity !== 1 || !/^si_[A-Za-z0-9]+$/.test(item.id) || ids.has(item.id) || seen.has(row.productKey)) throw new Error('Unsupported or duplicate subscription component.');
    ids.add(item.id); seen.add(row.productKey);
    return { ...row, itemId: item.id, priceId: item.priceId };
  });
  if (!seen.has('core') || !seen.has('capacity') || ((seen.has('scan') || seen.has('offcuts')) && !seen.has('digital'))) throw new Error('Subscription components are incompatible or incomplete.');
  const capacity = lines.find(l => l.productKey === 'capacity')!;
  const scan = lines.find(l => l.productKey === 'scan');
  const assistant = lines.find(l => l.productKey === 'assistant');
  return {
    lines, monthlyCents: lines.reduce((n,r) => n+r.monthlyCents, 0),
    capacity: capacity.tier as UsageTier, digitalTakeoff: seen.has('digital'), offcuts: seen.has('offcuts'),
    limits: { quotes: capacity.entitlements.quotes!, storageBytes: capacity.entitlements.storageBytes!,
      scanTokens: scan?.entitlements.scanTokens ?? 0, assistantTasks: assistant?.entitlements.assistantTasks ?? 0 },
    // Adapter for the existing CurrentSubscription UI prop, NOT a billing grant.
    calculatorComponentCodes: [c.core[capacity.tier as UsageTier].code, ...lines.filter(l => !['core','capacity'].includes(l.productKey)).map(l => l.code)],
  };
}
/** Replace by subscription ITEM ID. Never add a new allowance alongside the old one.
 * Does NOT choose proration/payment behavior, submit a change, reset counters or grant access. */
export function buildSubscriptionItemChanges(snapshot: CompleteSubscriptionItems, intent: unknown, c: CalculatorCatalog, map: StripePriceMap): ItemChange[] {
  const result = resolveIntent(intent, c);
  const current = decodeSubscriptionItems(snapshot, c, map);
  const wanted = expandBillingSelection(result, c);
  const changes: ItemChange[] = [];
  for (const old of current.lines) {
    const next = wanted.find(r => r.productKey === old.productKey);
    if (!next) changes.push({ id: old.itemId, deleted: true });
    else if (map[next.code] !== old.priceId) changes.push({ id: old.itemId, price: map[next.code], quantity: 1 });
  }
  for (const next of wanted) if (!current.lines.some(r => r.productKey === next.productKey)) changes.push({ price: map[next.code], quantity: 1 });
  return changes;
}
