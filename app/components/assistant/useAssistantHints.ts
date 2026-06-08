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
// Known in-app top-level route segments. Live URLs are slug-prefixed
// (/<workspaceSlug>/invoices) but AUTHORED workflow startPages are slug-LESS
// (/invoices). Without this set, the slug-strip below would eat the only
// segment of a slug-less startPage ("/invoices" -> "" -> "home"), so every
// top-level startPage resolved to `home` and the guide engine never built a
// navigation hop (the "create-invoice guide skips navigating" bug).
const IN_APP_TOP = new Set([
  'quotes',
  'invoices',
  'material-orders',
  'resources',
  'components',
  'templates',
  'customer-quote-templates',
  'flashings',
  'catalogs',
  'attachments',
]);

export function pathnameToScreenKey(pathname: string | null): string {
  if (!pathname) return 'unknown';
  const parts = pathname.replace(/^\//, '').split('/');
  // Drop the workspace slug (first segment) for in-app routes — BUT only when
  // the first segment is actually a slug. If it's already a known in-app top
  // route (a slug-less authored startPage like "/invoices"), keep it.
  const PUBLIC_TOP = new Set(['docs', 'login', 'signup', 'account', 'onboarding']);
  if (
    parts.length > 0 &&
    !PUBLIC_TOP.has(parts[0]) &&
    !IN_APP_TOP.has(parts[0])
  ) {
    parts.shift();
  }
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
  // Resource Library lives under /resources/* after the restructure. Match the
  // nested sub-routes FIRST so we emit a slash-free semantic key (the server
  // rejects anything containing '/'). Order matters: specific before generic.
  if (/^resources\/catalogs/.test(inner)) return 'resources.catalogs';
  if (/^resources\/attachments/.test(inner)) return 'resources.attachments';
  if (/^resources/.test(inner)) return 'resources';
  // Invoice editor (/invoices/[id]/...) vs invoice list (/invoices)
  if (/^invoices\/[^/]+/.test(inner)) return 'invoice.editor';
  if (/^invoices/.test(inner)) return 'invoices';
  // Legacy flat routes (kept for back-compat redirects).
  if (/^catalogs/.test(inner)) return 'resources.catalogs';
  if (/^attachments/.test(inner)) return 'resources.attachments';
  if (/^account/.test(pathname.replace(/^\//, ''))) return 'account';
  // Final safety net: never return a value with a slash (server rejects it).
  // Collapse any remaining nested path to its first segment.
  const fallback = inner.split('/')[0];
  return fallback || 'home';
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
