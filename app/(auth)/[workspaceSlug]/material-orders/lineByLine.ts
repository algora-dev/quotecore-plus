// Shared line-by-line order types + helpers.
//
// Line-by-line orders store their lines as one JSON array in
// `material_orders.line_by_line_data` (NOT in `material_order_lines`). This
// keeps the focused order editor fully decoupled from the quote/component
// schema. The shape mirrors the relevant subset of the CustomerQuoteEditor
// line (text / qty / price / visibility) so the visual output matches what
// users already know from quotes - without inheriting its quote/tax/branding
// coupling.

export interface LineByLineItem {
  id: string;
  /** Primary text shown on the order line (e.g. item name / description). */
  text: string;
  /** Optional secondary text appended after the primary (qty, pack size, etc.). Null = none. */
  quantityText: string | null;
  /** Line amount/price. */
  amount: number;
  /** Whether the price is shown on this line. */
  showPrice: boolean;
  /** Whether the line is rendered at all (hidden lines are kept but not shown/totaled). */
  isVisible: boolean;
  /** Whether this line's amount contributes to the order total. */
  includeInTotal: boolean;
  sortOrder: number;
}

/**
 * Optional tax applied to a line-by-line order. Mirrors the minimal subset of
 * the quote tax model the order needs. Default = NO taxes (empty array); the
 * user opts in by adding a custom tax or applying a company default.
 */
export interface LineByLineTax {
  id: string;
  /** When sourced from a company default tax, the originating tax id. */
  sourceTaxId: string | null;
  name: string;
  ratePercent: number;
}

export interface LineByLineTaxLine {
  id: string;
  name: string;
  ratePercent: number;
  amount: number;
}

/**
 * Full saved state for a line-by-line order, persisted as one JSON object in
 * `material_orders.line_by_line_data`. To stay backward compatible with the
 * original bare-array shape (Phase 1), the parser below accepts EITHER:
 *   - a bare LineByLineItem[]  (legacy), OR
 *   - { lines, footer, taxes } (current envelope).
 */
export interface LineByLineData {
  lines: LineByLineItem[];
  /** Free-text footer rendered under the items (terms, notes). */
  footer: string;
  /** Optional taxes (default none). */
  taxes: LineByLineTax[];
  /**
   * Master "hide all prices" override. When true, NO pricing renders on ANY
   * surface (in-app preview, public supplier page, print/PDF) - no per-line
   * price, no subtotal, no tax lines, no total - regardless of each line's own
   * showPrice flag. Default false (honour per-line showPrice). Persisted so the
   * saved/sent order matches what the user chose in the editor.
   */
  hideAllPrices: boolean;
}

/**
 * Parse whatever is stored in `material_orders.line_by_line_data` into a
 * clean, validated LineByLineItem[]. Tolerant of nulls / legacy shapes so a
 * malformed row never crashes a render surface.
 */
export function parseLineByLineData(raw: unknown): LineByLineItem[] {
  // Accept both the legacy bare array and the current envelope shape.
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { lines?: unknown }).lines)
      ? (raw as { lines: unknown[] }).lines
      : null;
  if (!arr) return [];
  return arr
    .map((r, i): LineByLineItem | null => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const text = typeof o.text === 'string' ? o.text : '';
      const amountNum = typeof o.amount === 'number' ? o.amount : Number(o.amount);
      return {
        id: typeof o.id === 'string' && o.id ? o.id : `line-${i}`,
        text,
        quantityText:
          typeof o.quantityText === 'string' && o.quantityText.trim() !== ''
            ? o.quantityText
            : null,
        amount: Number.isFinite(amountNum) ? amountNum : 0,
        showPrice: o.showPrice !== false,
        isVisible: o.isVisible !== false,
        includeInTotal: o.includeInTotal !== false,
        sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : i,
      };
    })
    .filter((x): x is LineByLineItem => x !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Total of all visible lines flagged to include in the total. */
export function lineByLineTotal(lines: LineByLineItem[]): number {
  return lines
    .filter((l) => l.isVisible && l.includeInTotal)
    .reduce((sum, l) => sum + (Number.isFinite(l.amount) ? l.amount : 0), 0);
}

/** Combined display text for a line (primary + optional secondary). */
export function lineDisplayText(line: LineByLineItem): string {
  if (line.quantityText && line.quantityText.trim() !== '') {
    return `${line.text} - ${line.quantityText}`;
  }
  return line.text;
}

/** Parse the footer string from whatever is stored (envelope only; legacy = none). */
export function parseLineByLineFooter(raw: unknown): string {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const f = (raw as { footer?: unknown }).footer;
    return typeof f === 'string' ? f : '';
  }
  return '';
}

/** Parse the master hide-all-prices flag (envelope only; legacy = false). */
export function parseLineByLineHideAllPrices(raw: unknown): boolean {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return (raw as { hideAllPrices?: unknown }).hideAllPrices === true;
  }
  return false;
}

/** Parse the optional taxes array (envelope only; legacy = none). */
export function parseLineByLineTaxes(raw: unknown): LineByLineTax[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const t = (raw as { taxes?: unknown }).taxes;
  if (!Array.isArray(t)) return [];
  return t
    .map((r, i): LineByLineTax | null => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const rate = typeof o.ratePercent === 'number' ? o.ratePercent : Number(o.ratePercent);
      const name = typeof o.name === 'string' ? o.name : '';
      if (!name.trim()) return null;
      return {
        id: typeof o.id === 'string' && o.id ? o.id : `tax-${i}`,
        sourceTaxId: typeof o.sourceTaxId === 'string' ? o.sourceTaxId : null,
        name,
        ratePercent: Number.isFinite(rate) ? rate : 0,
      };
    })
    .filter((x): x is LineByLineTax => x !== null);
}

/** Parse the full envelope (lines + footer + taxes) from the JSON column. */
export function parseLineByLineEnvelope(raw: unknown): LineByLineData {
  return {
    lines: parseLineByLineData(raw),
    footer: parseLineByLineFooter(raw),
    taxes: parseLineByLineTaxes(raw),
    hideAllPrices: parseLineByLineHideAllPrices(raw),
  };
}

/** Compute per-tax amounts off the included-in-total subtotal. */
export function computeLineByLineTaxes(
  subtotal: number,
  taxes: LineByLineTax[],
): { taxLines: LineByLineTaxLine[]; taxTotal: number } {
  const taxLines = taxes.map((t) => ({
    id: t.id,
    name: t.name,
    ratePercent: t.ratePercent,
    amount: Math.round(subtotal * (t.ratePercent / 100) * 100) / 100,
  }));
  const taxTotal = taxLines.reduce((s, l) => s + l.amount, 0);
  return { taxLines, taxTotal };
}
