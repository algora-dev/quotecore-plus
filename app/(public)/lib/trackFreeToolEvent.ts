// Shared client-side usage tracking for all free tools.
// Fires a fire-and-forget POST to /api/free-tools/log-usage.
// Never blocks or breaks the host page - all failures are swallowed.

const ENDPOINT = '/api/free-tools/log-usage';

const toolCode = (() => {
  if (typeof window === 'undefined') return null;
  const p = window.location.pathname;
  if (p.startsWith('/free-roofing-takeoff-builder')) return 'takeoff-builder';
  if (p.startsWith('/free-roof-takeoff')) return 'roof-takeoff';
  if (p.startsWith('/free-quote-builder')) return 'quote-builder';
  if (p.startsWith('/free-quote-generator')) return 'quote-gen';
  if (p.startsWith('/free-purchase-order-generator')) return 'po-gen';
  if (p.startsWith('/free-invoice-generator')) return 'invoice-gen';
  if (p.startsWith('/free-calculators')) return 'calc';
  // Static calculator slug pages live at the root (42 SEO pages).
  if (/^\/[a-z0-9-]+-calculator(\/|$)/.test(p)) return 'calc';
  return null;
})();

/**
 * Log a completed meaningful action to free_tool_usage.
 * action examples: 'output' | 'generate' | 'result' - stored in document_type.
 */
export function trackFreeToolEvent(action: string, extra?: Record<string, string | number | null>) {
  if (!toolCode || typeof window === 'undefined') return;
  try {
    const body = JSON.stringify({ toolCode, action, ...(extra ?? {}) });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch { /* never break the host page */ }
}
