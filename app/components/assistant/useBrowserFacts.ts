'use client';

/**
 * useBrowserFacts - passive browser-facts reporter (Stage 2, Deliverable B)
 * ==========================================================================
 * OBSERVATION ONLY. This hook watches the page and, on demand, reports FACTS
 * about what the user is looking at and what they recently did on registry
 * elements. It makes NO decisions: no step advancement, no highlighting, no
 * "next step" - the chatbot (Stage 3) decides everything from these facts.
 *
 * Design constraints (Stage 2 brief):
 *   - Cheap & safe: passive, capture-phase document listeners; a bounded,
 *     ref-backed rolling buffer (no React state thrash). Only a getter is
 *     exposed - reading facts never triggers a re-render.
 *   - SSR-safe: every `document` access is guarded.
 *   - Shares logic with useAssistantHints (screenKey + element scan) instead
 *     of forking it.
 *
 * NOT wired into the orchestrator/chat in Stage 2. It is built, typed, and
 * exported; mounting/consumption lands in Stage 3.
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  pathnameToScreenKey,
  scanVisibleElementIds,
} from './useAssistantHints';

/** Max number of recent observed actions retained in the rolling buffer. */
const MAX_RECENT_ACTIONS = 8;

/** A single observed user action on a registry element. */
export interface ObservedAction {
  /** Registry element id (data-copilot / data-assistant-id) the action hit. */
  elementId: string;
  /** Kind of DOM interaction observed. */
  kind: 'click' | 'input' | 'change';
  /** Epoch ms when observed. */
  at: number;
}

/** The fact snapshot the chatbot will consume. Pure data, no decisions. */
export interface BrowserFacts {
  /** Semantic screen key (same mapping as useAssistantHints). */
  screenKey: string;
  /** Raw pathname (for debugging / the chatbot's own reasoning). */
  pathname: string | null;
  /** Registry element ids currently in the DOM. */
  visibleElementIds: string[];
  /** Short rolling log of recent user actions on registry elements. */
  recentActions: ObservedAction[];
}

/**
 * Resolve an event target up to the nearest registry-tagged ancestor and
 * return its semantic elementId, or null. Prefers `data-assistant-id`, falls
 * back to legacy `data-copilot` (migration window - same as the hint scan).
 */
function elementIdForEventTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const el =
    target.closest('[data-assistant-id]') ?? target.closest('[data-copilot]');
  if (!el) return null;
  return (
    el.getAttribute('data-assistant-id') ??
    el.getAttribute('data-copilot') ??
    null
  );
}

export function useBrowserFacts() {
  const pathname = usePathname();
  // Rolling buffer of recent actions, ref-backed (no state → no re-renders).
  const recentRef = useRef<ObservedAction[]>([]);
  // Keep the latest pathname available to the getter without re-binding it.
  const pathnameRef = useRef<string | null>(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const push = (kind: ObservedAction['kind']) => (event: Event) => {
      const elementId = elementIdForEventTarget(event.target);
      if (!elementId) return;
      const buf = recentRef.current;
      buf.push({ elementId, kind, at: Date.now() });
      // Bound the buffer (drop oldest) - cheap, no allocations beyond splice.
      if (buf.length > MAX_RECENT_ACTIONS) {
        buf.splice(0, buf.length - MAX_RECENT_ACTIONS);
      }
    };

    const onClick = push('click');
    const onInput = push('input');
    const onChange = push('change');

    // Capture phase + passive: observe without interfering with app handlers.
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    document.addEventListener('click', onClick, opts);
    document.addEventListener('input', onInput, opts);
    document.addEventListener('change', onChange, opts);

    return () => {
      document.removeEventListener('click', onClick, opts);
      document.removeEventListener('input', onInput, opts);
      document.removeEventListener('change', onChange, opts);
    };
  }, []);

  /**
   * Snapshot the current browser facts. Cheap; scans the live DOM at call time
   * (like useAssistantHints.buildHints) and copies the rolling buffer so the
   * caller can't mutate internal state. Reading does NOT trigger a re-render.
   */
  const getFacts = useCallback(
    (): BrowserFacts => ({
      screenKey: pathnameToScreenKey(pathnameRef.current),
      pathname: pathnameRef.current,
      visibleElementIds: scanVisibleElementIds(),
      recentActions: [...recentRef.current],
    }),
    []
  );

  return { getFacts };
}
