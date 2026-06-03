'use client';

/**
 * useAssistantHighlight — web executor for highlight commands (Phase 4)
 * ======================================================================
 * Takes a server-issued, server-VALIDATED HighlightCommand (semantic elementId,
 * never a selector) and renders it on the page:
 *   - maps elementId -> `[data-assistant-id="X"]` (legacy `[data-copilot="X"]`
 *     fallback during the migration window),
 *   - scrolls it into view,
 *   - applies a visual treatment (glow | pulse | spotlight | arrow),
 *   - auto-clears after a few seconds (or when a new highlight arrives).
 *
 * The DOM-class styling is injected once via a <style> tag so no Tailwind build
 * step or new dependency is needed. The "arrow" treatment additionally returns
 * a target rect so the widget can render a pointer.
 *
 * Security note: this executor TRUSTS the server's validation (the element was
 * checked against the registry + the visible-element set server-side). It still
 * fails safe — if the element isn't in the DOM, it simply does nothing.
 */

import { useEffect, useRef, useState } from 'react';
import type { ActiveHighlight } from './useAssistantChat';

const STYLE_ID = 'assistant-highlight-styles';
/** Time-boxed (server-SSE) highlight lifetime. Kept comfortably readable. */
const HIGHLIGHT_MS = 4000;
/** Persistent (guided-step) highlight max lifetime before it self-clears, if
 *  the user hasn't clicked anything yet. "Until next click OR this, whichever
 *  comes first" — so the spotlight doesn't linger forever on an idle screen. */
const PERSISTENT_MAX_MS = 4000;

/** Rect of the highlighted element (for arrow rendering), in viewport coords. */
export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  treatment: NonNullable<ActiveHighlight['treatment']>;
}

const CSS = `
@keyframes assistant-hl-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
  100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
}
.assistant-hl {
  position: relative !important;
  z-index: 50 !important;
  border-radius: 6px;
  transition: box-shadow 0.2s ease, outline-color 0.2s ease;
}
.assistant-hl-glow {
  outline: 2px solid rgba(37, 99, 235, 0.9);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25), 0 0 18px 4px rgba(37, 99, 235, 0.45);
}
.assistant-hl-pulse {
  outline: 2px solid rgba(37, 99, 235, 0.9);
  outline-offset: 2px;
  animation: assistant-hl-pulse 1.4s ease-out infinite;
}
.assistant-hl-spotlight {
  outline: 3px solid rgba(37, 99, 235, 0.95);
  outline-offset: 3px;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.45);
}
.assistant-hl-arrow {
  outline: 2px solid rgba(37, 99, 235, 0.9);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

/** Resolve a registry elementId to a live DOM element, or null. */
function findElement(elementId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const escaped = window.CSS?.escape
    ? window.CSS.escape(elementId)
    : elementId.replace(/"/g, '\\"');
  return (
    document.querySelector<HTMLElement>(`[data-assistant-id="${escaped}"]`) ??
    document.querySelector<HTMLElement>(`[data-copilot="${escaped}"]`)
  );
}

/**
 * Apply the active highlight to the DOM. Returns the current target rect (for
 * the arrow pointer), updated on scroll/resize while the highlight is live.
 *
 * `enabled` is the user's Highlights preference (default true). When false, the
 * executor no-ops: the server still validates + emits the highlight command (so
 * the model's behaviour is unchanged and the chat still describes the control),
 * but nothing is drawn on the page. This keeps the visual treatment a pure
 * client-side, user-controllable layer with no backend/security impact.
 */
export function useAssistantHighlight(
  highlight: ActiveHighlight | null,
  enabled: boolean = true,
  /**
   * Persistent mode (Guide-me follow-along). When true, the highlight does NOT
   * auto-clear after HIGHLIGHT_MS — it stays on the element until the highlight
   * changes or is removed (i.e. until Copilot advances to the next step). The
   * server-SSE highlight path keeps the default time-boxed behaviour.
   */
  persistent: boolean = false
): HighlightRect | null {
  const [rect, setRect] = useState<HighlightRect | null>(null);
  // The highlight key the user has DISMISSED with a click. Persists across
  // re-renders so a cleared highlight does NOT re-apply (e.g. on scroll/resize
  // re-runs) while the engine still points at the same step. A new step has a
  // new key, so it highlights fresh.
  const dismissedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlight || !enabled) {
      setRect(null);
      return;
    }
    // Already dismissed by a click for THIS exact highlight — don't re-apply.
    if (highlight.key && dismissedKeyRef.current === highlight.key) {
      setRect(null);
      return;
    }
    ensureStyles();

    const el = findElement(highlight.elementId);
    if (!el) {
      // Server said it was visible, but it's gone now (race / unmount). Fail
      // safe: render nothing, don't throw.
      setRect(null);
      return;
    }

    const treatment = highlight.treatment ?? 'glow';
    const cls = `assistant-hl assistant-hl-${treatment}`;
    el.classList.add(...cls.split(' '));
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const updateRect = () => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        treatment,
      });
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    const clearHighlight = () => {
      el.classList.remove(...`assistant-hl assistant-hl-${treatment}`.split(' '));
      setRect(null);
    };

    // RELEASE ON ANY CLICK (both modes). The highlight clears the instant the
    // user clicks ANYWHERE — including the highlighted control itself. This
    // kills the "sticky glow" UX glitches: the visual is a momentary pointer,
    // not a persistent overlay that fights the user's focus. If the user forgets
    // what was highlighted, Back→Next re-fires it. Facts auto-advance / the Next
    // button drive the NEXT highlight when appropriate.
    // Deferred by 0ms so the click that TRIGGERED this highlight (e.g. the Next
    // button, or the action that advanced the step) doesn't immediately clear
    // it — we clear on the user's NEXT click.
    const onDocClick = () => {
      // Mark THIS highlight key dismissed so the effect won't re-apply it on a
      // subsequent re-render while the engine is still on the same step.
      if (highlight.key) dismissedKeyRef.current = highlight.key;
      clearHighlight();
    };
    window.setTimeout(() => {
      document.addEventListener('click', onDocClick, { capture: true, once: true });
    }, 0);

    // Timer is now only a SAFETY BACKSTOP (in case no click ever comes). Click
    // is the primary release mechanism for both modes.
    const timer = window.setTimeout(
      clearHighlight,
      persistent ? PERSISTENT_MAX_MS : HIGHLIGHT_MS
    );

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', onDocClick, { capture: true } as EventListenerOptions);
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      el.classList.remove(...`assistant-hl assistant-hl-${treatment}`.split(' '));
    };
    // Re-run whenever a new highlight (unique key) arrives or the preference
    // toggles.
  }, [highlight?.key, highlight?.elementId, highlight?.treatment, highlight, enabled, persistent]);

  return rect;
}
