'use client';
// Mobile takeoff M2: immersive-workspace cooperation contract (spec §3.4).
//
// The touch workspace sets `data-takeoff-immersive="touch"` on <html> while it
// is mounted and removes it on unmount (cleanup guaranteed — no body-class
// leaks). App-shell chrome tagged `data-takeoff-chrome` (global header,
// assistant launcher) is hidden via the scoped rules in globals.css ONLY while
// that attribute is present; required entitlement/impersonation notices stay
// in the DOM and are additionally surfaced in compact form inside the touch
// top strip (compactNotices) so nothing required is hidden without an
// accessible equivalent indication (§3.4 / L08).
import { createContext, useContext, useEffect } from 'react';

export interface ImmersiveTakeoffValue {
  /** True while the touch workspace presentation is active. */
  immersive: boolean;
  /** Compact required-notice lines rendered in the touch top strip. */
  compactNotices: readonly string[];
}

export const ImmersiveTakeoffContext = createContext<ImmersiveTakeoffValue>({
  immersive: false,
  compactNotices: [],
});

export function useImmersiveTakeoff(): ImmersiveTakeoffValue {
  return useContext(ImmersiveTakeoffContext);
}

const IMMERSIVE_ATTR = 'data-takeoff-immersive';

/** Side-effect owner: sets/removes the <html> attribute. Mount when the touch
 *  presentation mounts; cleanup restores the shell chrome exactly (L08). */
export function useImmersiveTakeoffAttribute(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.setAttribute(IMMERSIVE_ATTR, 'touch');
    return () => {
      root.removeAttribute(IMMERSIVE_ATTR);
    };
  }, [active]);
}
