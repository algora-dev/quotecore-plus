// Mobile takeoff M3: four-button point controller semantics (spec §6) and
// fine-adjustment nudge math (spec §5.7). PURE module.
//
// ‹ › traverse the perimeter in STORED order (R07) — never by screen position.
// Wrap on closed outlines; disable the missing neighbour on open paths; with no
// selection either arrow selects the first vertex (§6.2). Insert-after uses the
// selected vertex's successor midpoint (§6.3 — geometry lives in the M1 command
// engine insertAfter; this module only answers ENABLEMENT). Delete enablement
// follows §6.4 (closed outline keeps a minimum of 3 vertices).
//
// Nudge (§5.7): each tap moves the selected vertex by the inverse-transformed
// screen vector for the chosen step (1 or 5 visible CSS px) — zooming in gives
// finer scene adjustment. Direction vectors are in VIEW space, converted with
// the linear part only (same rule as remote drag, §5.2).

import type { Point } from '../calibrationTypes';
import type { Camera } from './sceneViewport';
import { sceneDeltaFromCameraClientDelta } from './sceneViewport';

/** Nudge step choices in visible CSS px (spec §5.7). */
export type NudgeStepPx = 1 | 5;

export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

const NUDGE_CLIENT_VECTORS: Readonly<Record<NudgeDirection, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Scene-space delta for one nudge tap (§5.7): step visible CSS px in a screen
 * direction, converted through the camera's inverse linear part. Zooming in
 * yields a smaller scene movement for the same step.
 */
export function nudgeSceneDelta(camera: Camera, direction: NudgeDirection, stepPx: NudgeStepPx): Point {
  const v = NUDGE_CLIENT_VECTORS[direction];
  return sceneDeltaFromCameraClientDelta(camera, { x: v.x * stepPx, y: v.y * stepPx });
}

/**
 * §6.2 previous/next target index in stored perimeter order.
 *  - closed: wraps with modular arithmetic;
 *  - open: no wrap — the missing neighbour is null;
 *  - no selection (currentIndex < 0): either arrow selects the first vertex.
 */
export function neighbourIndex(
  count: number,
  closed: boolean,
  currentIndex: number,
  direction: -1 | 1,
): number | null {
  if (count <= 0) return null;
  if (currentIndex < 0) return 0; // no selection → first vertex (§6.2)
  if (currentIndex >= count) return null;
  const target = currentIndex + direction;
  if (closed) return (target + count) % count;
  return target >= 0 && target < count ? target : null;
}

/** §6.3: midpoint insert-after needs a REAL successor — open path at its last
 *  vertex has none (use explicit place-next instead; never append silently). */
export function canInsertAfter(count: number, closed: boolean, currentIndex: number): boolean {
  if (currentIndex < 0) return false;
  if (closed) return true; // last vertex uses the first as successor
  return currentIndex + 1 < count;
}

/**
 * §6.4 delete enablement: a CLOSED outline keeps at least 3 vertices (the M1
 * command additionally enforces nonzero simple area through validation). Open
 * drafts may shrink to zero. No selection → disabled.
 */
export function canDeleteVertex(count: number, closed: boolean, currentIndex: number): boolean {
  if (currentIndex < 0) return false;
  if (closed) return count > 3;
  return true;
}

/** Index of a vertex id in the draft ordering (-1 when absent). */
export function indexOfVertexId(ids: readonly string[], id: string | null): number {
  if (id == null) return -1;
  return ids.indexOf(id);
}

/**
 * §5.5 offscreen reveal: minimal camera translation that brings a viewport
 * point inside the unobstructed region with `marginPx` on each side. Zoom is
 * unchanged. Returns null when already visible. Instant (no animation), so
 * reduced-motion preferences are respected by construction.
 */
export function minimalRevealTranslation(
  point: Point,
  viewport: Readonly<{ width: number; height: number }>,
  marginPx: number = 48,
): Point | null {
  const minX = marginPx;
  const maxX = viewport.width - marginPx;
  const minY = marginPx;
  const maxY = viewport.height - marginPx;
  let dx = 0;
  let dy = 0;
  if (point.x < minX) dx = minX - point.x;
  else if (point.x > maxX) dx = maxX - point.x;
  if (point.y < minY) dy = minY - point.y;
  else if (point.y > maxY) dy = maxY - point.y;
  if (dx === 0 && dy === 0) return null;
  // Panning the camera RIGHT moves content right: camera.tx += dx.
  return { x: dx, y: dy };
}
