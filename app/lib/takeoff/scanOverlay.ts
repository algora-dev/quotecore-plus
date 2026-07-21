/**
 * Scan overlay rendering — draws outline polygons and labeled line segments
 * on top of images using sharp SVG compositing.
 *
 * Used between scans to give the next GPT call a visual reference:
 * - After Scan 1: draw confirmed outline on original
 * - After Scan 2: draw outline + all labeled lines on original
 */

import sharp from 'sharp';
import type { V3Point, V3Line } from './ai-prompt-v3';

/**
 * Draw the Scan 2A audit overlay: original plan + blue outline + thin cyan lines.
 * No labels, no endpoint markers, no fill.
 * The coloured stroke is thinner than the black source stroke so Scan 2B can
 * distinguish traced vs untraced black lines.
 */
export async function renderScan2AuditOverlay(
  originalBuffer: Buffer,
  outlinePoints: V3Point[],
  lines: V3Line[],
  width: number,
  height: number,
): Promise<Buffer> {
  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  // Outline (blue, no fill)
  const outlinePts = outlinePoints.map(p => `${p.x},${p.y}`).join(' ');
  svgParts.push(`<polygon points="${outlinePts}" fill="none" stroke="#2563eb" stroke-width="5" stroke-linejoin="round"/>`);

  // Detected lines — thin cyan, round caps, no markers
  for (const line of lines) {
    svgParts.push(
      `<line x1="${line.start.x}" y1="${line.start.y}" x2="${line.end.x}" y2="${line.end.y}" stroke="#00ffff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>`
    );
  }

  svgParts.push('</svg>');
  const svgBuffer = Buffer.from(svgParts.join('\n'));
  return sharp(originalBuffer).composite([{ input: svgBuffer, blend: 'over' }]).png().toBuffer();
}

/**
 * Draw the Scan 1A audit overlay: original plan + thin high-contrast polygon
 * with small vertex markers at every point. Used as the visual input to Scan 1B.
 * Thinner stroke than renderOutlineOverlay so small steps/notches stay visible.
 */
export async function renderScan1AuditOverlay(
  originalBuffer: Buffer,
  polygonPoints: V3Point[],
  width: number,
  height: number,
): Promise<Buffer> {
  const pts = polygonPoints.map(p => `${p.x},${p.y}`).join(' ');
  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    // Thin high-contrast outline — no fill so interior details stay visible
    `<polygon points="${pts}" fill="none" stroke="#ff00ff" stroke-width="2" stroke-linejoin="round"/>`,
  ];
  // Small visible vertex markers at every polygon point
  for (const p of polygonPoints) {
    svgParts.push(`<circle cx="${p.x}" cy="${p.y}" r="4" fill="#ff00ff" stroke="white" stroke-width="1.5"/>`);
  }
  svgParts.push('</svg>');
  const svgBuffer = Buffer.from(svgParts.join('\n'));
  return sharp(originalBuffer).composite([{ input: svgBuffer, blend: 'over' }]).png().toBuffer();
}

/**
 * Draw the confirmed outline polygon on top of the original image.
 * Thick solid blue outline, NO fill — keeps the roof interior fully visible.
 */
