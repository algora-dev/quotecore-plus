/**
 * Shared shapes for the multi-tax system.
 *
 * `company_taxes` are the per-company defaults Shaun sets in /settings.
 * They get snapshotted into `quote_taxes` when a quote is created so editing the
 * company library never retroactively changes already-issued quotes.
 */

export interface CompanyTaxRow {
  id: string;
  company_id: string;
  name: string;
  rate_percent: number;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteTaxRow {
  id: string;
  quote_id: string;
  source_tax_id: string | null;
  name: string;
  rate_percent: number;
  sort_order: number;
  include_in_quote: boolean;
  include_in_labor: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxLine {
  id: string;
  name: string;
  rate_percent: number;
  amount: number;
}

/**
 * Compute per-tax amounts from a subtotal.
 * Returns { lines, total } where each line's amount = subtotal * rate / 100.
 *
 * `audience` decides which include flag we honour:
 *  - "quote": rows where include_in_quote === true
 *  - "labor": rows where include_in_labor === true
 *  - "all":   every row regardless of toggles (used by the editor preview)
 */
export function computeTaxLines(
  taxes: Pick<QuoteTaxRow, 'id' | 'name' | 'rate_percent' | 'include_in_quote' | 'include_in_labor'>[],
  subtotal: number,
  audience: 'quote' | 'labor' | 'all' = 'quote'
): { lines: TaxLine[]; total: number } {
  const filtered = taxes.filter((t) => {
    if (audience === 'quote') return t.include_in_quote;
    if (audience === 'labor') return t.include_in_labor;
    return true;
  });

  const lines: TaxLine[] = filtered.map((t) => ({
    id: t.id,
    name: t.name,
    rate_percent: Number(t.rate_percent) || 0,
    amount: subtotal * ((Number(t.rate_percent) || 0) / 100),
  }));
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { lines, total };
}
