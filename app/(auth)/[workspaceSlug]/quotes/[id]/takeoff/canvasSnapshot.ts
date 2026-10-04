/**
 * Deterministic full-scene canvas snapshots (owner rule 2026-10-02).
 *
 * The takeoff canvas follows the design-tool viewport pattern: the canvas
 * ELEMENT is sized to the visible viewport and the plan is placed by the
 * Fabric viewportTransform (zoom + pan). Exporting with toDataURL() on the
 * live element therefore captures whatever the user currently sees - a
 * cropped fragment when zoomed in, a tiny image with margins when zoomed
 * out. Quotes must instead always store the FULL plan image with the drawn
 * lines, independent of the view.
 *
 * This helper swaps the live canvas to the plan image's world bounds
 * (background image placement, native resolution, capped) with an identity
 * viewport, renders, captures, and restores everything synchronously -
 * the browser never paints mid-swap, so the user sees no flicker.
 */
import type { Canvas, Image as FabricImage } from 'fabric';

/** Cap so a large plan's PNG stays well inside the server-action body limit. */
const MAX_EXPORT_LONG_SIDE = 2400;

/**
 * Export the full scene (plan image bounds) as a PNG data URL.
 *
 * - includeBackground: true  → plan image + drawings (full canvas snapshot)
 * - includeBackground: false → drawings only on white, no plan (lines-only)
 *
 * Returns null only when rendering fails (caller should skip the upload).
 */
export function snapshotSceneAtImageBounds(
  canvas: Canvas,
  opts: { includeBackground: boolean; format?: 'png' | 'jpeg'; quality?: number },
): string | null {
  const bg = canvas.backgroundImage as FabricImage | undefined;

  // Scene bounds: the background image's world placement. Fall back to the
  // current element dims when no background image is set (blank canvas).
  let left = 0;
  let top = 0;
  let width = canvas.getWidth();
  let height = canvas.getHeight();
  // Export multiplier: 1 scene px = 1/bg.scaleX image px -> native resolution.
  let multiplier = 1;
  if (bg) {
    left = bg.left ?? 0;
    top = bg.top ?? 0;
    width = Math.max(1, Math.round(bg.getScaledWidth()));
    height = Math.max(1, Math.round(bg.getScaledHeight()));
    const scaleX = bg.scaleX ?? 1;
    if (Number.isFinite(scaleX) && scaleX > 0) multiplier = 1 / scaleX;
  }
  const longSide = Math.max(width * multiplier, height * multiplier);
  if (longSide > MAX_EXPORT_LONG_SIDE) multiplier *= MAX_EXPORT_LONG_SIDE / longSide;

  const originalW = canvas.getWidth();
  const originalH = canvas.getHeight();
  const originalVpt = [...canvas.viewportTransform] as [
    number, number, number, number, number, number,
  ];
  const originalBgVisible = bg?.visible !== false;
  const originalBgColor = canvas.backgroundColor;

  try {
    if (bg && !opts.includeBackground) bg.visible = false;
    if (!opts.includeBackground) canvas.backgroundColor = '#ffffff';

    const outW = Math.max(1, Math.round(width * multiplier));
    const outH = Math.max(1, Math.round(height * multiplier));
    // World rect (left, top)..(left+width, top+height) -> full export bitmap.
    canvas.setDimensions({ width: outW, height: outH });
    canvas.setViewportTransform([multiplier, 0, 0, multiplier, -left * multiplier, -top * multiplier]);
    canvas.renderAll();
    // JPEG for the full-canvas variant: a native-resolution plan PNG is
    // multiple MB as base64 and breaks the server-action body limit; JPEG
    // at q0.92 is visually identical for plan imagery and a fraction of
    // the size. Lines-only stays lossless PNG (tiny linework).
    return canvas.toDataURL({
      format: opts.format === 'jpeg' ? 'jpeg' : 'png',
      quality: opts.quality ?? 0.92,
      multiplier: 1,
    });
  } catch (error) {
    console.error('[canvasSnapshot] export failed:', error);
    return null;
  } finally {
    if (bg) bg.visible = originalBgVisible;
    canvas.backgroundColor = originalBgColor;
    canvas.setDimensions({ width: originalW, height: originalH });
    canvas.setViewportTransform(originalVpt);
    canvas.renderAll();
  }
}
