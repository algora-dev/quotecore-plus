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

// ── Island micro-cluster removal ────────────────────────────────────────
// Short fragments the model invents around dashed rectangular plan features
// (annotation boxes, skylight symbols, dimension jogs) form small closed or
// near-closed clusters that never join the real roof network. No real internal
// component (ridge/hip/valley/broken hip) is that small or that isolated.
// A cluster is removed only when EVERY line in it is short relative to the roof
// AND it has no junction with any retained structural (long) line.

export interface ClusterRemovalRecord {
  removedIds: string[];
  reason: string;
}

const MICRO_CLUSTER_MAX_FRACTION = 0.06; // lines shorter than 6% of the roof diagonal

export function removeIslandMicroClusters(
  lines: V3Line[],
  outlinePoints: V3Point[],
): { lines: V3Line[]; removed: ClusterRemovalRecord[] } {
  if (lines.length === 0) return { lines, removed: [] };

  const outlineTolerance = 12;

  // Roof size reference
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of outlinePoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const roofDiagonal = Math.hypot(maxX - minX, maxY - minY) || 1;
  const maxLength = MICRO_CLUSTER_MAX_FRACTION * roofDiagonal;

  const dist = (a: V3Point, b: V3Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const lineLen = (l: V3Line) => dist(l.start, l.end);

  const pointToSegDist = (p: V3Point, a: V3Point, b: V3Point): number => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(p, a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  // Two lines are connected when any endpoint of one touches the OTHER LINE'S
  // BODY (endpoint-to-segment) - this captures T-junctions where a short spur
  // meets the middle of a long ridge, which endpoint-only matching misses.
  const linesTouch = (a: V3Line, b: V3Line): boolean =>
    pointToSegDist(a.start, b.start, b.end) <= PREMERGE_ENDPOINT_TOLERANCE
    || pointToSegDist(a.end, b.start, b.end) <= PREMERGE_ENDPOINT_TOLERANCE
    || pointToSegDist(b.start, a.start, a.end) <= PREMERGE_ENDPOINT_TOLERANCE
    || pointToSegDist(b.end, a.start, a.end) <= PREMERGE_ENDPOINT_TOLERANCE;

  const nearOutline = (p: V3Point): boolean => {
    for (let i = 0; i < outlinePoints.length; i++) {
      const a = outlinePoints[i];
      const b = outlinePoints[(i + 1) % outlinePoints.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) <= outlineTolerance) return true;
    }
    return false;
  };

  // Union-find over endpoint proximity
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const l of lines) parent.set(l.id, l.id);
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (linesTouch(lines[i], lines[j])) union(lines[i].id, lines[j].id);
    }
  }

  const clusters = new Map<string, V3Line[]>();
  for (const l of lines) {
    const root = find(l.id);
    const arr = clusters.get(root) ?? [];
    arr.push(l);
    clusters.set(root, arr);
  }

  const removedIds = new Set<string>();
  const removed: ClusterRemovalRecord[] = [];
  for (const cluster of clusters.values()) {
    const allShort = cluster.every(l => lineLen(l) < maxLength);
    if (!allShort) continue;

    // A closed cycle of short lines = an annotation box/feature outline the
    // model traced around. No real internal roof component network is a closed
    // loop - ridges/hips/valleys form paths and trees. Removed even if the box
    // happens to sit near the roof edge.
    const hasCycle = clusterHasCycle(cluster);
    if (hasCycle) {
      for (const l of cluster) removedIds.add(l.id);
      removed.push({
        removedIds: cluster.map(l => l.id),
        reason: `closed short-line loop (${cluster.length} line(s), all < ${Math.round(maxLength)}px - traced annotation box)`,
      });
      continue;
    }

    // Anchored to the roof outline anywhere? (e.g. short barges touching edges)
    const touchesOutline = cluster.some(l => nearOutline(l.start) || nearOutline(l.end));
    if (touchesOutline) continue;
    for (const l of cluster) removedIds.add(l.id);
    removed.push({
      removedIds: cluster.map(l => l.id),
      reason: `island micro-cluster (${cluster.length} line(s), all < ${Math.round(maxLength)}px, not connected to roof network or outline)`,
    });
  }

  return { lines: lines.filter(l => !removedIds.has(l.id)), removed };
}

/** Does this cluster of lines contain a closed cycle (loop)? */
function clusterHasCycle(cluster: V3Line[]): boolean {
  // Endpoint clustering within the cluster
  const endpointTol = PREMERGE_ENDPOINT_TOLERANCE;
  const nodePoints: V3Point[] = [];
  const nodeOf = (p: V3Point): number => {
    for (let i = 0; i < nodePoints.length; i++) {
      if (Math.hypot(p.x - nodePoints[i].x, p.y - nodePoints[i].y) <= endpointTol) return i;
    }
    nodePoints.push(p);
    return nodePoints.length - 1;
  };
  const edges: Array<[number, number]> = [];
  for (const l of cluster) {
    const a = nodeOf(l.start);
    const b = nodeOf(l.end);
    if (a !== b) edges.push([a, b]);
  }
  if (edges.length === 0) return false;

  // Union-find cycle detection: a cycle exists if adding an edge connects two
  // nodes already in the same component.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  for (const [a, b] of edges) {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a), rb = find(b);
    if (ra === rb) return true;
    parent.set(ra, rb);
  }
  return false;
}
