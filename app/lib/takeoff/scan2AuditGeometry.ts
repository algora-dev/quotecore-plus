/**
 * Scan 2B — Missing-line audit geometry helpers.
 *
 * Validates, snaps, deduplicates, and merges candidate missing segments
 * returned by Scan 2B into the existing Scan 2A line set.
 *
 * All geometry operates in the analysis image-pixel coordinate system.
 */

import type { V3Point, V3Line } from './ai-prompt-v3';

// ── Configuration ────────────────────────────────────────────────────────

export interface Scan2AuditConfig {
  minLength: number;           // reject segments shorter than this (px)
  endpointSnap: number;        // snap endpoints to existing endpoints within this (px)
  canonicalAngleTolerance: number; // degrees — snap near 0/45/90/135
  collinearAngleTolerance: number; // degrees — for overlap rejection
  perpTolerance: number;       // px — perpendicular distance for overlap
  overlapThreshold: number;    // 0-1 — fraction of candidate length covered
  boundsClampAllowance: number; // px — clamp coordinates this far outside bounds
}

export const DEFAULT_AUDIT_CONFIG: Scan2AuditConfig = {
  minLength: 5,
  endpointSnap: 6,
  canonicalAngleTolerance: 5,
  collinearAngleTolerance: 5,
  perpTolerance: 3,
  overlapThreshold: 0.8,
  boundsClampAllowance: 2,
};

// ── Types ────────────────────────────────────────────────────────────────

export interface RejectedCandidate {
  candidate: { start: V3Point; end: V3Point };
  reason: string;
}

export interface Scan2BResult {
  accepted: { start: V3Point; end: V3Point }[];
  rejected: RejectedCandidate[];
}

export interface Scan2BDebug {
  status: 'ok' | 'failed' | 'no_candidates';
  rawCandidateCount: number;
  acceptedCount: number;
  rejected: RejectedCandidate[];
  error?: string;
}

// ── Geometry helpers ─────────────────────────────────────────────────────

