/**
 * Pitched-roof geometry for the 3D takeoff preview (Tier 1).
 *
 * A drawn roof area is a plan-view outline plus one pitch. The surface is the
 * grassfire (straight-skeleton) model for a uniform pitch: every boundary
 * edge acts as an eave and the surface rises inward at tan(pitch) x the
 * distance to the nearest eave line. A rectangular outline yields a gable
 * with its ridge on the centreline; irregular outlines approximate hips and
 * valleys.
 *
 * The mesh is built by sampling the outline interior on a grid, Delaunay
 * triangulating boundary plus interior samples, dropping triangles whose
 * centroid falls outside the outline, and lifting every vertex by the
 * grassfire height. Interior samples are essential: a boundary-only
 * triangulation has every vertex ON the boundary at height zero and renders
 * perfectly flat (the v2 bug).
 *
 * Pure functions, no THREE import: positions are returned as plain numbers in
 * world convention (x, height, -planY).
 */

import Delaunator from 'delaunator';

export type Pt = { x: number; y: number };

function signedArea(points: Pt[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

/** Winding-normalised copy so interior is always left of each directed edge. */
function ensureCCW(points: Pt[]): Pt[] {
  return signedArea(points) >= 0 ? points : points.slice().reverse();
}

interface EdgeInfo {
  a: Pt;
  inx: number;
  iny: number;
}

function polygonEdges(points: Pt[]): EdgeInfo[] {
  const ring = ensureCCW(points);
  const edges: EdgeInfo[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    edges.push({ a, inx: -dy / len, iny: dx / len });
  }
  return edges;
}

export function pointInPolygon(p: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Grassfire height function for one outline and pitch. Each edge contributes
 * its clamped interior line distance; the surface is the minimum, scaled by
 * tan(pitch). Per-edge clamping keeps concave legs positive.
 */
export function grassfireHeight(points: Pt[], pitchDeg: number): (p: Pt) => number {
  const rise = Math.tan((Math.max(0, pitchDeg) * Math.PI) / 180);
  const edges = polygonEdges(points);
  return (p: Pt) => {
    let best = Infinity;
    for (const e of edges) {
      const d = Math.max(0, (p.x - e.a.x) * e.inx + (p.y - e.a.y) * e.iny);
      if (d < best) best = d;
    }
    return rise * best;
  };
}

/** Densify the ring so long edges carry midpoints for a smoother silhouette. */
function densifyRing(ring: Pt[]): Pt[] {
  const out: Pt[] = [];
  let perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const maxStep = Math.max(perimeter / 30, 1e-4);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const segs = Math.floor(len / maxStep);
    for (let s = 1; s <= segs; s++) {
      const t = s / (segs + 1);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/**
 * Build pitched-roof triangles for one outline. Returns flat world-space
 * positions (x, height, -planY), nine numbers per triangle, or null when the
 * outline is degenerate.
 */
export function buildFaceTriangles(points: Pt[], pitchDeg: number): number[] | null {
  if (points.length < 3) return null;
  const ring = densifyRing(points);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const maxDim = Math.max(maxX - minX, maxY - minY) || 1;
  const step = Math.max(maxDim / 26, 1e-4);
  const samples: Pt[] = [];
  for (let x = minX + step / 2; x < maxX; x += step) {
    for (let y = minY + step / 2; y < maxY; y += step) {
      const p = { x, y };
      if (pointInPolygon(p, points)) samples.push(p);
    }
  }
  if (samples.length === 0) {
    // Degenerate sliver: keep the mesh alive with the bbox centre if inside.
    const c = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    if (!pointInPolygon(c, points)) return null;
    samples.push(c);
  }
  const all: Pt[] = [...ring, ...samples];
  const coords = new Float64Array(all.length * 2);
  all.forEach((p, i) => {
    coords[i * 2] = p.x;
    coords[i * 2 + 1] = p.y;
  });
  const triangles = new Delaunator(coords).triangles;
  const heightAt = grassfireHeight(points, pitchDeg);
  const out: number[] = [];
  for (let t = 0; t < triangles.length; t += 3) {
    const ia = triangles[t];
    const ib = triangles[t + 1];
    const ic = triangles[t + 2];
    const a = all[ia];
    const b = all[ib];
    const c = all[ic];
    const centroid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    if (!pointInPolygon(centroid, points)) continue;
    // Reverse winding so normals face up after the (x, h, -y) reflection.
    for (const p of [c, b, a]) {
      out.push(p.x, heightAt(p), -p.y);
    }
  }
  return out.length ? out : null;
}
