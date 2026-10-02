/**
 * Deterministic roof-topology completion (owner directive 2026-10-02).
 *
 * The AI scan output is a PROPOSAL, not a complete roof. This pass runs
 * after AI detection (and after the corner-completeness review-pool
 * promotion) and recovers likely missing roof-plane boundaries purely from
 * geometry - no vision-model round trips.
 *
 * Recovery origins:
 *  1. Unresolved concave outline corners (no internal line leaves the
 *     corner): a valley boundary should leave that corner into the roof.
 *     Ordinary convex corners never trigger recovery by themselves - only
 *     corner markers produced by the corner-completeness pass (which gates
 *     convex corners to spouting corners on structured roofs) are used.
 *  2. Dangling internal line endpoints: an endpoint that terminates in open
 *     roof space (not on the outline, not at any junction) should connect
 *     onward to the network.
 *
 * For each origin the pass searches along prioritised directions
 * (horizontal, vertical, +45, -45 - each in both senses, plus the corner's
 * inward bisector when it is distinct) with an angular tolerance implied by
 * the direction set, and traces each ray to the FIRST thing it hits:
 * junction endpoint > line body (T-junction) > outline edge.
 *
 * Scoring (deterministic, evidence-based):
 *   angle    0.30  deviation from the canonical directions
 *   target   0.30  junction endpoint 1.0 / T-on-body 0.55 / outline 0.40
 *   length   0.14  sweet spot 8-40% of the roof diagonal
 *   origin   +0.08 concave corner / +0.06 dangling / +0.02 convex
 *   twin     +0.12 existing parallel line converging on the same far
 *                 junction (up-and-over pattern evidence)
 *
 * Decision rules:
 *  - overwhelming winner (score >= 0.72 and margin >= 0.12 over the next
 *    distinct direction; dangling origins only need the threshold) ->
 *    auto-promote (valley from a concave corner, hip from a qualified
 *    spouting corner, ridge for interior junctions);
 *  - plausible but ambiguous (score >= 0.5) -> pink dotted review candidate
 *    (never a silent false negative, never a blind auto-line);
 *  - nothing plausible -> the corner keeps its existing pink circle marker.
 *
 * False-positive guards:
 *  - ordinary convex corners are never origins by themselves;
 *  - candidates duplicating an existing line or an OUTLINE EDGE corridor
 *    are rejected;
 *  - rays stop at the first network hit (no lines through other lines);
 *  - length bounds (3%-60% of the roof diagonal) reject micro-spurs and
 *    plan-spanning monsters;
 *  - near-parallel is NOT a rejection reason (up-and-over hips and valleys
 *    legitimately run parallel); only corridor overlap rejects.
 */

import type { V3Point, V3Line } from './ai-prompt-v3';
import { classifyOutlineVertices } from './outlineGeometry';
import type { CornerMarker } from './cornerCompleteness';

// ── Tunables ────────────────────────────────────────────────────────────

/** Score a candidate needs to be auto-promoted. */
export const AUTO_PROMOTE_SCORE = 0.72;
/** Margin over the next DISTINCT direction required for auto-promotion
 *  (corner origins only - a corner with two plausible boundaries is
 *  ambiguous and goes to review). */
export const AUTO_PROMOTE_MARGIN = 0.12;
/** Minimum score for a candidate to surface as a pink review line. */
export const REVIEW_THRESHOLD = 0.5;
/** Candidate length bounds, as a fraction of the roof bbox diagonal. */
export const MIN_LENGTH_FRACTION = 0.03;
export const MAX_LENGTH_FRACTION = 0.6;
/** Perpendicular corridor deviation under which a candidate duplicates an
 *  existing line (fraction of the snap tolerance, floor 3px). */
export const DUPLICATE_CORRIDOR_FRACTION = 0.34;
/** Angular tolerance used when scoring deviation from canonical degrees. */
export const CANONICAL_ANGLE_TOL_DEG = 12;
/** Two candidates whose undirected angles differ by <= this and whose
 *  targets are within max(2*snap, 40px) count as the same recovery. */
export const SAME_RECOVERY_ANGLE_DEG = 8;

// ── Types ───────────────────────────────────────────────────────────────

export interface TopologyPromotion {
  line: V3Line;
  type: 'valley' | 'hip' | 'ridge';
  reason: string;
  score: number;
}

