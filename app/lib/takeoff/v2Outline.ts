/**
 * Deterministic roof outline extraction.
 *
 * Digital roof plans typically have:
 * - Grey/light-grey roof fill against white background
 * - Black or dark lines for structure
 * - Text, dimensions, arrows as noise
 *
 * Algorithm:
 * 1. Decode and auto-orient
 * 2. Build a roof-fill mask from luminance clusters
 * 3. Remove thin exterior noise (thickness-aware opening)
 * 4. Select dominant connected region
 * 5. Fill internal holes
 * 6. Trace outer contour
 * 7. Simplify contour (Douglas-Peucker) preserving steps
 * 8. Snap edges to H/V when within tolerance
 * 9. Validate polygon (coverage, closure, no self-intersection)
 */

import sharp from 'sharp';

export interface OutlineResult {
  success: boolean;
  polygon: Array<{ x: number; y: number }>;
  coverage: number; // 0-1, fraction of roof-fill mask enclosed
  spill: number; // 0-1, fraction of polygon outside roof-fill mask
  processingMs: number;
  method: 'deterministic' | 'fallback';
  error?: string;
  // Diagnostic data
  maskArea: number;
  polygonArea: number;
  vertexCount: number;
}

// ── Thresholds ──────────────────────────────────────────────────────────

const MIN_POLYGON_VERTICES = 4;
const TARGET_COVERAGE = 0.98; // polygon must enclose ≥98% of roof-fill mask
const MAX_SPILL = 0.05; // polygon may spill ≤5% into background
const SIMPLIFY_TOLERANCE = 3.0; // pixels — Douglas-Peucker epsilon
const SNAP_TOLERANCE = 5; // pixels — snap to H/V within this
const MIN_MASK_AREA_FRAC = 0.02; // mask must cover ≥2% of image
const MAX_MASK_AREA_FRAC = 0.95; // mask must cover ≤95% of image

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Build a binary roof-fill mask from image pixels.
 * Roof fill is typically grey (mid-luminance, low saturation).
 * Background is white (high luminance). Structure lines are dark.
 */
function buildRoofFillMask(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number,
): { mask: Uint8Array; maskArea: number } {
  const mask = new Uint8Array(width * height);
  let maskArea = 0;

  // First pass: compute mean luminance to adapt threshold
  let sumLum = 0;
  const totalPixels = width * height;
  for (let i = 0; i < totalPixels; i++) {
    const r = pixels[i * channels];
    const g = pixels[i * channels + 1];
    const b = pixels[i * channels + 2];
    sumLum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const meanLum = sumLum / totalPixels;

  // Roof fill: luminance between 80 and 230 (grey, not white, not black)
  // This catches light grey fills, medium grey fills, and hatched areas
  const lowThreshold = 60;
  const highThreshold = Math.min(240, meanLum + 20);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Roof fill = not white background, not pure black lines
      // Grey fill: lum between low and high thresholds
      if (lum >= lowThreshold && lum <= highThreshold) {
        mask[y * width + x] = 1;
        maskArea++;
      }
    }
  }

  return { mask, maskArea };
}

/**
 * Erode then dilate (opening) to remove thin noise tendrils.
 * Uses a 3x3 structuring element.
 */
function morphologicalOpen(mask: Uint8Array, width: number, height: number, iterations: number = 1): Uint8Array {
  let current = mask;

  for (let iter = 0; iter < iterations; iter++) {
    // Erode
    const eroded = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (current[idx] && current[idx - 1] && current[idx + 1]
          && current[idx - width] && current[idx + width]) {
          eroded[idx] = 1;
        }
      }
    }
    // Dilate
    const dilated = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (eroded[idx] || eroded[idx - 1] || eroded[idx + 1]
          || eroded[idx - width] || eroded[idx + width]) {
          dilated[idx] = 1;
        }
      }
    }
    current = dilated;
  }

  return current;
}

/**
 * Fill internal holes in a binary mask using flood fill from borders.
 * Any 0-pixel not reachable from the border gets filled to 1.
 */
function fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {
  const filled = new Uint8Array(mask); // copy
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  // Push all border 0-pixels
  for (let x = 0; x < width; x++) {
    const top = x;
    const bot = (height - 1) * width + x;
    if (!filled[top]) { stack.push(top); visited[top] = 1; }
    if (!filled[bot]) { stack.push(bot); visited[bot] = 1; }
  }
  for (let y = 0; y < height; y++) {
    const left = y * width;
    const right = y * width + width - 1;
    if (!filled[left]) { stack.push(left); visited[left] = 1; }
    if (!filled[right]) { stack.push(right); visited[right] = 1; }
  }

  // Flood fill from borders — mark all exterior 0-pixels
  while (stack.length > 0) {
    const idx = stack.pop()!;
    const x = idx % width;
    const y = Math.floor(idx / width);

    // Check 4-neighbors
    const neighbors = [
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1,
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && !filled[n] && !visited[n]) {
        visited[n] = 1;
        stack.push(n);
      }
    }
  }

  // Any unvisited 0-pixel is an interior hole → fill it
  for (let i = 0; i < width * height; i++) {
    if (!filled[i] && !visited[i]) {
      filled[i] = 1;
    }
  }

  return filled;
}