function distance(a: V3Point, b: V3Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function lengthOf(start: V3Point, end: V3Point): number {
  return distance(start, end);
}

function lineAngle(start: V3Point, end: V3Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return 0;
  let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

function angleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Perpendicular distance from point p to segment (a, b).
 */
function pointToSegmentDistance(p: V3Point, a: V3Point, b: V3Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Project a point onto a segment's infinite line, return t parameter.
 * t < 0 or t > 1 means outside the segment.
 */
function projectT(p: V3Point, a: V3Point, b: V3Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
}

// ── Canonical angle snap ─────────────────────────────────────────────────

const CANONICAL_ANGLES = [0, 45, 90, 135];

function snapToCanonicalAngle(
  start: V3Point,
  end: V3Point,
  tolerance: number,
): { start: V3Point; end: V3Point } {
  const angle = lineAngle(start, end);
  let bestAngle: number | null = null;
  let bestDiff = 360;

  for (const allowed of CANONICAL_ANGLES) {
    for (const candidate of [allowed, (allowed + 180) % 360]) {
      const diff = angleDiff(angle, candidate);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestAngle = candidate % 180;
      }
    }
  }

  if (bestAngle === null || bestDiff > tolerance) return { start, end };

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const len = lengthOf(start, end);
  const halfLen = len / 2;
  const rad = bestAngle * Math.PI / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);

  return {
    start: { x: Math.round(midX - dx * halfLen), y: Math.round(midY - dy * halfLen) },
    end: { x: Math.round(midX + dx * halfLen), y: Math.round(midY + dy * halfLen) },
  };
}

// ── Endpoint snapping ────────────────────────────────────────────────────

function snapPointToExisting(
  p: V3Point,
  existingPoints: V3Point[],
  tolerance: number,
): V3Point {
  let best: V3Point | null = null;
  let bestDist = Infinity;
  for (const ep of existingPoints) {
    const d = distance(p, ep);
    if (d < bestDist && d <= tolerance) {
      bestDist = d;
      best = ep;
    }
  }
  return best ?? p;
}

/**
 * Collect all endpoints from existing lines (both start and end).
 */
function collectEndpoints(lines: V3Line[]): V3Point[] {
  const pts: V3Point[] = [];
  for (const l of lines) {
    pts.push(l.start);
    pts.push(l.end);
  }
  return pts;
}

/**
 * Collect all unique junction points (endpoints that appear on 2+ lines).
 */
function collectJunctions(lines: V3Line[]): V3Point[] {
  const allPts = collectEndpoints(lines);
  const junctions: V3Point[] = [];
  const used = new Set<number>();

  for (let i = 0; i < allPts.length; i++) {
    if (used.has(i)) continue;
    let count = 1;
    for (let j = i + 1; j < allPts.length; j++) {
      if (used.has(j)) continue;
      if (distance(allPts[i], allPts[j]) <= 3) {
        count++;
        used.add(j);
      }
    }
    if (count >= 2) {
      junctions.push(allPts[i]);
    }
    used.add(i);
  }

  return junctions;
}

// ── Deduplication ────────────────────────────────────────────────────────

function canonicalize(start: V3Point, end: V3Point): string {
  // Order endpoints so (a,b) and (b,a) produce the same key
  const a = `${start.x},${start.y}`;
  const b = `${end.x},${end.y}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Check if a candidate substantially overlaps an existing collinear segment.
 */
function isCoveredByExisting(
  start: V3Point,
  end: V3Point,
  existingLines: V3Line[],
  config: Scan2AuditConfig,
): boolean {
  const candAngle = lineAngle(start, end);

  for (const ex of existingLines) {
    const exAngle = lineAngle(ex.start, ex.end);
    if (angleDiff(candAngle, exAngle) > config.collinearAngleTolerance) continue;

    // Check perpendicular distance — both candidate endpoints must be close
    const d1 = pointToSegmentDistance(start, ex.start, ex.end);
    const d2 = pointToSegmentDistance(end, ex.start, ex.end);
    if (d1 > config.perpTolerance || d2 > config.perpTolerance) continue;

    // Check projected overlap
    const tStart = projectT(start, ex.start, ex.end);
    const tEnd = projectT(end, ex.start, ex.end);
    const overlapMin = Math.max(0, Math.min(tStart, tEnd));
    const overlapMax = Math.min(1, Math.max(tStart, tEnd));
    const overlapFraction = Math.max(0, overlapMax - overlapMin);

    if (overlapFraction >= config.overlapThreshold) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a segment substantially overlaps any perimeter edge.
 */
function isPerimeterEdge(
  start: V3Point,
  end: V3Point,
  outlinePoints: V3Point[],
  config: Scan2AuditConfig,
): boolean {
  const candAngle = lineAngle(start, end);

  for (let i = 0; i < outlinePoints.length; i++) {
    const a = outlinePoints[i];
    const b = outlinePoints[(i + 1) % outlinePoints.length];
    const exAngle = lineAngle(a, b);

    if (angleDiff(candAngle, exAngle) > config.collinearAngleTolerance) continue;

    const d1 = pointToSegmentDistance(start, a, b);
    const d2 = pointToSegmentDistance(end, a, b);
    if (d1 > config.perpTolerance || d2 > config.perpTolerance) continue;

    const tStart = projectT(start, a, b);
    const tEnd = projectT(end, a, b);
    const overlapMin = Math.max(0, Math.min(tStart, tEnd));
    const overlapMax = Math.min(1, Math.max(tStart, tEnd));
    const overlapFraction = Math.max(0, overlapMax - overlapMin);

    if (overlapFraction >= config.overlapThreshold) {
      return true;
    }
  }

  return false;
}

// ── Split at intermediate junctions ─────────────────────────────────────

/**
 * If a candidate passes through an existing junction point (not at its endpoints),
 * split it at that junction.
 */
function splitAtJunctions(
  start: V3Point,
  end: V3Point,
  junctions: V3Point[],
  config: Scan2AuditConfig,
): { start: V3Point; end: V3Point }[] {
  // Find junctions that lie ON this segment (not at endpoints)
  const splitPoints: V3Point[] = [];
  for (const j of junctions) {
    // Skip if junction is at or very near an endpoint
    if (distance(j, start) <= config.endpointSnap) continue;
    if (distance(j, end) <= config.endpointSnap) continue;

    const d = pointToSegmentDistance(j, start, end);
    if (d <= config.perpTolerance) {
      // Verify the junction projects within the segment
      const t = projectT(j, start, end);
      if (t > 0.05 && t < 0.95) {
        splitPoints.push(j);
      }
    }
  }

  if (splitPoints.length === 0) {
    return [{ start, end }];
  }

  // Sort split points by projection along the segment
  splitPoints.sort((a, b) => projectT(a, start, end) - projectT(b, start, end));

  const result: { start: V3Point; end: V3Point }[] = [];
  let prev = start;
  for (const sp of splitPoints) {
    result.push({ start: prev, end: sp });
    prev = sp;
  }
  result.push({ start: prev, end });

  return result;
}

// ── Main merge function ──────────────────────────────────────────────────

/**
 * Process Scan 2B raw candidates and merge accepted segments into existing lines.
 *
 * Returns accepted segments (without IDs) and rejection details.
 */
export function mergeScan2BCandidates(
  rawCandidates: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>,
  existingLines: V3Line[],
  outlinePoints: V3Point[],
  imgW: number,
  imgH: number,
  config: Scan2AuditConfig = DEFAULT_AUDIT_CONFIG,
): Scan2BResult {
  const accepted: { start: V3Point; end: V3Point }[] = [];
  const rejected: RejectedCandidate[] = [];

  const existingEndpoints = collectEndpoints(existingLines);
  const junctions = collectJunctions(existingLines);
  const existingKeys = new Set<string>();
  for (const l of existingLines) {
    existingKeys.add(canonicalize(l.start, l.end));
  }

  // Also track keys of accepted segments to prevent intra-batch duplicates
  const acceptedKeys = new Set<string>();

  for (const raw of rawCandidates) {
    const originalCandidate = {
      start: { x: raw.start?.x ?? 0, y: raw.start?.y ?? 0 },
      end: { x: raw.end?.x ?? 0, y: raw.end?.y ?? 0 },
    };

    // 1. Validate finite numeric coordinates
    if (
      !Number.isFinite(originalCandidate.start.x) || !Number.isFinite(originalCandidate.start.y) ||
      !Number.isFinite(originalCandidate.end.x) || !Number.isFinite(originalCandidate.end.y)
    ) {
      rejected.push({ candidate: originalCandidate, reason: 'non_finite_coordinate' });
      continue;
    }

    // Round to integers
    let start: V3Point = {
      x: Math.round(originalCandidate.start.x),
      y: Math.round(originalCandidate.start.y),
    };
    let end: V3Point = {
      x: Math.round(originalCandidate.end.x),
      y: Math.round(originalCandidate.end.y),
    };

    // 2. Clamp tiny bounds overflow (1-2px), reject larger overflow
    const clamp = config.boundsClampAllowance;
    if (
      start.x < -clamp || start.x > imgW + clamp ||
      start.y < -clamp || start.y > imgH + clamp ||
      end.x < -clamp || end.x > imgW + clamp ||
      end.y < -clamp || end.y > imgH + clamp
    ) {
      rejected.push({ candidate: { start, end }, reason: 'out_of_bounds' });
      continue;
    }

    start = {
      x: Math.max(0, Math.min(imgW - 1, start.x)),
      y: Math.max(0, Math.min(imgH - 1, start.y)),
    };
    end = {
      x: Math.max(0, Math.min(imgW - 1, end.x)),
      y: Math.max(0, Math.min(imgH - 1, end.y)),
    };

    // 3. Reject zero-length and too-short segments
    const len = lengthOf(start, end);
    if (len < 1) {
      rejected.push({ candidate: { start, end }, reason: 'zero_length' });
      continue;
    }
    if (len < config.minLength) {
      rejected.push({ candidate: { start, end }, reason: 'too_short' });
      continue;
    }

    // 4. Snap to canonical angles
    const snapped = snapToCanonicalAngle(start, end, config.canonicalAngleTolerance);
    start = snapped.start;
    end = snapped.end;

    // 5. Snap endpoints to existing endpoints/junctions
    start = snapPointToExisting(start, existingEndpoints, config.endpointSnap);
    end = snapPointToExisting(end, existingEndpoints, config.endpointSnap);

    // 6. Split at intermediate junctions
    const splits = splitAtJunctions(start, end, junctions, config);

    for (const split of splits) {
      const splitLen = lengthOf(split.start, split.end);
      if (splitLen < config.minLength) {
        rejected.push({ candidate: split, reason: 'too_short_after_split' });
        continue;
      }

      // 7. Reject exact/reversed duplicates (against existing + already accepted)
      const key = canonicalize(split.start, split.end);
      if (existingKeys.has(key) || acceptedKeys.has(key)) {
        rejected.push({ candidate: split, reason: 'duplicate' });
        continue;
      }

      // 8. Reject substantially covered collinear candidates
      if (isCoveredByExisting(split.start, split.end, existingLines, config)) {
        rejected.push({ candidate: split, reason: 'covered_collinear_overlap' });
        continue;
      }

      // 9. Reject perimeter edges
      if (isPerimeterEdge(split.start, split.end, outlinePoints, config)) {
        rejected.push({ candidate: split, reason: 'perimeter_overlap' });
        continue;
      }

      accepted.push(split);
      acceptedKeys.add(key);
    }
  }

  return { accepted, rejected };
}

/**
 * Merge accepted Scan 2B segments into existing lines with sequential IDs.
 * Scan 2A lines keep their order; 2B segments appended after.
 */
export function mergeWithExisting(
  existingLines: V3Line[],
  accepted: { start: V3Point; end: V3Point }[],
): V3Line[] {
  const merged: V3Line[] = [...existingLines];
  const nextId = existingLines.length + 1;

  for (let i = 0; i < accepted.length; i++) {
    merged.push({
      id: `L${nextId + i}`,
      start: accepted[i].start,
      end: accepted[i].end,
      confidence: 0.5,
    });
  }

  return merged;
}
