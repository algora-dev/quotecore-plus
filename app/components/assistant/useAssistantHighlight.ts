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

/**
 * IMPORTANT (click-through): the highlight decoration is rendered entirely on a
 * `::after` pseudo-element, which is `pointer-events: none` by default. This is
 * the fix for "the highlight ring blocks the button click": previously the ring
 * lived on the real element (outline + box-shadow) and we forced
 * `position: relative; z-index: 50` on it, which lifted nav buttons over their
 * neighbours and pushed the clickable outline-offset ring into the hit-test
 * path — making the control hard to click "through". Now the element itself is
 * never restyled in a way that affects hit-testing; only a non-interactive
 * overlay ring is painted on top. The element stays 100% clickable.
 *
 * We still set `position` only when the element is `static` (so the absolutely
 * positioned `::after` anchors to it), but we DO NOT raise z-index and we make
 * the pseudo-element explicitly `pointer-events: none`.
 */
/**
 * CLICK-THROUGH FIX (v2): Use outline + box-shadow directly on the element.
 * No ::after pseudo-element, no position changes, no z-index. outline and
 * box-shadow are purely visual in CSS and NEVER create pointer-event hit areas,
 * so highlighted controls are always clickable on the first click regardless of
 * stacking context, z-index, or browser quirks.
 *
 * The old ::after approach theoretically worked (pointer-events:none) but in
 * practice nav Link elements still required 2 clicks. Switching to direct
 * outline/box-shadow eliminates that class of issue entirely.
 *
 * For overflow:hidden elements (cards, clipped containers) where outline would
 * extend outside and be clipped: the .assistant-hl-clip variant uses inset
 * box-shadow instead, which stays inside the element boundary.
 */
const CSS = `
@keyframes assistant-hl-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
  100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
}
/* Base class — no layout changes, no z-index, no overlays. */
.assistant-hl {}
/* Clip variant: element has overflow:hidden — render ring inside. */
.assistant-hl-clip {}
/* ── Treatments ────────────────────────────────────────────────────────── */
.assistant-hl-glow {
  outline: 2px solid rgba(37, 99, 235, 0.9);
  outline-offset: 3px;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.2), 0 0 18px 4px rgba(37, 99, 235, 0.4);
}
.assistant-hl-pulse {
  outline: 2px solid rgba(37, 99, 235, 0.9);
  outline-offset: 3px;
  animation: assistant-hl-pulse 1.4s ease-out infinite;
}
.assistant-hl-spotlight {
  outline: 3px solid rgba(37, 99, 235, 0.95);
  outline-offset: 3px;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.45);
}
.assistant-hl-arrow {
  outline: 2px solid rgba(37, 99, 235, 0.9);
  outline-offset: 3px;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.2);
}
/* ── Clip variants: inset ring stays inside the overflow boundary ──────── */
.assistant-hl-clip.assistant-hl-glow {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.9), inset 0 0 18px 2px rgba(37, 99, 235, 0.4);
}
.assistant-hl-clip.assistant-hl-pulse {
  outline: none;
  animation: assistant-hl-pulse 1.4s ease-out infinite;
}
.assistant-hl-clip.assistant-hl-spotlight {
  outline: none;
  box-shadow: inset 0 0 0 3px rgba(37, 99, 235, 0.95), 0 0 0 9999px rgba(15, 23, 42, 0.45);
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

    // Disposers registered by apply(); the effect cleanup runs all of them.
    const disposers: Array<() => void> = [];
    let retryTimer: number | null = null;

    const treatment = highlight.treatment ?? 'glow';

    const apply = (el: HTMLElement) => {
    const cls = `assistant-hl assistant-hl-${treatment}`;
    el.classList.add(...cls.split(' '));
    // If the element clips its overflow (e.g. the order-layout picker cards are
    // rounded + overflow-hidden), the outer outline is clipped away. Detect and
    // switch to the INSET box-shadow variant so the ring stays visible.
    try {
      const ov = window.getComputedStyle(el);
      const clips = [ov.overflow, ov.overflowX, ov.overflowY].some(
        (v) => v && v !== 'visible'
      );
      if (clips) el.classList.add('assistant-hl-clip');
    } catch {
      /* getComputedStyle can throw on detached nodes — ignore. */
    }
    // Only scroll if the control is actually off-screen. A smooth scroll while
    // the user is reaching for an already-visible control (e.g. a top-nav
    // button) moves it mid-click. Skip the scroll when it's already in view.
    const vr = el.getBoundingClientRect();
    const inView =
      vr.top >= 0 &&
      vr.left >= 0 &&
      vr.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      vr.right <= (window.innerWidth || document.documentElement.clientWidth);
    if (!inView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

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
      el.classList.remove('assistant-hl', `assistant-hl-${treatment}`, 'assistant-hl-clip');
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
      // DEFER the visual clear. This listener runs in the CAPTURE phase, i.e.
      // BEFORE the clicked control's own (React) handler. Calling
      // clearHighlight() synchronously here does a setState mid-dispatch, which
      // could re-render/teardown the element's stacking context before the
      // click reaches it — the cause of "I have to click nav twice". Deferring
      // to the next frame lets the original click complete its real action
      // (navigation / button press) first, THEN we drop the ring.
      requestAnimationFrame(() => clearHighlight());
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

    disposers.push(() => {
      window.clearTimeout(timer);
      document.removeEventListener('click', onDocClick, { capture: true } as EventListenerOptions);
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      el.classList.remove('assistant-hl', `assistant-hl-${treatment}`, 'assistant-hl-clip');
    });
    };

    // The target may not be in the DOM the instant the step becomes current —
    // e.g. a layout-picker MODAL (order-layout-line-by-line) mounts a beat
    // AFTER the click that opened it. Resolving once and bailing left those
    // controls un-highlighted ("Q says it highlighted Line by Line but it
    // isn't"). Apply immediately if present, else retry briefly until it
    // appears (or we give up). All paths fail safe.
    const immediate = findElement(highlight.elementId);
    if (immediate) {
      apply(immediate);
    } else {
      let attempts = 0;
      const MAX_ATTEMPTS = 20; // ~1s (20 * 50ms)
      retryTimer = window.setInterval(() => {
        attempts += 1;
        const found = findElement(highlight.elementId);
        if (found) {
          if (retryTimer !== null) window.clearInterval(retryTimer);
          retryTimer = null;
          if (!(highlight.key && dismissedKeyRef.current === highlight.key)) {
            apply(found);
          }
        } else if (attempts >= MAX_ATTEMPTS) {
          if (retryTimer !== null) window.clearInterval(retryTimer);
          retryTimer = null;
          setRect(null); // element never appeared — fail safe
        }
      }, 50);
    }

    return () => {
      if (retryTimer !== null) window.clearInterval(retryTimer);
      disposers.forEach((d) => d());
    };
    // Re-run whenever a new highlight (unique key) arrives or the preference
    // toggles.
  }, [highlight?.key, highlight?.elementId, highlight?.treatment, highlight, enabled, persistent]);

  return rect;
}
