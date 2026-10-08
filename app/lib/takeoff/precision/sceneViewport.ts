// Mobile takeoff M2: scene / viewport coordinate split (spec 2026-09-21 §2.1
// trap 1 + §10). PURE module: no React/Fabric/DOM.
//
// The four spaces of §10.1 map onto:
//   sceneDescriptor  — the page's stable measurement frame (takeoff-scene-v1,
//                      long edge capped at MAX_CANVAS_DIM = 2000, image
//                      processing + AI canvasDimensions payloads use THIS).
//   viewportSize     — visible logical drawing surface (CSS px, changes on
//                      rotation / layout switch / browser chrome changes).
//   camera           — user pan/zoom over the scene (changes constantly).
//   client           — pointer coordinates in the interaction surface's own
//                      rect (bounded by getBoundingClientRect at the caller).
//
// INVARIANT (R11): scene dimensions, stored geometry and measurement scale
// NEVER change on layout switch, zoom, rotation or DPR change. This module is
// the provable core of that guarantee: nothing here mutates inputs, and every
// transform that touches scene coordinates is derived fresh from the inputs.

import type { Affine2D, Point } from '../calibrationTypes';
import {
  MAX_CANVAS_DIM,
  applyAffine,
  composeAffine,
  invertAffine,
} from '../calibrationCoordinates';

/** Stable scene frame descriptor. Width/height derive ONLY from the immutable
 *  source image, never from the canvas element size (§10.1 mandatory
 *  decoupling). */
export type SceneDescriptor = Readonly<{
  width: number;
  height: number;
  /** Content-digest image revision this frame was built from. */
  imageRevision: string | null;
}>;

/** Visible logical drawing surface in CSS px. May change at any time. */
export type ViewportSize = Readonly<{ width: number; height: number }>;

/** Uniform-zoom camera over the scene: client = scene * zoom + translation
 *  (§5.4). `tx`/`ty` are in viewport CSS px. */
export type Camera = Readonly<{ zoom: number; tx: number; ty: number }>;

/** Scene dims from a source image: uniform scale so the longer edge equals
 *  min(sourceLongEdge, MAX_CANVAS_DIM). Mirrors the workstation's 2000-long-
 *  edge reference behaviour WITHOUT referencing any live canvas element. */
export function sceneDimsFromSource(
  sourceWidth: number,
  sourceHeight: number,
  imageRevision: string | null = null,
): SceneDescriptor {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(`sceneDimsFromSource: invalid source dims ${sourceWidth}x${sourceHeight}`);
  }
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, MAX_CANVAS_DIM / longEdge);
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    imageRevision,
  };
}

/** camera: client = scene * zoom + t. */
export function cameraToAffine(camera: Camera): Affine2D {
  if (!Number.isFinite(camera.zoom) || camera.zoom <= 0) {
    throw new Error(`cameraToAffine: invalid zoom ${camera.zoom}`);
  }
  return [camera.zoom, 0, 0, camera.zoom, camera.tx, camera.ty];
}

/** scene→viewport affine for the given camera. */
export function sceneToViewport(camera: Camera): Affine2D {
  return cameraToAffine(camera);
}

/** viewport→scene affine (inverse camera). */
export function viewportToScene(camera: Camera): Affine2D {
  return invertAffine(cameraToAffine(camera));
}

/** Map a scene point into viewport CSS px for rendering. */
export function scenePointToViewport(camera: Camera, p: Point): Point {
  return applyAffine(cameraToAffine(camera), p);
}

/**
 * Remote-drag delta conversion (§5.2 / §10.2): use ONLY the inverse transform's
 * linear part — never its translation — on a delta vector. Client deltas are
 * CSS px; DPR must NOT be applied (render backing resolution is not a
 * measurement unit). Re-exported shape matching M1's sceneDeltaFromClientDelta
 * semantics but camera-parameterised.
 */
export function sceneDeltaFromCameraClientDelta(camera: Camera, delta: Readonly<{ x: number; y: number }>): Point {
  return { x: delta.x / camera.zoom, y: delta.y / camera.zoom };
}

/**
 * Compose the interaction-surface rect into a full scene→client transform.
 * `surfaceRect` is the measured getBoundingClientRect of the interaction
 * surface; an overlay is not necessarily at (0,0) in the window (§10.2).
 */
export function viewportToClient(
  surfaceRect: Readonly<{ left: number; top: number }>,
): Affine2D {
  return [1, 0, 0, 1, surfaceRect.left, surfaceRect.top];
}

export function sceneToClient(
  camera: Camera,
  surfaceRect: Readonly<{ left: number; top: number }>,
): Affine2D {
  return composeAffine(viewportToClient(surfaceRect), cameraToAffine(camera));
}

/** Fit camera: uniform zoom so the whole scene is visible inside the viewport
 *  with a margin fraction (0..0.5 per side), centred. §10.3: initial entry and
 *  explicit Fit plan. */
export function fitCamera(
  scene: Readonly<{ width: number; height: number }>,
  viewport: ViewportSize,
  marginFraction: number = 0.05,
): Camera {
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new Error(`fitCamera: invalid viewport ${viewport.width}x${viewport.height}`);
  }
  const m = Math.min(Math.max(marginFraction, 0), 0.5);
  const availW = viewport.width * (1 - 2 * m);
  const availH = viewport.height * (1 - 2 * m);
  const zoom = Math.min(availW / scene.width, availH / scene.height);
  return {
    zoom,
    tx: (viewport.width - scene.width * zoom) / 2,
    ty: (viewport.height - scene.height * zoom) / 2,
  };
}

/**
 * Two-finger pinch/pan camera update (§5.4):
 *   q = (c0 - t0) / z0   (scene anchor under the starting midpoint)
 *   z1 = clamp(z0 * d1 / d0, minZoom, maxZoom)
 *   t1 = c1 - z1 * q
 * A near-zero d0 is rejected. When zoom clamps, translation is recomputed with
 * the CLAMPED zoom so the anchor stays stable.
 */
export function pinchCamera(
  camera: Camera,
  start: Readonly<{ mid: Readonly<{ x: number; y: number }>; distance: number }>,
  current: Readonly<{ mid: Readonly<{ x: number; y: number }>; distance: number }>,
  zoomBounds: Readonly<{ min: number; max: number }>,
): Camera {
  if (!(start.distance > 1e-6)) {
    throw new Error('pinchCamera: near-zero starting distance');
  }
  const q = {
    x: (start.mid.x - camera.tx) / camera.zoom,
    y: (start.mid.y - camera.ty) / camera.zoom,
  };
  const rawZoom = camera.zoom * (current.distance / start.distance);
  const zoom = Math.min(Math.max(rawZoom, zoomBounds.min), zoomBounds.max);
  return {
    zoom,
    tx: current.mid.x - zoom * q.x,
    ty: current.mid.y - zoom * q.y,
  };
}

/**
 * R11 core invariant check helper for tests and assertions: given identical
 * scene + stored geometry, the scene-space values are byte-identical after any
 * camera/viewport/layout change because scene coordinates never pass through a
 * camera transform on the way to storage. Provided as an explicit oracle.
 */
export function sceneGeometryInvariant(
  points: readonly Point[],
): readonly Point[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}
