// Mobile takeoff M2: workspace view-mode resolution (spec 2026-09-21 §3.1).
// PURE module: no React, no DOM access — all environment inputs are injected
// so the Auto heuristic, preference precedence and persistence fallback are
// fully unit-testable (spec §14.6 L01/L02/L04).
//
// Contract highlights:
// - Explicit preference ALWAYS wins over the automatic recommendation, on any
//   device (Desktop stays Desktop on a phone; Mobile/touch works with a mouse).
// - Auto resolves from layout-viewport size + primary pointer capability, never
//   from a UA string and never from the visual viewport (which shrinks when the
//   software keyboard opens — L04 no-oscillation rule).
// - Storage is versioned, takeoff-only, and per-browser/device; any failure
//   falls back to session memory.

/** Persistent user choice. 'auto' delegates to the heuristic. */
export type WorkspaceViewPreference = 'auto' | 'desktop' | 'mobile-touch';

/** Effective presentation actually rendered. */
export type WorkspaceViewMode = 'desktop' | 'mobile-touch';

/** Versioned takeoff-only localStorage key (spec §3.1: versioned key so future
 *  format changes can migrate or invalidate old values). */
export const VIEW_PREFERENCE_STORAGE_KEY = 'quotecore.takeoff.view-mode.v1';

/**
 * Capability snapshot for the Auto heuristic (§3.1). Values come from
 * matchMedia('(pointer: coarse|fine)') and the LAYOUT viewport
 * (window.innerWidth/innerHeight) — never from the visual viewport and never
 * from a user-agent string.
 */
export type ViewModeCapabilities = Readonly<{
  /** True when the primary pointer is coarse (finger-first). */
  primaryPointerCoarse: boolean;
  /** Layout viewport dimensions in CSS px (NOT visual viewport). */
  layoutViewport: Readonly<{ width: number; height: number }>;
  /** Optional PWA display mode — contextual information only (L02): never
   *  establishes screen size or pointer precision by itself. */
  displayMode?: 'standalone' | 'browser' | string | undefined;
}>;

/** Auto heuristic (§3.1): prefer touch when the primary pointer is coarse AND
 *  the shorter layout-viewport edge is at most 820 CSS px. Anything else —
 *  fine pointers, large screens, hybrid laptops with touch — resolves to
 *  desktop. The manual switch exists precisely because detection can be wrong;
 *  ambiguity is resolved by retaining the initial presentation, not by
 *  oscillating. */
export const AUTO_TOUCH_MAX_SHORT_EDGE = 820;

export function recommendViewMode(capabilities: ViewModeCapabilities): WorkspaceViewMode {
  const { width, height } = capabilities.layoutViewport;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'desktop';
  }
  const shortEdge = Math.min(width, height);
  // displayMode is deliberately ignored (L02: a desktop PWA is not a phone
  // solely for being standalone; a mobile browser can use touch uninstalled).
  return capabilities.primaryPointerCoarse && shortEdge <= AUTO_TOUCH_MAX_SHORT_EDGE
    ? 'mobile-touch'
    : 'desktop';
}

/** Explicit preference beats Auto. `auto` (or an invalid stored value)
 *  delegates to the heuristic. */
export function resolveViewMode(
  preference: WorkspaceViewPreference | null | undefined,
  capabilities: ViewModeCapabilities,
): WorkspaceViewMode {
  if (preference === 'desktop' || preference === 'mobile-touch') return preference;
  return recommendViewMode(capabilities);
}

/** Narrow storage interface so tests can inject a failing/fake store without
 *  touching window.localStorage. */
export interface PreferenceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Parse a persisted preference; anything malformed/unversioned returns null
 *  (treated as Auto). */
export function parseStoredPreference(raw: string | null): WorkspaceViewPreference | null {
  if (raw === 'auto' || raw === 'desktop' || raw === 'mobile-touch') return raw;
  return null;
}

/**
 * Preference persistence with session-memory fallback (§3.1). Storage access
 * failures (private mode, quota, disabled) NEVER throw or break the workspace:
 * the value is kept in a plain module-level map for the rest of the session.
 *
 * Multiple hook instances in one tab share the same session fallback so a
 * failed write followed by a read round-trips inside the session.
 */
const sessionMemory = new Map<string, string>();

/** Test-only hook: clears the shared session-memory fallback so suites are
 *  order-independent. Never call from product code. */
export function resetSessionPreferenceMemoryForTests(): void {
  sessionMemory.clear();
}

export function createPreferencePersistence(store: PreferenceStore | null | undefined) {
  const read = (): WorkspaceViewPreference | null => {
    if (store) {
      try {
        return parseStoredPreference(store.getItem(VIEW_PREFERENCE_STORAGE_KEY));
      } catch {
        // fall through to session memory
      }
    }
    return parseStoredPreference(sessionMemory.get(VIEW_PREFERENCE_STORAGE_KEY) ?? null);
  };

  const write = (preference: WorkspaceViewPreference): void => {
    sessionMemory.set(VIEW_PREFERENCE_STORAGE_KEY, preference);
    if (store) {
      try {
        store.setItem(VIEW_PREFERENCE_STORAGE_KEY, preference);
      } catch {
        // Session memory above already holds the value — non-fatal.
      }
    }
  };

  return { read, write };
}

/**
 * Read the layout viewport as an environment capability source. Kept separate
 * from the pure heuristic so tests can exercise fixtures without a DOM.
 * Uses window.innerWidth/innerHeight (layout viewport); the visual viewport
 * (window.visualViewport) is intentionally NOT consulted — it shrinks under
 * the software keyboard and must never change the resolved mode (L04).
 */
export function readLayoutViewportCapabilities(
  win: Readonly<{
    innerWidth: number;
    innerHeight: number;
    matchMedia: (query: string) => { matches: boolean };
  }>,
): ViewModeCapabilities {
  let primaryPointerCoarse = false;
  try {
    primaryPointerCoarse = win.matchMedia('(pointer: coarse)').matches;
  } catch {
    primaryPointerCoarse = false;
  }
  return {
    primaryPointerCoarse,
    layoutViewport: { width: win.innerWidth, height: win.innerHeight },
  };
}
