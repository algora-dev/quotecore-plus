/**
 * Corner completeness pass - the hard corner rule (owner directive 2026-10-02).
 *
 * Every outline corner must be "something":
 *  - a concave (internal) corner should have a valley leaving it into the roof
 *    toward a ridge/hip/junction;
 *  - a convex (external) corner is a hip corner when the two adjacent outline
 *    edges are both spouting (gutter) edges on a roof that has internal
 *    structure; barge/gable corners are already covered by edge classification.
 *
 * For each expected corner with no retained line attached:
 *  1. search the review pool (lines Scan 2 previously dropped: angle-rejected
 *     or floating) for a candidate that starts at that corner;
 *  2. if the far end connects to the retained network within the snap
 *     tolerance, promote it (valley for concave, hip for convex);
 *  3. otherwise surface it as an uncertain review line (pink dotted) so the
 *     user can reclassify or delete it - never a silent loss;
 *  4. if no candidate exists at all, emit a corner marker (pink circle) at the
 *     exact vertex: "found this corner, could not find anything it connects to".
 *
 * All distances come from the calibration-aware snap tolerance, so the rule
 * behaves identically for metric, imperial and roofing-square calibrations.
 */

import type { V3Point, V3Line } from './ai-prompt-v3';
import { classifyOutlineVertices } from './outlineGeometry';

export interface CornerMarker {
  x: number;
  y: number;
  cornerType: 'concave' | 'convex';
  vertexId: string;
  reason: string;
}

export interface CornerCompletenessResult {
  /** Review-pool lines promoted to real components. */
  promoted: Array<{ line: V3Line; type: 'valley' | 'hip'; reason: string }>;
  /** Review-pool lines surfaced for review (pink dotted), keyed by line id. */
  reviewSurfaced: Array<{ line: V3Line; reason: string }>;
  /** Corners with no line and no review candidate (pink circle markers). */
  cornerMarkers: CornerMarker[];
}

