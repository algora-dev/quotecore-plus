/**
 * Adaptive linework extraction.
 *
 * Generates a high-contrast binary image where narrow strokes (ridges, hips,
 * valleys, barges) are preserved as black lines on white, while uniform
 * shading/fill regions disappear.
 *
 * Method: local adaptive thresholding via sharp's `threshold` with a
 * statistical neighbourhood approach. Each pixel is compared against the
 * mean of its local window — if significantly darker than the local mean,
 * it's a line pixel; otherwise it's background.
 *
 * For the component phase, polygon masks can be applied so only strokes
 * inside the union of the confirmed roof outlines are retained.
 */

import sharp from 'sharp';

export interface LineworkOptions {
  /** Window size for local adaptive thresholding (odd, default 25). */
  windowSize?: number;
  /** Sensitivity: pixels darker than (localMean - sensitivity) are strokes (default 10). */
  sensitivity?: number;
  /** Optional polygon masks (in image pixel coords). Everything outside their union is white. */
  maskPolygons?: Array<Array<{ x: number; y: number }>>;
  /** Image width (for mask coordinate validation). */
  width?: number;
  /** Image height (for mask coordinate validation). */
  height?: number;
}

/**
 * Generate an adaptive linework image from a source buffer.
 *
 * The pipeline:
 * 1. Convert to grayscale
 * 2. Blur slightly to reduce noise
 * 3. Compute local mean via box blur at windowSize
 * 4. Compare: pixel < (localMean - sensitivity) → black stroke, else white
 * 5. Optionally apply the union of polygon masks
 * 6. Return as PNG buffer (same dimensions as input)
 */
export async function generateAdaptiveLinework(
  sourceBuffer: Buffer,
  options: LineworkOptions = {},
): Promise<Buffer> {
  const {
    windowSize = 25,
    sensitivity = 10,
    maskPolygons,
    width: maskWidth,
    height: maskHeight,
  } = options;

  // Step 1: Load and get metadata
  const image = sharp(sourceBuffer).rotate();
  const metadata = await image.metadata();
  const _width = metadata.width!;
  const _height = metadata.height!;

  // Step 2: Grayscale + raw pixels
  const { data: grayPixels, info } = await image
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;

  // Step 3: Compute local mean via box blur
  // We use a separable box filter for efficiency
  const localMean = new Float32Array(w * h);
  const halfWindow = Math.floor(windowSize / 2);

  // Horizontal pass
  const tempBuffer = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    // Initialize window
    for (let x = -halfWindow; x <= halfWindow; x++) {
      const clampedX = Math.max(0, Math.min(w - 1, x));
      sum += grayPixels[y * w + clampedX];
    }
    const windowWidth = halfWindow * 2 + 1;
    for (let x = 0; x < w; x++) {
      tempBuffer[y * w + x] = sum / windowWidth;
      // Slide window
      const removeX = Math.max(0, Math.min(w - 1, x - halfWindow));
      const addX = Math.max(0, Math.min(w - 1, x + halfWindow + 1));
      sum -= grayPixels[y * w + removeX];
      sum += grayPixels[y * w + addX];
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -halfWindow; y <= halfWindow; y++) {
      const clampedY = Math.max(0, Math.min(h - 1, y));
      sum += tempBuffer[clampedY * w + x];
    }
    const windowHeight = halfWindow * 2 + 1;
    for (let y = 0; y < h; y++) {
      localMean[y * w + x] = sum / windowHeight;
      const removeY = Math.max(0, Math.min(h - 1, y - halfWindow));
      const addY = Math.max(0, Math.min(h - 1, y + halfWindow + 1));
      sum -= tempBuffer[removeY * w + x];
      sum += tempBuffer[addY * w + x];
    }
  }

  // Step 4: Adaptive threshold — pixel is stroke if darker than local mean - sensitivity
  const outputPixels = Buffer.alloc(w * h * 3); // RGB output
  for (let i = 0; i < w * h; i++) {
    const pixelValue = grayPixels[i];
    const threshold = localMean[i] - sensitivity;
    const isStroke = pixelValue < threshold;

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

  // Step 5: Apply the union of all valid polygon masks if provided
  const validMaskPolygons = maskPolygons?.filter(polygon => polygon.length >= 3) ?? [];
  if (validMaskPolygons.length > 0 && maskWidth && maskHeight) {
    const scaleX = w / maskWidth;
    const scaleY = h / maskHeight;
    const scaledMasks = validMaskPolygons.map(polygon => (
      polygon.map(point => ({
        x: point.x * scaleX,
        y: point.y * scaleY,
      }))
    ));

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!scaledMasks.some(polygon => pointInPolygon(x, y, polygon))) {
          const idx = (y * w + x) * 3;
          outputPixels[idx] = 255;
          outputPixels[idx + 1] = 255;
          outputPixels[idx + 2] = 255;
        }
      }
    }
  }

  // Step 6: Return as PNG
  return sharp(outputPixels, {
    raw: { width: w, height: h, channels: 3 },
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
      // Check 3x3 neighbourhood for dark pixels
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
