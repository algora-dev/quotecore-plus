/** Read-only adapter to the SAME engines as the summary and customer document. */
import { computeQuoteTotals, type QuoteComponent } from '@/app/lib/pricing/engine';
import { computeTaxLines } from '@/app/lib/taxes/types';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { isRecord } from '../section-permissions';

function number(value: unknown, nullable = false): number {
  if (value === null && nullable) return 0;
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !Number.isFinite(Number(value))) {
    throw new Error('Incomplete or invalid financial snapshot');
  }
  return Number(value);
}
function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error('Incomplete financial snapshot');
  return value;
}
export function quoteTotalsFromSnapshot(value: unknown): { answer: string; complete: boolean; asOf: string } {
  if (!isRecord(value) || typeof value.as_of !== 'string') throw new Error('Invalid financial snapshot');
  if (value.complete !== true) return { answer: 'This quote is too large for the bounded assistant total reader. Open the quote to verify its totals; I have not calculated a partial total.', complete: false, asOf: value.as_of };
  if (!isRecord(value.quote)) throw new Error('Missing quote');
  const quote = value.quote;
  if (typeof value.default_currency !== 'string' || (quote.currency !== null && typeof quote.currency !== 'string')) throw new Error('Missing currency');
  const currency = getEffectiveCurrency(quote.currency as string | null, value.default_currency);
  const money = (amount: number) => {
    if (!Number.isFinite(amount)) throw new Error('Invalid computed amount');
    return `${currency} ${formatCurrency(amount, currency)}`;
  };
  const taxes = rows(value.taxes).map(row => {
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.include_in_quote !== 'boolean' || typeof row.include_in_labor !== 'boolean') throw new Error('Invalid tax row');
    return { id: row.id, name: row.name, rate_percent: number(row.rate_percent), include_in_quote: row.include_in_quote, include_in_labor: row.include_in_labor };
  });
  const lines = rows(value.lines).map(row => {
    if (typeof row.include_in_total !== 'boolean' || typeof row.is_visible !== 'boolean' || typeof row.line_type !== 'string') throw new Error('Invalid customer line');
    return { line_type: row.line_type, is_visible: row.is_visible, include_in_total: row.include_in_total, amount: number(row.custom_amount, true) };
  });
  const parts: string[] = [];
  if (value.components !== null) {
    // computeQuoteTotals consumes stored costs only. This narrow projection avoids
    // loading geometry or reimplementing the unchanged pricing-engine formula.
    const components = rows(value.components).map(row => ({ materialCost: number(row.material_cost, true), labourCost: number(row.labour_cost, true) })) as QuoteComponent[];
    const totals = computeQuoteTotals(components, { materialMarginPct: number(quote.material_margin_percent, true), labourMarginPct: number(quote.labor_margin_percent, true), taxRate: number(quote.tax_rate, true) });
    const custom = lines.filter(l => l.line_type === 'custom' && l.is_visible && l.include_in_total).reduce((sum, l) => sum + l.amount, 0);
    const subtotal = totals.subtotalWithMargins + custom;
    const total = subtotal + computeTaxLines(taxes, subtotal, 'quote').total;
    parts.push(`Builder summary total (current, including quote taxes): ${money(total)}.`);
  } else parts.push('Builder total unavailable because Components is hidden.');
  if (lines.length) {
    // Existing customer document/send adapter: included saved amounts + tax list,
    // with legacy tax-rate fallback only when no quote-tax rows exist.
    const subtotal = lines.filter(l => l.include_in_total).reduce((sum, l) => sum + l.amount, 0);
    const legacyRate = number(quote.tax_rate, true);
    const tax = taxes.length ? computeTaxLines(taxes, subtotal, 'quote').total : legacyRate > 0 ? subtotal * legacyRate : 0;
    parts.push(`Saved customer quote total (including tax): ${money(subtotal + tax)}.`);
  } else parts.push('No saved customer quote total exists yet.');
  return { answer: parts.join('\n'), complete: true, asOf: value.as_of };
}
