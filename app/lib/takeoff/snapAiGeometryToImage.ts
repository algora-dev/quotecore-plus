import type { AiLineEntry, AiScanData, CanvasPoint, PlaceholderType } from './applyAiResults';

const DARK_THRESHOLD = 110;
const SEARCH_RADIUS = 40;
const PIXEL_RADIUS = 1;
const MAX_RUN_GAP = 3;
const ANCHOR_SNAP_DISTANCE = 48;

const AXIS_ALIGNED_TYPES: PlaceholderType[] = ['ridges', 'barges', 'spouting'];

function isDarkNear(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  for (let offset = -PIXEL_RADIUS; offset <= PIXEL_RADIUS; offset++) {
    const px = Math.round(x);
    const py = Math.round(y + offset);
    if (px >= 0 && px < width && py >= 0 && py < height && pixels[py * width + px] < DARK_THRESHOLD) {
      return true;
    }
  }
  return false;
}

function scoreHorizontal(
  pixels: Uint8Array,
  width: number,
  height: number,
  y: number,
  startX: number,
  endX: number,
): number {
  let score = 0;
  for (let x = startX; x <= endX; x++) {
    if (isDarkNear(pixels, width, height, x, y)) score++;
  }
  return score;
}

function scoreVertical(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  startY: number,
  endY: number,
): number {
  let score = 0;
  for (let y = startY; y <= endY; y++) {
    if (isDarkNearVertical(pixels, width, height, x, y)) score++;
  }
  return score;
}

function isDarkNearVertical(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  for (let offset = -PIXEL_RADIUS; offset <= PIXEL_RADIUS; offset++) {
    const px = Math.round(x + offset);
    const py = Math.round(y);
    if (px >= 0 && px < width && py >= 0 && py < height && pixels[py * width + px] < DARK_THRESHOLD) {
      return true;
    }
  }
  return false;
}

function longestDarkRun(
  start: number,
  end: number,
  isDark: (position: number) => boolean,
): { start: number; end: number } | null {
  let currentStart: number | null = null;
  let lastDark = 0;
  let gap = 0;
  let best: { start: number; end: number } | null = null;

  for (let position = start; position <= end; position++) {
    if (isDark(position)) {
      if (currentStart === null) currentStart = position;
      lastDark = position;
      gap = 0;
    } else if (currentStart !== null) {
      gap++;
      if (gap > MAX_RUN_GAP) {
        if (!best || lastDark - currentStart > best.end - best.start) {
          best = { start: currentStart, end: lastDark };
        }
        currentStart = null;
        gap = 0;
      }
    }
  }

  if (currentStart !== null && (!best || lastDark - currentStart > best.end - best.start)) {
    best = { start: currentStart, end: lastDark };
  }
  return best;
}

function overlapsEnough(run: { start: number; end: number }, start: number, end: number): boolean {
  const originalLength = Math.max(1, end - start);
  const overlap = Math.max(0, Math.min(run.end, end) - Math.max(run.start, start));
  return run.end - run.start >= Math.max(12, originalLength * 0.45)
    && overlap >= originalLength * 0.4;
}

