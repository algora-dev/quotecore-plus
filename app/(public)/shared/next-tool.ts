/**
 * Cross-sell map for the free document tools.
 *
 * Maps the CURRENT tool slug to a suggested NEXT free tool, shown as a
 * secondary row in the shared results surface (PostGenerationModal).
 * Default fallback is the free tools hub /free-tools.
 *
 * Keep values as in-app route slugs (leading slash). Add entries as new
 * tools ship - anything missing falls back to the hub.
 */

export interface NextToolLink {
  /** Absolute site path of the suggested tool */
  href: string;
  /** Short human label, e.g. "Free Invoice Generator" */
  label: string;
}

const DEFAULT_NEXT_TOOL: NextToolLink = {
  href: '/free-tools',
  label: 'Browse all free tools',
};

/** Slug -> suggested next tool. Keys use the free-tool route slug. */
const NEXT_TOOL_MAP: Record<string, NextToolLink> = {
  'free-quote-generator': { href: '/free-invoice-generator', label: 'Free Invoice Generator' },
  'free-invoice-generator': { href: '/free-purchase-order-generator', label: 'Free Purchase Order Generator' },
  'free-purchase-order-generator': { href: '/free-quote-generator', label: 'Free Quote Generator' },
};

/** Fallback map by PostGenerationModal doc type (quote/order/invoice). */
const NEXT_TOOL_BY_DOC_TYPE: Record<string, NextToolLink> = {
  quote: NEXT_TOOL_MAP['free-quote-generator'],
  order: NEXT_TOOL_MAP['free-purchase-order-generator'],
  invoice: NEXT_TOOL_MAP['free-invoice-generator'],
};

/**
 * Resolve the suggested next tool for the given free-tool slug, falling
 * back to the doc type, then to the /free-tools hub.
 */
export function getNextTool(slug?: string, docType?: string): NextToolLink {
  if (slug && NEXT_TOOL_MAP[slug]) return NEXT_TOOL_MAP[slug];
  if (docType && NEXT_TOOL_BY_DOC_TYPE[docType]) return NEXT_TOOL_BY_DOC_TYPE[docType];
  return DEFAULT_NEXT_TOOL;
}
