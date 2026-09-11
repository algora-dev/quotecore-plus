// ── Pre-Scan-3 artificial split healing (classification-independent) ───
// After high-confidence dashed strokes are removed, two collinear segments
// meeting at a point where NO other retained solid line terminates is an
// artificial junction (typically a phantom dotted-line break Scan 2 split
// at). Merge them back BEFORE Scan 3 so the classifier sees the repaired
// continuous candidate instead of two fragments.
//
// Unlike mergeCollinearSplitLines (which runs post-Scan-3 and depends on
// semantic classifications), this asks a purely geometric question: is there
// still a real retained branch at this join point?

import type { V3Line, V3Point } from './ai-prompt-v3';

export const PREMERGE_ENDPOINT_TOLERANCE = 12;
export const PREMERGE_COLLINEAR_TOLERANCE = 3; // degrees

export interface MergeRecord {
  kept: string;
  removed: string;
}

function pointToSegmentDistance(p: V3Point, a: V3Point, b: V3Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Classification-independent collinear merge. Call AFTER dashed candidates
 * have been removed and BEFORE Scan 3 overlays/classification.
 */
export function mergeArtificialCollinearSplits(
  lines: V3Line[],
  outlinePoints: V3Point[],
): { lines: V3Line[]; merges: MergeRecord[] } {
  let current = lines.map(l => ({ ...l }));
  const merges: MergeRecord[] = [];

  const dist = (a: V3Point, b: V3Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const dirOf = (l: V3Line) => {
    const dx = l.end.x - l.start.x;
    const dy = l.end.y - l.start.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };
  const angleBetween = (a: V3Line, b: V3Line) => {
    const da = dirOf(a);
    const db = dirOf(b);
    return Math.acos(Math.max(-1, Math.min(1, da.x * db.x + da.y * db.y))) * 180 / Math.PI;
  };
  const nearOutline = (p: V3Point): boolean => {
    for (let i = 0; i < outlinePoints.length; i++) {
      if (pointToSegmentDistance(p, outlinePoints[i], outlinePoints[(i + 1) % outlinePoints.length]) <= PREMERGE_ENDPOINT_TOLERANCE) return true;
    }
    return false;
  };

  let merged = true;
  while (merged) {
    merged = false;

    outer: for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i];
        const B = current[j];
        bCandidate: for (const [ai, bi] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
          const pa = ai === 0 ? a.start : a.end;
          const pb = bi === 0 ? B.start : B.end;
          if (dist(pa, pb) > PREMERGE_ENDPOINT_TOLERANCE) continue bCandidate;

          // Far endpoints must sit on opposite sides of the shared point.
          const farA = ai === 0 ? a.end : a.start;
          const farB = bi === 0 ? B.end : B.start;
          const vA = { x: farA.x - pa.x, y: farA.y - pa.y };
          const vB = { x: farB.x - pb.x, y: farB.y - pb.y };
          const lenA = Math.hypot(vA.x, vA.y) || 1;
          const lenB = Math.hypot(vB.x, vB.y) || 1;
          const dot = (vA.x * vB.x + vA.y * vB.y) / (lenA * lenB);
          if (dot > -0.9985) continue bCandidate; // not a straight continuation

          if (angleBetween(a, B) > PREMERGE_COLLINEAR_TOLERANCE) continue bCandidate;
          if (nearOutline(pa)) continue bCandidate; // outline turn/termination is genuine

          // No OTHER retained line forms a real third branch at this join.
          const othersAtJunction = current.some(other => {
            if (other.id === a.id || other.id === B.id) return false;
            return dist(other.start, pa) <= PREMERGE_ENDPOINT_TOLERANCE || dist(other.end, pa) <= PREMERGE_ENDPOINT_TOLERANCE;
          });
          if (othersAtJunction) continue bCandidate;

          // Degenerate guard: merged segment must have real length.
          if (dist(farA, farB) < 5) continue bCandidate;

          current = current
            .map(l => l.id === a.id ? { ...l, start: farA, end: farB, confidence: Math.min(a.confidence, B.confidence) } : l)
            .filter(l => l.id !== B.id);
          merges.push({ kept: a.id, removed: B.id });
          merged = true;
          break outer;
        }
      }
    }
  }

  return { lines: current, merges };
}
