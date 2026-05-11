'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Shared state for the in-app help drawer.
 *
 * The drawer is no longer an overlay \u2014 it occupies a column to the LEFT of the
 * app and the app column shrinks accordingly. Because two sibling components
 * (the trigger button in the workspace header AND the drawer column itself)
 * need to share open/width state, we lift the state into a React Context here
 * rather than passing props through the server-rendered layout.
 *
 * Width is stored as a percentage of the viewport, capped at 35% so the app
 * never loses more than 35% of its horizontal real estate. Persisted to
 * localStorage so the user's preferred width sticks across sessions.
 */

const STORAGE_WIDTH = 'qc.helpPanel.widthVw';

/** Maximum drawer width as a percentage of the viewport. */
export const HELP_DRAWER_MAX_WIDTH_VW = 35;
/** Minimum usable drawer width as a percentage of the viewport. */
export const HELP_DRAWER_MIN_WIDTH_VW = 22;
/** Default drawer width on first open. */
export const HELP_DRAWER_DEFAULT_WIDTH_VW = 30;

interface HelpDrawerContextValue {
  open: boolean;
  widthVw: number;
  /** Open the drawer. */
  openDrawer: () => void;
  /** Close the drawer. */
  closeDrawer: () => void;
  /** Toggle drawer open state. */
  toggleDrawer: () => void;
  /** Set the drawer width (in vw). Clamped to [MIN, MAX] and persisted on commit. */
  setWidthVw: (next: number) => void;
  /** Persist the current width to localStorage. Call once on drag end. */
  commitWidth: () => void;
}

const HelpDrawerContext = createContext<HelpDrawerContextValue | null>(null);

/**
 * Lazy initialiser for the drawer width. Runs once on mount instead of via
 * a setState-in-effect dance, which previously triggered
 * `react-hooks/set-state-in-effect` (Gerald audit L-04, 2026-05-11).
 * Stored values from a prior, pre-cap version (e.g. 50vw) are clamped down
 * to the new max so the layout never arrives in a state we no longer
 * support.
 */
function initialDrawerWidth(): number {
  if (typeof window === 'undefined') return HELP_DRAWER_DEFAULT_WIDTH_VW;
  try {
    const raw = window.localStorage.getItem(STORAGE_WIDTH);
    if (raw === null) return HELP_DRAWER_DEFAULT_WIDTH_VW;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return HELP_DRAWER_DEFAULT_WIDTH_VW;
    return Math.min(HELP_DRAWER_MAX_WIDTH_VW, Math.max(HELP_DRAWER_MIN_WIDTH_VW, parsed));
  } catch {
    // localStorage may be unavailable (SSR, private mode); default is fine.
    return HELP_DRAWER_DEFAULT_WIDTH_VW;
  }
}

export function HelpDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // useState lazy initialiser keeps the localStorage read out of an effect,
  // avoiding both a hydration flash and the lint rule about set-state in
  // effects. The first client render already sees the persisted width.
  const [widthVw, setWidthState] = useState<number>(initialDrawerWidth);

  const setWidthVw = useCallback((next: number) => {
    const clamped = Math.min(HELP_DRAWER_MAX_WIDTH_VW, Math.max(HELP_DRAWER_MIN_WIDTH_VW, next));
    setWidthState(clamped);
  }, []);

  const commitWidth = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_WIDTH, String(widthVw));
    } catch {
      // best-effort
    }
  }, [widthVw]);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((p) => !p), []);

  return (
    <HelpDrawerContext.Provider
      value={{ open, widthVw, openDrawer, closeDrawer, toggleDrawer, setWidthVw, commitWidth }}
    >
      {children}
    </HelpDrawerContext.Provider>
  );
}

export function useHelpDrawer(): HelpDrawerContextValue {
  const ctx = useContext(HelpDrawerContext);
  if (!ctx) {
    throw new Error('useHelpDrawer must be used inside <HelpDrawerProvider>.');
  }
  return ctx;
}
