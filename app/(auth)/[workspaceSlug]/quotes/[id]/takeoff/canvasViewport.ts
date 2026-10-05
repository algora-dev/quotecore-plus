/**
 * Canvas viewport helpers (2026-09-26, owner: "can't move around when zoomed").
 *
 * The takeoff canvas now follows the standard design-tool viewport pattern:
 * the canvas ELEMENT is sized to the visible viewport area and the plan image
 * is placed entirely by the Fabric viewportTransform (zoom + translation).
 * This module holds the pure math so every call site (auto-fit, zoom buttons,
 * wheel zoom, drag pan, resize) shares identical clamping rules:
 *
 *   - When the scaled plan is SMALLER than the viewport it is centred.
 *   - When it is LARGER the translation is clamped so the viewport always
 *     stays on the plan (no dragging the image fully off-screen, no gaps).
 *
 * All helpers treat the vpt as [scaleX, skewX?0, skewY?0, scaleY, tx, ty] with
 * uniform scale (skews are always 0 in this app).
 */

export type Vpt = [number, number, number, number, number, number];

/** Zoom limits (parity with the old +/- buttons). */
export const CANVAS_MIN_ZOOM = 0.1;
export const CANVAS_MAX_ZOOM = 5;
/** Max upscale applied by auto-fit so tiny plans fill the screen but never blur. */
export const CANVAS_FIT_MAX_UPSCALE = 2;

/** Compute the auto-fit vpt: largest scale that fits (capped), centred. */
export function computeFitVpt(sceneW: number, sceneH: number, viewW: number, viewH: number): { vpt: Vpt; scale: number } {
  const safeW = Math.max(viewW, 1);
  const safeH = Math.max(viewH, 1);
  const scale = Math.min(safeW / sceneW, safeH / sceneH, CANVAS_FIT_MAX_UPSCALE);
  return {
    vpt: [scale, 0, 0, scale, (safeW - sceneW * scale) / 2, (safeH - sceneH * scale) / 2],
    scale,
  };
}

/**
 * Clamp a vpt so the scaled scene stays sensibly positioned in the viewport:
 * centred when smaller than the viewport, edge-locked (no gap) when larger.
 */
export function clampVpt(vpt: Vpt, sceneW: number, sceneH: number, viewW: number, viewH: number): Vpt {
  const next: Vpt = [vpt[0], 0, 0, vpt[3] === vpt[0] ? vpt[0] : vpt[0], vpt[4], vpt[5]];
  const w = sceneW * next[0];
  const h = sceneH * next[0];
  // Horizontal
  if (w <= viewW) {
    next[4] = (viewW - w) / 2;
  } else {
    next[4] = Math.min(0, Math.max(viewW - w, vpt[4]));
  }
  // Vertical
  if (h <= viewH) {
    next[5] = (viewH - h) / 2;
  } else {
    next[5] = Math.min(0, Math.max(viewH - h, vpt[5]));
  }
  return next;
}

/** Pan by screen-space deltas, clamped. */
export function panVpt(vpt: Vpt, dx: number, dy: number, sceneW: number, sceneH: number, viewW: number, viewH: number): Vpt {
  return clampVpt([vpt[0], 0, 0, vpt[0], vpt[4] + dx, vpt[5] + dy], sceneW, sceneH, viewW, viewH);
}

/** Zoom by a multiplicative factor keeping the screen point (sx, sy) fixed. */
export function zoomVptAtPoint(vpt: Vpt, factor: number, sx: number, sy: number): Vpt {
  const scale = Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, vpt[0] * factor));
  const ratio = scale / vpt[0];
  return [scale, 0, 0, scale, sx - (sx - vpt[4]) * ratio, sy - (sy - vpt[5]) * ratio];
}

/** True when the scaled plan is larger than the viewport (panning is useful). */
export function isSceneClipped(vpt: Vpt, sceneW: number, sceneH: number, viewW: number, viewH: number): boolean {
  return sceneW * vpt[0] > viewW + 2 || sceneH * vpt[0] > viewH + 2;
}