/**
 * Connected component labeling (4-connectivity).
 * Returns the largest component mask and its area.
 */
function largestConnectedComponent(
  mask: Uint8Array,
  width: number,
  height: number,
): { component: Uint8Array; area: number } {
  const labels = new Int32Array(width * height).fill(0);
  let currentLabel = 0;
  let bestLabel = 0;
  let bestArea = 0;

  for (let i = 0; i < width * height; i++) {
    if (!mask[i] || labels[i] !== 0) continue;
    currentLabel++;
    const stack = [i];
    let area = 0;
    labels[i] = currentLabel;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      area++;
      const x = idx % width;
      const y = Math.floor(idx / width);

      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && mask[n] && labels[n] === 0) {
          labels[n] = currentLabel;
          stack.push(n);
        }
      }
    }

    if (area > bestArea) {
      bestArea = area;
      bestLabel = currentLabel;
    }
  }

  if (bestLabel === 0) {
    return { component: new Uint8Array(width * height), area: 0 };
  }

  const component = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (labels[i] === bestLabel) component[i] = 1;
  }

  return { component, area: bestArea };
}

/**
 * Trace the outer contour of a binary mask using Moore boundary tracing.
 * Returns the contour as an ordered list of points.
 */
function traceContour(
  mask: Uint8Array,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  // Find first foreground pixel (top-left scan)
  let startIdx = -1;
  for (let y = 0; y < height && startIdx < 0; y++) {
    for (let x = 0; x < width && startIdx < 0; x++) {
      if (mask[y * width + x]) {
        startIdx = y * width + x;
      }
    }
  }
  if (startIdx < 0) return [];

  const contour: Array<{ x: number; y: number }> = [];
  const startX = startIdx % width;
  const startY = Math.floor(startIdx / width);

  // Moore neighborhood tracing (8-connectivity)
  // Directions: 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let cx = startX;
  let cy = startY;
  let backtrackDir = 6; // came from above (entering from top)

  contour.push({ x: cx, y: cy });
  let steps = 0;
  const maxSteps = width * height * 2;

  do {
    // Search clockwise from backtrack direction
    let found = false;
    for (let i = 0; i < 8; i++) {
      const dir = (backtrackDir + 1 + i) % 8;
      const nx = cx + dx[dir];
      const ny = cy + dy[dir];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (mask[ny * width + nx]) {
        // Backtrack direction is opposite of the direction we moved
        backtrackDir = (dir + 4) % 8;
        cx = nx;
        cy = ny;
        contour.push({ x: cx, y: cy });
        found = true;
        break;
      }
    }
    if (!found) break; // isolated pixel
    steps++;
  } while ((cx !== startX || cy !== startY) && steps < maxSteps);

  // Remove the duplicate last point if it equals start
  if (contour.length > 1) {
    const last = contour[contour.length - 1];
    if (last.x === startX && last.y === startY) {
      contour.pop();
    }
  }

  return contour;
}

/**
 * Douglas-Peucker line simplification.
 * Reduces contour points while preserving significant corners.
 */
