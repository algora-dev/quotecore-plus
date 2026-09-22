'use client';
// Mobile takeoff U1 (spec section 3.2): visual-viewport containment service.
//
// `100dvh` is a CSS assumption, not evidence that the rail stays visible: the
// software keyboard and browser chrome change the VISUAL viewport
// independently of the layout viewport (pinch zoom also rescales it). This
// hook reports the visual viewport's CSS-space rect, coalesced through
// animation frames, so the touch shell can pin itself to the usable area.
//
// CONTRACT (plan section 3.2):
// - Reported bounds are for the OVERLAY ROOT only. Scene-camera maths and
//   saved source-image coordinates NEVER receive visual-viewport offsets or
//   device-pixel scaling (the shell consumes these values, nothing else).
// - Returns null until mounted (SSR-safe) and when visualViewport is
//   unavailable (fallback: the shell keeps its 100dvh CSS pinning).
// - Updates are coalesced via requestAnimationFrame; resize AND scroll events
//   are both observed (keyboard open fires resize; iOS URL-bar collapse and
//   pinch-zoom panning fire scroll on the visual viewport).

import { useEffect, useState } from 'react';

export interface VisualViewportBounds {
  /** Offset of the visual viewport top from the layout viewport top (CSS px). */
  top: number;
  /** Offset of the visual viewport left edge from the layout viewport (CSS px). */
  left: number;
  /** Visual viewport width in CSS px. */
  width: number;
  /** Visual viewport height in CSS px. */
  height: number;
  /** Visual viewport scale (pageZoom * pinch scale). Pinning uses px values,
   *  never multiplies children by this. Exposed for diagnostics only. */
  scale: number;
}

function readBounds(vv: VisualViewport): VisualViewportBounds {
  return {
    top: vv.offsetTop,
    left: vv.offsetLeft,
    width: vv.width,
    height: vv.height,
    scale: vv.scale,
  };
}

/**
 * Observes window.visualViewport while `active` is true. Returns null when
 * inactive, pre-mount, or unsupported. Listeners + rAF handles are always
 * cleaned up (no leaks across desktop<->touch switches).
 */
export function useVisualViewportBounds(active: boolean): VisualViewportBounds | null {
  const [bounds, setBounds] = useState<VisualViewportBounds | null>(null);

  useEffect(() => {
    if (!active) {
      // Bounds are only consumed while `active`; leaving the last reading in
      // state (instead of a synchronous reset) avoids cascading renders on
      // every desktop<->touch switch. Reactivation refreshes via update().
      return;
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setBounds(readBounds(vv));
      });
    };
    // Keyboardless fix (2026-09-22): WebKit does not reliably fire the
    // visualViewport 'resize' event when the window/viewport itself changes
    // size (Playwright setViewportSize, desktop-mode window resizes), which
    // left the shell pinned to stale bounds and pushed the rail off-screen.
    // Observe the window resize as well and re-read the live vv rect.
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [active]);

  return bounds;
}
