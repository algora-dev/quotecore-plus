'use client';

/**
 * useAssistantHints — assemble the client hint envelope (Phase 2)
 * ================================================================
 * Builds the UNTRUSTED hint envelope the widget sends with each turn:
 *   - screenKey: a semantic key derived from the current route (NOT the raw
 *     URL). The server validates it; it never carries selectors.
 *   - visibleElementIds: registry ids currently in the DOM (scanned from
 *     `data-assistant-id`, with a legacy `data-copilot` fallback during the
 *     migration window).
 *
 * Tenancy/permissions are deliberately ABSENT — the server derives those from
 * the session. This hook only reports observable, low-trust UI state.
 */

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import type { ClientCapability } from '@/app/lib/assistant/protocol';

/** Map an in-app pathname to a coarse semantic screenKey. Mirrors the server's
 *  screen vocabulary; keep keys lowercase + dot/hyphen separated (no slashes).
 *  Exported so sibling hooks (e.g. useBrowserFacts) reuse the SAME mapping
 *  rather than forking it. */
export function pathnameToScreenKey(pathname: string | null): string {
  if (!pathname) return 'unknown';
  const parts = pathname.replace(/^\//, '').split('/');
  // Drop the workspace slug (first segment) for in-app routes.
  const PUBLIC_TOP = new Set(['docs', 'login', 'signup', 'account', 'onboarding']);
  if (parts.length > 0 && !PUBLIC_TOP.has(parts[0])) parts.shift();
  const inner = parts.join('/');

  if (/^quotes\/[^/]+\/takeoff/.test(inner)) return 'quote.takeoff';
  if (/^quotes\/[^/]+\/labor/.test(inner)) return 'quote.labor';
  if (/^quotes\/[^/]+\/build/.test(inner)) return 'quote.build';
  if (/^quotes\/[^/]+\/summary/.test(inner)) return 'quote.summary';
  if (/^quotes\/[^/]+\/customer/.test(inner)) return 'quote.customer';
  // /quotes/new is the create-quote FORM (distinct from the /quotes hub) so the
  // assistant can anchor Guide-me to the customer-details step instead of
  // coaching the user back to "click Quotes".
  if (/^quotes\/new$/.test(inner)) return 'quote.new';
  if (/^quotes/.test(inner)) return 'quotes';
  if (/^components/.test(inner)) return 'components';
  if (/^templates/.test(inner)) return 'templates';
  if (/^customer-quote-templates/.test(inner)) return 'customer-quote-templates';
  if (/^flashings/.test(inner)) return 'flashings';
  if (/^material-orders/.test(inner)) return 'material-orders';
  if (/^catalogs/.test(inner)) return 'catalogs';
  if (/^attachments/.test(inner)) return 'attachments';
  if (/^account/.test(pathname.replace(/^\//, ''))) return 'account';
  return inner || 'home';
}

/** Scan the DOM for currently-rendered registry element ids. Exported so
 *  sibling hooks reuse the same scan logic instead of duplicating it. */
export function scanVisibleElementIds(): string[] {
  if (typeof document === 'undefined') return [];
  const ids = new Set<string>();
  document.querySelectorAll('[data-assistant-id]').forEach((el) => {
    const id = el.getAttribute('data-assistant-id');
    if (id) ids.add(id);
  });
  // Migration fallback: include legacy data-copilot anchors so guidance works
  // before every element is re-tagged.
  document.querySelectorAll('[data-copilot]').forEach((el) => {
    const id = el.getAttribute('data-copilot');
    if (id) ids.add(id);
  });
  return [...ids].slice(0, 60);
}

export function useAssistantHints() {
  const pathname = usePathname();

  /** Snapshot hints at send-time (so visibleElementIds reflect the live DOM). */
  const buildHints = useCallback(
    () => ({
      clientCapabilities: ['web', 'sse', 'markdown'] as ClientCapability[],
      screenKey: pathnameToScreenKey(pathname),
      visibleElementIds: scanVisibleElementIds(),
    }),
    [pathname]
  );

  return { buildHints };
}
