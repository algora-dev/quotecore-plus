/**
 * Adaptive linework extraction.
 *
 * Generates a high-contrast binary image where narrow strokes (ridges, hips,
 * valleys, barges) are preserved as black lines on white, while uniform
 * shading/fill regions disappear.
 *
 * Method: local adaptive thresholding using sharp's native blur (libvips,
 * C-optimized) for the local mean, then compare each pixel against
 * (localMean - sensitivity). Uses sharp pipeline operations for speed
 * instead of per-pixel JS loops.
 *
 * For the component phase, a polygon mask can be applied so only strokes
 * inside the confirmed roof outline are retained.
 */

import sharp from 'sharp';

export interface LineworkOptions {
  /** Window size for local adaptive thresholding (odd, default 25). */
  windowSize?: number;
  /** Sensitivity: pixels darker than (localMean - sensitivity) are strokes (default 10). */
  sensitivity?: number;
  /** Optional polygon mask (in image pixel coords). Everything outside is white. */
  maskPolygon?: Array<{ x: number; y: number }>;
  /** Optional multiple polygon mask (union — pixel inside ANY polygon is kept). */
  maskPolygons?: Array<Array<{ x: number; y: number }>>;
  /** Image width (for mask coordinate validation). */
  width?: number;
  /** Image height (for mask coordinate validation). */
  height?: number;
}

/**
 * Generate an adaptive linework image from a source buffer.
 *
 * Pipeline:
 * 1. Convert to grayscale
 * 2. Compute local mean via sharp blur (box filter at windowSize radius)
 * 3. Compute difference: localMean - pixel → if > sensitivity, it's a stroke
 * 4. Optionally apply polygon mask
 * 5. Return as PNG buffer (same dimensions as input)
 */
export async function generateAdaptiveLinework(
  sourceBuffer: Buffer,
  options: LineworkOptions = {},
): Promise<Buffer> {
  const {
    windowSize = 25,
    sensitivity = 10,
    maskPolygon,
    maskPolygons,
    width: maskWidth,
    height: maskHeight,
  } = options;

  const radius = Math.floor(windowSize / 2);

  // Load image and get dimensions
  const image = sharp(sourceBuffer).rotate();
  const metadata = await image.metadata();
  const _w = metadata.width!;
  const _h = metadata.height!;

  // Grayscale raw pixels (original)
  const { data: grayPixels, info } = await sharp(sourceBuffer)
    .rotate()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gw = info.width;
  const gh = info.height;

  // Compute local mean using sharp's box blur (fast, C-level)
  // sharp's blur(radius) does a gaussian approximation, but for our purposes
  // a box filter via resize trick is more accurate. We'll use composite:
  // shrink to small, enlarge back — gives us a fast box average.
  // Actually, sharp.blur() with a radius is the fastest approach.
  const { data: blurPixels } = await sharp(sourceBuffer)
    .rotate()
    .greyscale()
    .blur(radius)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Adaptive threshold: pixel is stroke if (localMean - pixel) > sensitivity
  const outputPixels = Buffer.alloc(gw * gh * 3); // RGB output
  for (let i = 0; i < gw * gh; i++) {
    const pixelValue = grayPixels[i];
    const localMean = blurPixels[i];
    const isStroke = (localMean - pixelValue) > sensitivity;

    if (isStroke) {
      outputPixels[i * 3] = 0;     // R
      outputPixels[i * 3 + 1] = 0; // G
      outputPixels[i * 3 + 2] = 0; // B
    } else {
      outputPixels[i * 3] = 255;     // R
      outputPixels[i * 3 + 1] = 255; // G
      outputPixels[i * 3 + 2] = 255; // B
    }
  }

  // Apply polygon mask if provided (supports single or multiple polygons)
  const allMasks = [
    ...(maskPolygon ? [maskPolygon] : []),
    ...(maskPolygons ?? []),
  ];
  if (allMasks.length > 0 && maskWidth && maskHeight) {
    const scaleX = gw / maskWidth;
    const scaleY = gh / maskHeight;
    const scaledMasks = allMasks.map(poly => poly.map(p => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
    })));

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const insideAny = scaledMasks.some(mask => pointInPolygon(x, y, mask));
        if (!insideAny) {
          const idx = (y * gw + x) * 3;
          outputPixels[idx] = 255;
          outputPixels[idx + 1] = 255;
          outputPixels[idx + 2] = 255;
        }
      }
    }
  }

  return sharp(outputPixels, {
    raw: { width: gw, height: gh, channels: 3 },
  })
    .png({ compressionLevel: 8 })
    .toBuffer();
}

/**
 * Point-in-polygon test (ray casting).
 */
function pointInPolygon(
  x: number,
  y: number,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Pixel-support scoring for a line segment.
 *
 * Samples points along the line and checks how many are "dark" (below threshold)
 * in the grayscale image. Returns a score from 0 to 1.
 */
export function scoreLineSupport(
  pixels: Uint8Array,
  width: number,
  height: number,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  darkThreshold: number = 110,
): { score: number; darkCount: number; totalSamples: number } {
  const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const totalSamples = Math.max(10, Math.floor(length));
  let darkCount = 0;

  for (let i = 0; i <= totalSamples; i++) {
    const t = i / totalSamples;
    const x = Math.round(p1.x + (p2.x - p1.x) * t);
    const y = Math.round(p1.y + (p2.y - p1.y) * t);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      let found = false;
      for (let dy = -1; dy <= 1 && !found; dy++) {
        for (let dx = -1; dx <= 1 && !found; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            if (pixels[py * width + px] < darkThreshold) {
              found = true;
            }
          }
        }
      }
      if (found) darkCount++;
    }
  }

  return {
    score: darkCount / totalSamples,
    darkCount,
    totalSamples,
  };
}