function simplifyContour(
  points: Array<{ x: number; y: number }>,
  epsilon: number,
): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;

  const sqEpsilon = epsilon * epsilon;

  function sqDistToSegment(
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const ddx = p.x - a.x;
      const ddy = p.y - a.y;
      return ddx * ddx + ddy * ddy;
    }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const ddx = p.x - projX;
    const ddy = p.y - projY;
    return ddx * ddx + ddy * ddy;
  }

  function dpRecurse(start: number, end: number, mask: boolean[]) {
    if (end <= start + 1) return;
    let maxDist = 0;
    let maxIdx = 0;
    const a = points[start];
    const b = points[end];
    for (let i = start + 1; i < end; i++) {
      const d = sqDistToSegment(points[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > sqEpsilon) {
      mask[maxIdx] = true;
      dpRecurse(start, maxIdx, mask);
      dpRecurse(maxIdx, end, mask);
    }
  }

  // For a closed contour, we need to keep start and end
  // Treat as open polyline (start != end even for closed contour since we removed duplicate)
  const keepMask = new Array(points.length).fill(false);
  keepMask[0] = true;
  keepMask[points.length - 1] = true;
  dpRecurse(0, points.length - 1, keepMask);

  // Also do a pass from the middle to catch features near the seam
  const mid = Math.floor(points.length / 2);
  keepMask[mid] = true;
  dpRecurse(0, mid, keepMask);
  dpRecurse(mid, points.length - 1, keepMask);

  return points.filter((_, i) => keepMask[i]);
}

/**
 * Snap near-horizontal/near-vertical edges to exact H/V.
 */
function snapToHV(
  points: Array<{ x: number; y: number }>,
  tolerance: number,
): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;

  const result = points.map(p => ({ ...p }));

  for (let i = 0; i < result.length; i++) {
    const a = result[i];
    const b = result[(i + 1) % result.length];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);

    // If nearly horizontal (small dy), snap both y to average
    if (dx > 0 && dy <= tolerance && dy / Math.max(dx, 1) < 0.15) {
      const avgY = Math.round((a.y + b.y) / 2);
      a.y = avgY;
      b.y = avgY;
    }
    // If nearly vertical (small dx), snap both x to average
    if (dy > 0 && dx <= tolerance && dx / Math.max(dy, 1) < 0.15) {
      const avgX = Math.round((a.x + b.x) / 2);
      a.x = avgX;
      b.x = avgX;
    }
  }

  // Remove consecutive duplicate points created by snapping
  const deduped: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < result.length; i++) {
    const p = result[i];
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) {
      deduped.push(p);
    }
  }
  // Also remove last if it equals first
  if (deduped.length > 1) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (first.x === last.x && first.y === last.y) {
      deduped.pop();
    }
  }

  return deduped;
}

/**
 * Check if polygon has self-intersections.
 * Uses pairwise segment intersection test.
 */
