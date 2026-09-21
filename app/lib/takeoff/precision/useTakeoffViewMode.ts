'use client';
// Mobile takeoff M2: workspace view-mode hook (spec §3.1).
// Resolves Auto/Desktop/Mobile-touch once at entry (frozen Auto decision —
// no oscillation on hybrid devices or keyboard-driven visual-viewport changes,
// §14.6 L04), persists an explicit choice under the versioned takeoff-only
// key with session-memory fallback, and NEVER re-resolves on resize/orientation
// changes: orientation is handled inside the chosen presentation (§3.2).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPreferencePersistence,
  readLayoutViewportCapabilities,
  resolveViewMode,
  type WorkspaceViewMode,
  type WorkspaceViewPreference,
} from './viewMode';

export interface TakeoffViewModeState {
  /** Effective presentation. Always 'desktop' while the flag is off. */
  mode: WorkspaceViewMode;
  /** Stored preference ('auto' until a client-side read completes). */
  preference: WorkspaceViewPreference;
  /** Set an explicit preference (persists locally + resolves immediately). */
  setPreference: (preference: WorkspaceViewPreference) => void;
}

export function useTakeoffViewMode(flagEnabled: boolean): TakeoffViewModeState {
  const persistence = useMemo(
    () => createPreferencePersistence(typeof window === 'undefined' ? null : window.localStorage),
    [],
  );
  const [preference, setPreferenceState] = useState<WorkspaceViewPreference>('auto');
  const [mode, setMode] = useState<WorkspaceViewMode>('desktop');

  useEffect(() => {
    if (!flagEnabled) {
      // Flag off: defaults already are 'auto'/'desktop' — no state to reset
      // (flag is a static server prop; it never flips mid-session).
      return;
    }
    const stored = persistence.read();
    const resolve = () => {
      setPreferenceState(stored ?? 'auto');
      // Entry-time resolution only. Uses matchMedia pointer + LAYOUT viewport;
      // the visual viewport (keyboard shrink) is deliberately never consulted.
      setMode(resolveViewMode(stored ?? 'auto', readLayoutViewportCapabilities(window)));
    };
    // Deferred out of the effect body (react-hooks lint); this is a one-shot
    // post-mount sync with localStorage/matchMedia, not cascading derived state.
    queueMicrotask(resolve);
  }, [flagEnabled, persistence]);

  const setPreference = useCallback(
    (next: WorkspaceViewPreference) => {
      persistence.write(next);
      setPreferenceState(next);
      // Explicit choice always wins; resolve against current capabilities.
      setMode(resolveViewMode(next, readLayoutViewportCapabilities(window)));
    },
    [persistence],
  );

  return { mode, preference, setPreference };
}