export async function renderOutlineOverlay(
  originalBuffer: Buffer,
  outlinePoints: V3Point[],
  width: number,
  height: number,
): Promise<Buffer> {
  const pts = outlinePoints.map(p => `${p.x},${p.y}`).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polygon points="${pts}" fill="none" stroke="#2563eb" stroke-width="5" stroke-linejoin="round"/>
  </svg>`;
  const svgBuffer = Buffer.from(svg);
  return sharp(originalBuffer).composite([{ input: svgBuffer, blend: 'over' }]).png().toBuffer();
}

/**
 * Draw outline + all detected lines with labels on top of the original image.
 * Orange lines, blue outline, red labels at line midpoints.
 */
export async function renderLineOverlay(
  originalBuffer: Buffer,
  outlinePoints: V3Point[],
  lines: V3Line[],
  width: number,
  height: number,
): Promise<Buffer> {
  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  // Outline (blue solid)
  const outlinePts = outlinePoints.map(p => `${p.x},${p.y}`).join(' ');
  svgParts.push(`<polygon points="${outlinePts}" fill="rgba(59,130,246,0.08)" stroke="#2563eb" stroke-width="2"/>`);

  // Lines (orange)
  for (const line of lines) {
    svgParts.push(
      `<line x1="${line.start.x}" y1="${line.start.y}" x2="${line.end.x}" y2="${line.end.y}" stroke="#FF6B35" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`
    );
  }

  // Line endpoints (white circles)
  for (const line of lines) {
    svgParts.push(`<circle cx="${line.start.x}" cy="${line.start.y}" r="4" fill="#FF6B35" stroke="white" stroke-width="1.5"/>`);
    svgParts.push(`<circle cx="${line.end.x}" cy="${line.end.y}" r="4" fill="#FF6B35" stroke="white" stroke-width="1.5"/>`);
  }

  // Labels (red text at midpoint)
  for (const line of lines) {
    const midX = (line.start.x + line.end.x) / 2;
    const midY = (line.start.y + line.end.y) / 2;
    svgParts.push(
      `<rect x="${midX + 4}" y="${midY - 18}" width="${line.id.length * 10 + 8}" height="20" rx="3" fill="rgba(220,38,38,0.9)"/>`
    );
    svgParts.push(
      `<text x="${midX + 8}" y="${midY - 4}" font-family="monospace" font-size="14" font-weight="bold" fill="white">${line.id}</text>`
    );
  }

  svgParts.push('</svg>');
  const svgBuffer = Buffer.from(svgParts.join('\n'));
  return sharp(originalBuffer).composite([{ input: svgBuffer, blend: 'over' }]).png().toBuffer();
}

/**
 * Draw outline + labeled lines on a white background (no original image).
 * Used as a clean reference image for Scan 3.
 */
export async function renderCleanOverlay(
  outlinePoints: V3Point[],
  lines: V3Line[],
  width: number,
  height: number,
): Promise<Buffer> {
  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="white"/>`,
  ];

  // Outline (blue solid)
  const outlinePts = outlinePoints.map(p => `${p.x},${p.y}`).join(' ');
  svgParts.push(`<polygon points="${outlinePts}" fill="rgba(59,130,246,0.05)" stroke="#2563eb" stroke-width="2"/>`);

  // Lines (orange)
  for (const line of lines) {
    svgParts.push(
      `<line x1="${line.start.x}" y1="${line.start.y}" x2="${line.end.x}" y2="${line.end.y}" stroke="#FF6B35" stroke-width="4" stroke-linecap="round"/>`
    );
  }

  // Line endpoints
  for (const line of lines) {
    svgParts.push(`<circle cx="${line.start.x}" cy="${line.start.y}" r="5" fill="#FF6B35" stroke="white" stroke-width="2"/>`);
    svgParts.push(`<circle cx="${line.end.x}" cy="${line.end.y}" r="5" fill="#FF6B35" stroke="white" stroke-width="2"/>`);
  }

  // Labels
  for (const line of lines) {
    const midX = (line.start.x + line.end.x) / 2;
    const midY = (line.start.y + line.end.y) / 2;
    svgParts.push(
      `<rect x="${midX + 4}" y="${midY - 18}" width="${line.id.length * 10 + 8}" height="20" rx="3" fill="rgba(220,38,38,0.9)"/>`
    );
    svgParts.push(
      `<text x="${midX + 8}" y="${midY - 4}" font-family="monospace" font-size="14" font-weight="bold" fill="white">${line.id}</text>`
    );
  }

  // Outline vertex labels
  for (let i = 0; i < outlinePoints.length; i++) {
    const p = outlinePoints[i];
    svgParts.push(
      `<text x="${p.x + 6}" y="${p.y - 6}" font-family="monospace" font-size="11" fill="#2563eb">v${i}</text>`
    );
  }

  svgParts.push('</svg>');
  return sharp(Buffer.from(svgParts.join('\n'))).png().toBuffer();
}

/**
 * Generate outline edge segments from the outline polygon.
 * Each edge becomes a labeled line (E0, E1, ...).
 * Used to include perimeter edges in Scan 3 classification.
 */
export function outlineToEdgeLines(outlinePoints: V3Point[]): V3Line[] {
  const edges: V3Line[] = [];
  for (let i = 0; i < outlinePoints.length; i++) {
    const start = outlinePoints[i];
    const end = outlinePoints[(i + 1) % outlinePoints.length];
    edges.push({
      id: `E${i}`,
      start: { ...start },
      end: { ...end },
      confidence: 1.0,
    });
  }
  return edges;
}