function hasSelfIntersection(
  polygon: Array<{ x: number; y: number }>,
): boolean {
  const n = polygon.length;
  if (n < 4) return false;

  function segIntersect(
    p1: { x: number; y: number }, p2: { x: number; y: number },
    p3: { x: number; y: number }, p4: { x: number; y: number },
  ): boolean {
    const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-10) return false;
    const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
    const s = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
    return t > 0.001 && t < 0.999 && s > 0.001 && s < 0.999;
  }

  for (let i = 0; i < n; i++) {
    const a1 = polygon[i];
    const a2 = polygon[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent edges
      const b1 = polygon[j];
      const b2 = polygon[(j + 1) % n];
      if (segIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/**
 * Compute polygon area using the shoelace formula.
 */
function polygonArea(polygon: Array<{ x: number; y: number }>): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Check if a point is inside a polygon (ray casting).
 */
function pointInPolygon(
  px: number, py: number,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Compute coverage: fraction of mask pixels inside the polygon.
 * And spill: fraction of polygon pixels NOT in the mask.
 */
function computeCoverageAndSpill(
  mask: Uint8Array,
  width: number,
  height: number,
  polygon: Array<{ x: number; y: number }>,
): { coverage: number; spill: number } {
  let maskInside = 0;
  let maskTotal = 0;
  let polyInside = 0;
  let polyTotal = 0;

  // Sample every 2 pixels for speed
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = y * width + x;
      const inMask = mask[idx] === 1;
      const inPoly = pointInPolygon(x, y, polygon);

      if (inMask) maskTotal++;
      if (inMask && inPoly) maskInside++;
      if (inPoly) polyTotal++;
      if (inPoly && !inMask) polyInside++;
    }
  }

  const coverage = maskTotal > 0 ? maskInside / maskTotal : 0;
  const spill = polyTotal > 0 ? polyInside / polyTotal : 0;
  return { coverage, spill };
}

// ── Main entry point ────────────────────────────────────────────────────

export async function extractRoofOutline(
  imageBuffer: Buffer,
): Promise<OutlineResult> {
  const startTime = Date.now();

  const pipeline = sharp(imageBuffer).rotate();
  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 200 || height < 200) {
    return {
      success: false,
      polygon: [],
      coverage: 0,
      spill: 0,
      processingMs: Date.now() - startTime,
      method: 'deterministic',
      error: 'Image too small',
      maskArea: 0,
      polygonArea: 0,
      vertexCount: 0,
    };
  }

  // Get raw RGB pixels
  const { data: pixels, info } = await pipeline
    .resize(Math.min(width, 2000), Math.min(height, 2000), {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const channels = info.channels;

  // For greyscale, channels = 1
  const pixelData = channels === 1 ? pixels : pixels;
  const ch = channels;

  // 1. Build roof-fill mask
  const { mask: rawMask, maskArea: rawMaskArea } = buildRoofFillMask(pixelData, w, h, ch);

  const totalPixels = w * h;
  const maskFrac = rawMaskArea / totalPixels;

  if (maskFrac < MIN_MASK_AREA_FRAC || maskFrac > MAX_MASK_AREA_FRAC) {
    return {
      success: false,
      polygon: [],
      coverage: 0,
      spill: 0,
      processingMs: Date.now() - startTime,
      method: 'deterministic',
      error: `Mask area fraction ${maskFrac.toFixed(3)} outside acceptable range [${MIN_MASK_AREA_FRAC}, ${MAX_MASK_AREA_FRAC}]`,
      maskArea: rawMaskArea,
      polygonArea: 0,
      vertexCount: 0,
    };
  }

  // 2. Morphological opening to remove thin noise
  const opened = morphologicalOpen(rawMask, w, h, 1);

  // 3. Select largest connected component
  const { component: dominantRegion, area: regionArea } = largestConnectedComponent(opened, w, h);
  if (regionArea < MIN_MASK_AREA_FRAC * totalPixels) {
    return {
      success: false,
      polygon: [],
      coverage: 0,
      spill: 0,
      processingMs: Date.now() - startTime,
      method: 'deterministic',
      error: 'Dominant connected region too small',
      maskArea: regionArea,
      polygonArea: 0,
      vertexCount: 0,
    };
  }

  // 4. Fill holes
  const filled = fillHoles(dominantRegion, w, h);

  // 5. Trace contour
  const contour = traceContour(filled, w, h);
  if (contour.length < MIN_POLYGON_VERTICES) {
    return {
      success: false,
      polygon: [],
      coverage: 0,
      spill: 0,
      processingMs: Date.now() - startTime,
      method: 'deterministic',
      error: `Contour has only ${contour.length} points`,
      maskArea: regionArea,
      polygonArea: 0,
      vertexCount: contour.length,
    };
  }

  // 6. Simplify contour
  const simplified = simplifyContour(contour, SIMPLIFY_TOLERANCE);
  if (simplified.length < MIN_POLYGON_VERTICES) {
    return {
      success: false,
      polygon: [],
      coverage: 0,
      spill: 0,
      processingMs: Date.now() - startTime,
      method: 'deterministic',
      error: `Simplified contour has only ${simplified.length} points`,
      maskArea: regionArea,
      polygonArea: 0,
      vertexCount: simplified.length,
    };
  }

  // 7. Snap to H/V
  const snapped = snapToHV(simplified, SNAP_TOLERANCE);
  if (snapped.length < MIN_POLYGON_VERTICES) {
    return {
      success: false,
      polygon: [],
      coverage: 0,
      spill: 0,
      processingMs: Date.now() - startTime,
      method: 'deterministic',
      error: `Snapped contour has only ${snapped.length} points`,
      maskArea: regionArea,
      polygonArea: 0,
      vertexCount: snapped.length,
    };
  }

  // 8. Check for self-intersections
  if (hasSelfIntersection(snapped)) {
    // Try with higher simplification tolerance
    const moreSimplified = simplifyContour(contour, SIMPLIFY_TOLERANCE * 2);
    const reSnapped = snapToHV(moreSimplified, SNAP_TOLERANCE);
    if (hasSelfIntersection(reSnapped)) {
      return {
        success: false,
        polygon: [],
        coverage: 0,
        spill: 0,
        processingMs: Date.now() - startTime,
        method: 'deterministic',
        error: 'Polygon has self-intersections after simplification',
        maskArea: regionArea,
        polygonArea: 0,
        vertexCount: snapped.length,
      };
    }
    // Use the more aggressively simplified version
    return validateAndReturn(reSnapped, filled, w, h, regionArea, startTime);
  }

  return validateAndReturn(snapped, filled, w, h, regionArea, startTime);
}

function validateAndReturn(
  polygon: Array<{ x: number; y: number }>,
  mask: Uint8Array,
  width: number,
  height: number,
  maskArea: number,
  startTime: number,
): OutlineResult {
  const { coverage, spill } = computeCoverageAndSpill(mask, width, height, polygon);
  const polyArea = polygonArea(polygon);
  const processingMs = Date.now() - startTime;

  if (coverage < TARGET_COVERAGE) {
    return {
      success: false,
      polygon,
      coverage,
      spill,
      processingMs,
      method: 'deterministic',
      error: `Coverage ${coverage.toFixed(3)} below target ${TARGET_COVERAGE}`,
      maskArea,
      polygonArea: polyArea,
      vertexCount: polygon.length,
    };
  }

  if (spill > MAX_SPILL) {
    return {
      success: false,
      polygon,
      coverage,
      spill,
      processingMs,
      method: 'deterministic',
      error: `Spill ${spill.toFixed(3)} above max ${MAX_SPILL}`,
      maskArea,
      polygonArea: polyArea,
      vertexCount: polygon.length,
    };
  }

  return {
    success: true,
    polygon,
    coverage,
    spill,
    processingMs,
    method: 'deterministic',
    maskArea,
    polygonArea: polyArea,
    vertexCount: polygon.length,
  };
}