function snapAxisAlignedLine(
  entry: AiLineEntry,
  pixels: Uint8Array,
  width: number,
  height: number,
): AiLineEntry {
  const first = entry.points[0];
  const last = entry.points[entry.points.length - 1];
  const horizontal = Math.abs(last.x - first.x) >= Math.abs(last.y - first.y);

  if (horizontal) {
    const startX = Math.max(0, Math.round(Math.min(first.x, last.x)));
    const endX = Math.min(width - 1, Math.round(Math.max(first.x, last.x)));
    const originalY = Math.round((first.y + last.y) / 2);
    let bestY = originalY;
    let bestScore = -1;
    for (let y = Math.max(0, originalY - SEARCH_RADIUS); y <= Math.min(height - 1, originalY + SEARCH_RADIUS); y++) {
      const score = scoreHorizontal(pixels, width, height, y, startX, endX);
      if (score > bestScore || (score === bestScore && Math.abs(y - originalY) < Math.abs(bestY - originalY))) {
        bestScore = score;
        bestY = y;
      }
    }
    const run = longestDarkRun(
      Math.max(0, startX - SEARCH_RADIUS),
      Math.min(width - 1, endX + SEARCH_RADIUS),
      x => isDarkNear(pixels, width, height, x, bestY),
    );
    const validRun = run && overlapsEnough(run, startX, endX) ? run : null;
    const snappedStart = validRun && !isDarkNear(pixels, width, height, startX, bestY) ? validRun.start : startX;
    const snappedEnd = validRun && !isDarkNear(pixels, width, height, endX, bestY) ? validRun.end : endX;
    const leftToRight = first.x <= last.x;
    return {
      points: leftToRight
        ? [{ x: snappedStart, y: bestY }, { x: snappedEnd, y: bestY }]
        : [{ x: snappedEnd, y: bestY }, { x: snappedStart, y: bestY }],
    };
  }

  const startY = Math.max(0, Math.round(Math.min(first.y, last.y)));
  const endY = Math.min(height - 1, Math.round(Math.max(first.y, last.y)));
  const originalX = Math.round((first.x + last.x) / 2);
  let bestX = originalX;
  let bestScore = -1;
  for (let x = Math.max(0, originalX - SEARCH_RADIUS); x <= Math.min(width - 1, originalX + SEARCH_RADIUS); x++) {
    const score = scoreVertical(pixels, width, height, x, startY, endY);
    if (score > bestScore || (score === bestScore && Math.abs(x - originalX) < Math.abs(bestX - originalX))) {
      bestScore = score;
      bestX = x;
    }
  }
  const run = longestDarkRun(
    Math.max(0, startY - SEARCH_RADIUS),
    Math.min(height - 1, endY + SEARCH_RADIUS),
    y => isDarkNearVertical(pixels, width, height, bestX, y),
  );
  const validRun = run && overlapsEnough(run, startY, endY) ? run : null;
  const snappedStart = validRun && !isDarkNearVertical(pixels, width, height, bestX, startY) ? validRun.start : startY;
  const snappedEnd = validRun && !isDarkNearVertical(pixels, width, height, bestX, endY) ? validRun.end : endY;
  const topToBottom = first.y <= last.y;
  return {
    points: topToBottom
      ? [{ x: bestX, y: snappedStart }, { x: bestX, y: snappedEnd }]
      : [{ x: bestX, y: snappedEnd }, { x: bestX, y: snappedStart }],
  };
}

function snapPointToAnchor(point: CanvasPoint, anchors: CanvasPoint[]): CanvasPoint {
  let nearest = point;
  let nearestDistance = ANCHOR_SNAP_DISTANCE;
  for (const anchor of anchors) {
    const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    if (distance === 0) return { ...point };
    if (distance < nearestDistance) {
      nearest = anchor;
      nearestDistance = distance;
    }
  }
  return { ...nearest };
}

export function snapAiGeometryToImage(
  aiData: AiScanData,
  pixels: Uint8Array,
  width: number,
  height: number,
): AiScanData {
  const snapped = structuredClone(aiData);

  for (const type of AXIS_ALIGNED_TYPES) {
    snapped.components[type] = snapped.components[type].map(entry => (
      snapAxisAlignedLine(entry, pixels, width, height)
    ));
  }

  const anchors = [
    ...snapped.roof_areas.flatMap(area => area.points),
    ...AXIS_ALIGNED_TYPES.flatMap(type => snapped.components[type].flatMap(entry => entry.points)),
  ];

  const diagonalTypes: PlaceholderType[] = ['hips', 'valleys'];
  for (const type of diagonalTypes) {
    snapped.components[type] = snapped.components[type].map(entry => ({
      points: entry.points.map(point => snapPointToAnchor(point, anchors)),
    }));
  }

  return snapped;
}
