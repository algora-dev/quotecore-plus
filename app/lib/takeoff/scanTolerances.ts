/**
 * Calibration-aware scan tolerances.
 *
 * Owner rule (2026-10-02): the scan pipeline's fixed pixel tolerances are
 * replaced by real-world distances derived from the user's own calibration.
 * A hip and a valley may run parallel; only when they are closer than 150 mm
 * at some point do they go to review instead of being trusted (and never
 * silently dropped). Works for metric, imperial and roofing-square
 * calibrations because everything is expressed through px-per-millimetre.
 *
 * All fallbacks preserve the previous pixel behaviour when no calibration is
 * available so scans without a calibration are not blocked or loosened.
 */

export interface ScanTolerances {
  /** True when no usable calibration was supplied (legacy pixel behaviour). */
  legacy: boolean;
  /** Endpoint-to-vertex / endpoint-to-junction snap distance in px. */
  snap: number;
  /** Connection test for line endpoints against the network, in px. */
  connectivity: number;
  /** Two parallel-ish lines closer than this at any point go to review. */
  nearPair: number | null;
}

/** The owner-specified real-world snap/review distance in millimetres. */
export const SCAN_SNAP_MM = 150;

/** Cap relative to the roof diagonal so a coarse calibration cannot make the
 *  snap distance swallow the whole plan. Mirrors the micro-cluster fraction. */
const SNAP_CAP_FRACTION = 0.06;
const SNAP_CAP_FLOOR_PX = 15;

/**
 * Compute scan tolerances from a calibration scale.
 *
 * @param pxPerMmImage pixels per millimetre in the analysis image space the
 *   scan stages operate in (convert canvas-space px/mm with imgW/canvasW).
 * @param roofDiagonalPx diagonal of the roof bounding box in the same space.
 */
export function computeScanTolerances(
  pxPerMmImage: number | null | undefined,
  roofDiagonalPx: number,
): ScanTolerances {
  const usable = typeof pxPerMmImage === 'number' && Number.isFinite(pxPerMmImage) && pxPerMmImage > 0;
  if (!usable) {
    return { legacy: true, snap: 15, connectivity: 10, nearPair: null };
  }
  const raw = pxPerMmImage * SCAN_SNAP_MM;
  const cap = Math.max(SNAP_CAP_FLOOR_PX, SNAP_CAP_FRACTION * (roofDiagonalPx || 1000));
  const snap = Math.min(raw, cap);
  return { legacy: false, snap, connectivity: snap, nearPair: snap };
}

/** Convert a canvas-space px-per-mm scale into analysis-image space. */
export function pxPerMmToImageSpace(
  pxPerMmCanvas: number | null | undefined,
  imageWidth: number,
  canvasWidth: number,
): number | null {
  if (typeof pxPerMmCanvas !== 'number' || !Number.isFinite(pxPerMmCanvas) || pxPerMmCanvas <= 0) return null;
  if (!imageWidth || !canvasWidth) return null;
  const ratio = imageWidth / canvasWidth;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const value = pxPerMmCanvas * ratio;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Roof bounding-box diagonal for tolerance capping. */
export function roofDiagonalPx(outlinePoints: Array<{ x: number; y: number }>): number {
  if (!outlinePoints.length) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of outlinePoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}
