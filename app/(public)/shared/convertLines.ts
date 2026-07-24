/**
 * Shared helper for passing line items between free document generators
 * via URL params. Used by the "Convert to Order" / "Convert to Invoice"
 * buttons to transfer all line items, not just the total amount.
 */

export interface ConvertibleLine {
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

/**
 * Encode line items + client name into URL params for cross-tool conversion.
 * Returns a query string like: ?amount=425&client=John&lines=...&ref=...
 */
export function buildConvertUrl(opts: {
  targetPath: string;
  amount: number;
  clientName?: string;
  lines: ConvertibleLine[];
  ref: string;
}): string {
  const params = new URLSearchParams();
  params.set('amount', opts.amount.toFixed(2));
  if (opts.clientName) params.set('client', opts.clientName);
  if (opts.lines.length > 0) {
    // Only pass visible lines with meaningful content
    const cleanLines = opts.lines
      .filter(l => l.description || l.rate > 0)
      .map(l => ({
        description: l.description,
        qty: l.qty,
        unit: l.unit,
        rate: l.rate,
      }));
    if (cleanLines.length > 0) {
      params.set('lines', encodeURIComponent(JSON.stringify(cleanLines)));
    }
  }
  params.set('ref', opts.ref);
  return `${opts.targetPath}?${params.toString()}`;
}

/**
 * Parse line items from URL search params. Returns null if no valid lines param.
 */
export function parseConvertLines(linesParam: string | null): ConvertibleLine[] | null {
  if (!linesParam) return null;
  try {
    const decoded = decodeURIComponent(linesParam);
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Validate shape
    return parsed
      .filter(l => typeof l === 'object' && l !== null)
      .map(l => ({
        description: String(l.description || ''),
        qty: Number(l.qty) || 0,
        unit: String(l.unit || 'pcs'),
        rate: Number(l.rate) || 0,
      }))
      .filter(l => l.description || l.rate > 0);
  } catch {
    return null;
  }
}