export interface TopologyReviewCandidate {
  line: V3Line;
  suggestedType: 'valley' | 'hip' | 'ridge';
  reason: string;
  score: number;
}

export interface TopologyCompletionStats {
  origins: number;
  candidates: number;
  autoPromoted: number;
  reviewCandidates: number;
}

export interface TopologyCompletionResult {
  promoted: TopologyPromotion[];
  reviewCandidates: TopologyReviewCandidate[];
  stats: TopologyCompletionStats;
}

interface Origin {
  point: V3Point;
  kind: 'concave' | 'convex' | 'dangling';
  label: string;
  fallbackType: 'valley' | 'hip' | 'ridge';
  /** Structural line ids whose endpoint this origin is (dangling case). */
  ownLineIds: Set<string>;
}

interface RawCandidate {
  line: V3Line;
  suggestedType: 'valley' | 'hip' | 'ridge';
  angleDeg: number;
  canonicalDev: number;
  targetKind: 'junction' | 'body' | 'outline';
  length: number;
  targetPoint: V3Point;
  twin: boolean;
}

// ── Geometry helpers ────────────────────────────────────────────────────

const dist = (a: V3Point, b: V3Point) => Math.hypot(b.x - a.x, b.y - a.y);

function pointToSegmentDistance(p: V3Point, a: V3Point, b: V3Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function pointInsidePolygon(poly: V3Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const hits = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (hits) inside = !inside;
  }
  return inside;
}

/** Undirected angle of a segment in degrees, normalised to [0, 180). */
function segmentAngleDeg(a: V3Point, b: V3Point): number {
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return ((ang % 180) + 180) % 180;
}

/** Acute angular difference between two undirected angles in degrees. */
function acuteAngleDiff(aDeg: number, bDeg: number): number {
  const d = Math.abs(aDeg - bDeg);
  return Math.min(d, 180 - d);
}

const CANONICAL_DEGS = [0, 90, 45, 135];

// ── Core pass ───────────────────────────────────────────────────────────

