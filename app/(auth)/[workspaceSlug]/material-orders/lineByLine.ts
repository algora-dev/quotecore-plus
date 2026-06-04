// Shared line-by-line order types + helpers.
//
// Line-by-line orders store their lines as one JSON array in
// `material_orders.line_by_line_data` (NOT in `material_order_lines`). This
// keeps the focused order editor fully decoupled from the quote/component
// schema. The shape mirrors the relevant subset of the CustomerQuoteEditor
// line (text / qty / price / visibility) so the visual output matches what
// users already know from quotes — without inheriting its quote/tax/branding
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
 * Parse whatever is stored in `material_orders.line_by_line_data` into a
 * clean, validated LineByLineItem[]. Tolerant of nulls / legacy shapes so a
 * malformed row never crashes a render surface.
 */
export function parseLineByLineData(raw: unknown): LineByLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
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
    return `${line.text} — ${line.quantityText}`;
  }
  return line.text;
}