function pointToSegmentDistance(p: V3Point, a: V3Point, b: V3Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const dist = (a: V3Point, b: V3Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** True when the point is within tolerance of any retained line endpoint or body. */
function connectsToNetwork(p: V3Point, lines: V3Line[], tolerance: number): boolean {
  for (const l of lines) {
    if (dist(p, l.start) <= tolerance || dist(p, l.end) <= tolerance) return true;
    if (pointToSegmentDistance(p, l.start, l.end) <= tolerance) return true;
  }
  return false;
}

export function cornerCompletenessPass(params: {
  outlinePoints: V3Point[];
  /** Retained internal lines (classified by Scan 3). */
  lines: V3Line[];
  /** Final classifications, keyed by line id (used for the convex spouting gate). */
  classificationByLineId: Map<string, { type: string }>;
  /** Outline edge line ids (E ids) with their classifications, for the convex gate. */
  edgeLineById: Map<string, { start: V3Point; end: V3Point; type: string }>;
  /** Previously dropped candidates from Scan 2 (angle-rejected / floating). */
  reviewLines: V3Line[];
  /** Calibration-derived snap tolerance in px. */
  snapTolerance: number;
}): CornerCompletenessResult {
  const { outlinePoints, lines, classificationByLineId, edgeLineById, reviewLines, snapTolerance } = params;
  const promoted: CornerCompletenessResult['promoted'] = [];
  const reviewSurfaced: CornerCompletenessResult['reviewSurfaced'] = [];
  const cornerMarkers: CornerMarker[] = [];

  let vertices: Array<{ id: string; x: number; y: number; cornerType: string; index: number }>;
  try {
    vertices = classifyOutlineVertices(outlinePoints);
  } catch {
    return { promoted, reviewSurfaced, cornerMarkers };
  }

  const internalLines = lines.filter(l => !l.id.startsWith('E'));
  const hasInternalStructure = classificationByLineId.size > 0
    && [...classificationByLineId.values()].some(c =>
      c.type === 'ridge' || c.type === 'hip' || c.type === 'valley' || c.type === 'broken_hip');

  const consumedReview = new Set<string>();

  for (const v of vertices) {
    if (v.cornerType !== 'concave' && v.cornerType !== 'convex') continue;

    const vp: V3Point = { x: v.x, y: v.y };

    // Convex corners are hip candidates only when both adjacent outline edges
    // are spouting (gutter) edges on a roof with internal structure. Barge or
    // gable corners are covered by the edge classification and stay quiet.
    if (v.cornerType === 'convex') {
      if (!hasInternalStructure) continue;
      const n = outlinePoints.length;
      const prevIdx = (v.index - 1 + n) % n;
      const nextIdx = (v.index + 1) % n;
      const edgeKey = (a: number, b: number) => `E${Math.min(a, b)}`;
      // Identify the two adjacent E lines by matching their endpoints to this
      // vertex's neighbours (edge ids follow outline order in outlineToEdgeLines).
      const ePrev = edgeLineById.get(edgeKey(prevIdx, v.index));
      const eNext = edgeLineById.get(edgeKey(v.index, nextIdx));
      const typeOf = (e: { type: string } | undefined) => e?.type ?? '';
      if (typeOf(ePrev) !== 'spouting' || typeOf(eNext) !== 'spouting') continue;
    }

    // Does a retained internal line already attach to this corner?
    const attached = internalLines.some(l =>
      dist(l.start, vp) <= snapTolerance || dist(l.end, vp) <= snapTolerance);
    if (attached) continue;

    // Search the review pool for a candidate starting at this corner.
    let best: { line: V3Line; startDist: number; far: V3Point } | null = null;
    for (const rl of reviewLines) {
      if (consumedReview.has(rl.id)) continue;
      const dStart = dist(rl.start, vp);
      const dEnd = dist(rl.end, vp);
      const startDist = Math.min(dStart, dEnd);
      if (startDist > snapTolerance) continue;
      const far = dStart <= dEnd ? rl.end : rl.start;
      if (!best || startDist < best.startDist) best = { line: rl, startDist, far };
    }

    if (!best) {
      cornerMarkers.push({
        x: v.x,
        y: v.y,
        cornerType: v.cornerType as 'concave' | 'convex',
        vertexId: v.id,
        reason: v.cornerType === 'concave'
          ? 'Internal corner with no line and no review candidate - expected a valley from this corner'
          : 'External spouting corner with no line and no review candidate - expected a hip from this corner',
      });
      continue;
    }

    consumedReview.add(best.line.id);
    // Snap the corner endpoint exactly onto the vertex so downstream geometry
    // is clean (same pattern as the offcuts connection snapping).
    const dStart = dist(best.line.start, vp);
    const snapped: V3Line = dStart <= dist(best.line.end, vp)
      ? { ...best.line, start: vp }
      : { ...best.line, end: vp };

    if (v.cornerType === 'concave') {
      if (connectsToNetwork(best.far, internalLines, snapTolerance)) {
        promoted.push({
          line: snapped,
          type: 'valley',
          reason: `Corner completeness: internal corner ${v.id} restored a valley (review candidate reconnects to the roof network)`,
        });
      } else {
        reviewSurfaced.push({
          line: snapped,
          reason: `Corner completeness: internal corner ${v.id} expects a valley - review this line, reclassify or delete`,
        });
      }
    } else {
      if (connectsToNetwork(best.far, internalLines, snapTolerance)) {
        promoted.push({
          line: snapped,
          type: 'hip',
          reason: `Corner completeness: spouting corner ${v.id} restored a hip (review candidate reconnects to the roof network)`,
        });
      } else {
        reviewSurfaced.push({
          line: snapped,
          reason: `Corner completeness: spouting corner ${v.id} may need a hip - review this line, reclassify or delete`,
        });
      }
    }
  }

  return { promoted, reviewSurfaced, cornerMarkers };
}

/**
 * Near-pair review rule (owner directive): two parallel-ish internal lines
 * closer than the calibration distance (150 mm) at any point are surfaced for
 * review instead of being trusted or silently dropped. A hip and a valley
 * running parallel is normal roofing and stays classified; only the
 * closer-than-150 mm case goes to review.
 */
export function nearPairReviewRule(params: {
  lines: V3Line[];
  classificationByLineId: Map<string, { type: string }>;
  nearPairTolerance: number;
}): { reviewIds: Set<string>; reasons: Map<string, string> } {
  const { lines, classificationByLineId, nearPairTolerance } = params;
  const reviewIds = new Set<string>();
  const reasons = new Map<string, string>();
  const internal = lines.filter(l => !l.id.startsWith('E'));
  if (internal.length < 2) return { reviewIds, reasons };

  const angleOf = (l: V3Line) => {
    const a = Math.atan2(l.end.y - l.start.y, l.end.x - l.start.x) * 180 / Math.PI;
    return ((a % 180) + 180) % 180; // undirected 0..180
  };
  const acuteDiff = (a: number, b: number) => {
    const d = Math.abs(a - b);
    return Math.min(d, 180 - d);
  };
  // A true junction means an endpoint coincides with the other line's
  // endpoint (after snapping, within a few px). Using the full near-pair
  // distance here would also swallow offset parallel pairs - exactly the
  // hip-next-to-valley case the rule must surface - so the junction test
  // uses a tight epsilon instead.
  const junctionEpsilon = Math.min(5, nearPairTolerance / 3);
  const sharesJunction = (a: V3Line, b: V3Line) =>
    dist(a.start, b.start) <= junctionEpsilon || dist(a.start, b.end) <= junctionEpsilon
    || dist(a.end, b.start) <= junctionEpsilon || dist(a.end, b.end) <= junctionEpsilon;
  const segDistance = (a: V3Line, b: V3Line) => Math.min(
    pointToSegmentDistance(a.start, b.start, b.end),
    pointToSegmentDistance(a.end, b.start, b.end),
    pointToSegmentDistance(b.start, a.start, a.end),
    pointToSegmentDistance(b.end, a.start, a.end),
  );

  for (let i = 0; i < internal.length; i++) {
    for (let j = i + 1; j < internal.length; j++) {
      const a = internal[i];
      const b = internal[j];
      if (acuteDiff(angleOf(a), angleOf(b)) > 10) continue; // only parallel-ish pairs
      if (sharesJunction(a, b)) continue; // meeting at a junction is normal
      const separation = segDistance(a, b);
      if (separation > nearPairTolerance) continue;
      const aType = classificationByLineId.get(a.id)?.type ?? 'uncertain';
      const bType = classificationByLineId.get(b.id)?.type ?? 'uncertain';
      const reason = `Near-pair review: parallel ${aType} and ${bType} closer than the calibration distance at some point - confirm or delete one`;
      reviewIds.add(a.id);
      reviewIds.add(b.id);
      reasons.set(a.id, reason);
      reasons.set(b.id, reason);
    }
  }
  return { reviewIds, reasons };
}