export function topologyCompletionPass(params: {
  outlinePoints: V3Point[];
  /** Retained internal component lines (post corner-pass promotion). */
  lines: V3Line[];
  /** Unresolved corner markers from the corner-completeness pass. */
  cornerMarkers: CornerMarker[];
  /** Calibration-aware snap tolerance in px. */
  snapTolerance: number;
}): TopologyCompletionResult {
  const { outlinePoints, lines, cornerMarkers, snapTolerance } = params;
  const stats: TopologyCompletionStats = { origins: 0, candidates: 0, autoPromoted: 0, reviewCandidates: 0 };
  const empty: TopologyCompletionResult = { promoted: [], reviewCandidates: [], stats };
  if (outlinePoints.length < 3 || lines.length === 0) return empty;

  const n = outlinePoints.length;

  // Roof size references.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of outlinePoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const roofDiagonal = Math.hypot(maxX - minX, maxY - minY) || 1;
  const minLen = Math.max(MIN_LENGTH_FRACTION * roofDiagonal, snapTolerance * 2);
  const maxLen = MAX_LENGTH_FRACTION * roofDiagonal;

  const vertices = (() => {
    try { return classifyOutlineVertices(outlinePoints); } catch { return null; }
  })();
  if (!vertices) return empty;

  const nearOutline = (p: V3Point): boolean => {
    for (let i = 0; i < n; i++) {
      if (pointToSegmentDistance(p, outlinePoints[i], outlinePoints[(i + 1) % n]) <= snapTolerance) return true;
    }
    return false;
  };

  // Structural lines: exclude lines that run along the outline (perimeter
  // furniture never "leaves" a corner into the roof and its endpoints are
  // not junction evidence).
  const structural = lines.filter(l => {
    const mid: V3Point = { x: (l.start.x + l.end.x) / 2, y: (l.start.y + l.end.y) / 2 };
    return !(nearOutline(l.start) && nearOutline(l.end) && nearOutline(mid));
  });
  if (structural.length === 0) return empty;

  const outlineEdges: Array<{ a: V3Point; b: V3Point }> = [];
  for (let i = 0; i < n; i++) outlineEdges.push({ a: outlinePoints[i], b: outlinePoints[(i + 1) % n] });

  // ── Origins ───────────────────────────────────────────────────────────
  const origins: Origin[] = [];

  for (const m of cornerMarkers) {
    origins.push({
      point: { x: m.x, y: m.y },
      kind: m.cornerType === 'convex' ? 'convex' : 'concave',
      label: `${m.cornerType} corner (${Math.round(m.x)},${Math.round(m.y)})`,
      fallbackType: m.cornerType === 'convex' ? 'hip' : 'valley',
      ownLineIds: new Set(),
    });
  }

  for (const l of structural) {
    for (const pt of [l.start, l.end]) {
      if (nearOutline(pt)) continue;
      const attached = structural.some(other =>
        other.id !== l.id
        && (dist(other.start, pt) <= snapTolerance || dist(other.end, pt) <= snapTolerance
          || pointToSegmentDistance(pt, other.start, other.end) <= snapTolerance));
      if (attached) continue;
      origins.push({
        point: { x: pt.x, y: pt.y },
        kind: 'dangling',
        label: `dangling end of ${l.id} (${Math.round(pt.x)},${Math.round(pt.y)})`,
        fallbackType: 'ridge',
        ownLineIds: new Set([l.id]),
      });
    }
  }

  if (origins.length === 0) return empty;
  stats.origins = origins.length;

  // ── Directional first-hit candidate generation ────────────────────────

  const bisectorOf = (p: V3Point): { x: number; y: number } | null => {
    const idx = outlinePoints.findIndex(v => v.x === p.x && v.y === p.y);
    if (idx < 0) return null;
    const v = outlinePoints[idx];
    const prev = outlinePoints[(idx - 1 + n) % n];
    const next = outlinePoints[(idx + 1) % n];
    const l1 = Math.hypot(prev.x - v.x, prev.y - v.y) || 1;
    const l2 = Math.hypot(next.x - v.x, next.y - v.y) || 1;
    let bx = (prev.x - v.x) / l1 + (next.x - v.x) / l2;
    let by = (prev.y - v.y) / l1 + (next.y - v.y) / l2;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-6) return null;
    bx /= bl; by /= bl;
    if (!pointInsidePolygon(outlinePoints, v.x + bx * 2, v.y + by * 2)) { bx = -bx; by = -by; }
    return { x: bx, y: by };
  };

  const overlapsExisting = (a: V3Point, b: V3Point): boolean => {
    const corridor = Math.max(snapTolerance * DUPLICATE_CORRIDOR_FRACTION, 3);
    const segs: Array<{ s: V3Point; e: V3Point }> = [
      ...structural.map(l => ({ s: l.start, e: l.end })),
      ...outlineEdges.map(e => ({ s: e.a, e: e.b })),
    ];
    for (const seg of segs) {
      if (pointToSegmentDistance(seg.s, a, b) <= corridor
        && pointToSegmentDistance(seg.e, a, b) <= corridor) return true;
      if (pointToSegmentDistance(a, seg.s, seg.e) <= corridor
        && pointToSegmentDistance(b, seg.s, seg.e) <= corridor) return true;
    }
    return false;
  };

  const generateCandidates = (origin: Origin): RawCandidate[] => {
    const out: RawCandidate[] = [];
    const o = origin.point;

    const directions: Array<{ x: number; y: number; label: string }> = [];
    for (const deg of CANONICAL_DEGS) {
      const rx = Math.cos((deg * Math.PI) / 180), ry = Math.sin((deg * Math.PI) / 180);
      directions.push({ x: rx, y: ry, label: `${deg}` });
      directions.push({ x: -rx, y: -ry, label: `${deg}` });
    }
    if (origin.kind !== 'dangling') {
      const bis = bisectorOf(o);
      if (bis) {
        const bisDeg = ((Math.atan2(bis.y, bis.x) * 180) / Math.PI + 360) % 360;
        const redundant = CANONICAL_DEGS.some(c => acuteAngleDiff(bisDeg % 180, c) <= 10);
        if (!redundant) directions.push({ x: bis.x, y: bis.y, label: 'bisector' });
      }
    }

    for (const dir of directions) {
      // Node hit: nearest structural endpoint laterally within snap.
      let nodeHit: { t: number; point: V3Point } | null = null;
      for (const l of structural) {
        if (origin.ownLineIds.has(l.id)) continue;
        for (const ep of [l.start, l.end]) {
          const vx = ep.x - o.x, vy = ep.y - o.y;
          const t = vx * dir.x + vy * dir.y;
          if (t < minLen || t > maxLen) continue;
          const lateral = Math.abs(vx * dir.y - vy * dir.x);
          if (lateral > snapTolerance) continue;
          if (!nodeHit || t < nodeHit.t) nodeHit = { t, point: { x: ep.x, y: ep.y } };
        }
      }

      // Geometric first hit: nearest body or outline-edge intersection.
      const bodyHit = firstRayHit(o, dir, structural
        .filter(l => !origin.ownLineIds.has(l.id))
        .map(l => ({ s: l.start, e: l.end })), minLen, maxLen);
      const outlineHit = firstRayHit(o, dir, outlineEdges.map(e => ({ s: e.a, e: e.b })), minLen, maxLen);
      const geoHit = bodyHit && outlineHit
        ? (bodyHit.t <= outlineHit.t ? bodyHit : outlineHit)
        : (bodyHit ?? outlineHit);

      let target: V3Point | null = null;
      let targetKind: 'junction' | 'body' | 'outline' = 'junction';
      if (nodeHit && (!geoHit || nodeHit.t <= geoHit.t + snapTolerance)) {
        target = nodeHit.point;
        targetKind = 'junction';
      } else if (geoHit) {
        target = geoHit.point;
        targetKind = geoHit.src === 0 ? 'body' : 'outline';
      }
      if (!target) continue;

      const length = dist(o, target);
      const angleDeg = segmentAngleDeg(o, target);
      const canonicalDev = Math.min(...CANONICAL_DEGS.map(c => acuteAngleDiff(angleDeg, c)));
      if (canonicalDev > CANONICAL_ANGLE_TOL_DEG) continue; // off-grid direction

      let suggestedType: 'valley' | 'hip' | 'ridge' = origin.fallbackType;
      if (origin.kind === 'dangling') {
        const tv = vertices.find(v => dist({ x: v.x, y: v.y }, target) <= snapTolerance);
        if (tv?.cornerType === 'concave') suggestedType = 'valley';
        else if (tv?.cornerType === 'convex') suggestedType = 'hip';
      }

      // Twin evidence: an existing structural line parallel to the candidate
      // converging on the same far junction (up-and-over pattern). Soft
      // evidence only - never manufactures a mirrored line by itself.
      let twin = false;
      const targetReach = Math.max(2 * snapTolerance, 40);
      for (const l of structural) {
        if (acuteAngleDiff(angleDeg, segmentAngleDeg(l.start, l.end)) > 8) continue;
        // Twin evidence is only trusted when the recovery lands on a real
        // endpoint/junction. A parallel line merely crossing the candidate
        // ray is not enough evidence and would make an ambiguous T-hit look
        // stronger than the actual roof junction.
        if (targetKind !== 'junction') continue;
        const sharesFar = dist(l.start, target) <= targetReach || dist(l.end, target) <= targetReach;
        if (!sharesFar) continue;
        const lenRatio = length / (dist(l.start, l.end) || 1);
        if (lenRatio > 0.6 && lenRatio < 1.6) { twin = true; break; }
      }

      out.push({
        line: {
          id: '',
          start: { x: o.x, y: o.y },
          end: { x: target.x, y: target.y },
          confidence: 0.5,
        },
        suggestedType,
        angleDeg,
        canonicalDev,
        targetKind,
        length,
        targetPoint: { x: target.x, y: target.y },
        twin,
      });
    }
    return out;
  };

  const promoted: TopologyPromotion[] = [];
  const reviewCandidates: TopologyReviewCandidate[] = [];
  const accepted: Array<RawCandidate & { origin: Origin; score: number; reason: string; review: boolean }> = [];
  let tcSeq = 0;

  for (const origin of origins) {
    const raw = generateCandidates(origin)
      .filter(c => !overlapsExisting(c.line.start, c.line.end));
    stats.candidates += raw.length;
    if (raw.length === 0) continue;

    const scored = raw.map(c => {
      const angleScore = Math.max(0, 1 - c.canonicalDev / CANONICAL_ANGLE_TOL_DEG);
      const targetScore = c.targetKind === 'junction' ? 1 : c.targetKind === 'body' ? 0.55 : 0.4;
      const frac = c.length / roofDiagonal;
      let lengthScore: number;
      if (frac < 0.08) lengthScore = 0.5 + (frac / 0.08) * 0.5;
      else if (frac <= 0.4) lengthScore = 1;
      else lengthScore = Math.max(0.2, 1 - (frac - 0.4) / 0.2);
      const originBonus = origin.kind === 'concave' ? 0.08 : origin.kind === 'dangling' ? 0.06 : 0.02;
      const score = Math.min(1,
        0.30 * angleScore + 0.30 * targetScore + 0.14 * lengthScore + originBonus + (c.twin ? 0.12 : 0));
      const kindDesc = c.targetKind === 'junction' ? 'junction' : c.targetKind === 'body' ? 'T-junction on a line' : 'outline edge';
      const reason = `Topology completion: ${origin.label} unexplained - ${c.suggestedType} candidate to ${kindDesc} at (${Math.round(c.targetPoint.x)},${Math.round(c.targetPoint.y)}), ${Math.round(c.length)}px, ${Math.round(c.angleDeg)}deg${c.twin ? ', parallel twin converges on the same junction' : ''}`;
      return { ...c, origin, score, reason };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0];
    // Margin vs the next DISTINCT direction (same-direction near targets are
    // the same recovery, not an ambiguity).
    const sameRecovery = (a: RawCandidate, b: RawCandidate) =>
      acuteAngleDiff(a.angleDeg, b.angleDeg) <= SAME_RECOVERY_ANGLE_DEG
      && dist(a.targetPoint, b.targetPoint) <= Math.max(2 * snapTolerance, 40);
    let nextDistinct: (typeof scored)[number] | undefined;
    for (let i = 1; i < scored.length; i++) {
      if (!sameRecovery(best, scored[i])) { nextDistinct = scored[i]; break; }
    }
    const margin = nextDistinct ? best.score - nextDistinct.score : Infinity;
    const needMargin = origin.kind !== 'dangling';

    if (best.score >= AUTO_PROMOTE_SCORE && (!needMargin || margin >= AUTO_PROMOTE_MARGIN)) {
      accepted.push({
        ...best,
        reason: `${best.reason} [auto: score ${best.score.toFixed(2)}, margin ${margin === Infinity ? 'sole' : margin.toFixed(2)}]`,
        review: false,
      });
    } else if (best.score >= REVIEW_THRESHOLD) {
      accepted.push({
        ...best,
        reason: `${best.reason} [review: score ${best.score.toFixed(2)}, margin ${margin === Infinity ? 'sole' : margin.toFixed(2)} - confirm, reclassify or delete]`,
        review: true,
      });
    }
    // else: nothing plausible - the corner keeps its pink circle marker.
  }

  const taken: V3Line[] = [];
  const duplicateOfTaken = (a: V3Point, b: V3Point) => {
    const corridor = Math.max(snapTolerance * DUPLICATE_CORRIDOR_FRACTION, 3);
    return taken.some(l =>
      pointToSegmentDistance(l.start, a, b) <= corridor
      && pointToSegmentDistance(l.end, a, b) <= corridor);
  };

  for (const c of accepted) {
    if (duplicateOfTaken(c.line.start, c.line.end)) continue;
    const line: V3Line = { ...c.line, id: `TC${++tcSeq}` };
    taken.push(line);
    if (c.review) {
      reviewCandidates.push({ line, suggestedType: c.suggestedType, reason: c.reason, score: c.score });
    } else {
      promoted.push({ line, type: c.suggestedType, reason: c.reason, score: c.score });
    }
  }

  stats.autoPromoted = promoted.length;
  stats.reviewCandidates = reviewCandidates.length;
  return { promoted, reviewCandidates, stats };
}

/** First intersection of a ray with a set of segments, or null. src: 0 body / 1 outline. */
function firstRayHit(
  o: V3Point, dir: { x: number; y: number },
  segs: Array<{ s: V3Point; e: V3Point }>,
  minLen: number, maxLen: number,
  src = 0,
): { t: number; point: V3Point; src: number } | null {
  let best: { t: number; point: V3Point; src: number } | null = null;
  for (const seg of segs) {
    const sx = seg.e.x - seg.s.x, sy = seg.e.y - seg.s.y;
    const denom = dir.x * sy - dir.y * sx;
    if (Math.abs(denom) < 1e-9) continue; // parallel (includes running along an edge)
    const t = ((seg.s.x - o.x) * sy - (seg.s.y - o.y) * sx) / denom;
    const u = ((seg.s.x - o.x) * dir.y - (seg.s.y - o.y) * dir.x) / denom;
    if (t <= minLen || t > maxLen || u < 0 || u > 1) continue;
    if (!best || t < best.t) {
      best = { t, point: { x: o.x + dir.x * t, y: o.y + dir.y * t }, src };
    }
  }
  return best;
}
