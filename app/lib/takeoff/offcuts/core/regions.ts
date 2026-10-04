/** Dependency-free vertical trapezoid Boolean geometry.
 * Only linear polygon boundaries are supported. Every boundary intersection is
 * inserted before sweeping, so calculations are not sampled/rasterised.
 * Units are arbitrary but must be consistent within an operation. */
import type { Band, Point, Region, Ring } from './types';
import { EPS, uniqueSorted, validateRing } from './math';
type Fn = { m: number; c: number };
const fn = (x0: number, x1: number, y0: number, y1: number): Fn => ({ m: (y1 - y0) / (x1 - x0), c: y0 - x0 * (y1 - y0) / (x1 - x0) });
const val = (f: Fn, x: number): number => f.m * x + f.c;
const top = (b: Band): Fn => fn(b.x0, b.x1, b.top0, b.top1);
const bottom = (b: Band): Fn => fn(b.x0, b.x1, b.bottom0, b.bottom1);
/** Collapse only sub-EPS endpoint inversions caused by evaluating intersecting
 * floating-point lines. A materially crossed band is an error, never repaired
 * into apparently valid stock. The sweep already nodes true intersections. */
function cleanEndpointRoundoff(b: Band): Band {
  for (const end of [0, 1] as const) {
    const t = end === 0 ? b.top0 : b.top1, d = end === 0 ? b.bottom0 : b.bottom1;
    if (d < t) {
      if (t - d > EPS) throw new Error('Geometry produced a crossed trapezoid boundary.');
      if (end === 0) b.bottom0 = b.top0; else b.bottom1 = b.top1;
    }
  }
  return b;
}
export const bandArea = (b: Band): number => (b.x1 - b.x0) * ((b.bottom0 - b.top0) + (b.bottom1 - b.top1)) / 2;
export const area = (r: Region): number => r.reduce((s, b) => s + bandArea(b), 0);
export const bandRing = (b: Band): Ring => [
  { x: b.x0, y: b.top0 }, { x: b.x1, y: b.top1 },
  { x: b.x1, y: b.bottom1 }, { x: b.x0, y: b.bottom0 },
];
export function rectangle(x0: number, y0: number, x1: number, y1: number): Region {
  return x1 - x0 > EPS && y1 - y0 > EPS ? [{ x0, x1, top0: y0, top1: y0, bottom0: y1, bottom1: y1 }] : [];
}
export function bounds(r: Region): { minX: number; maxX: number; minY: number; maxY: number } {
  if (!r.length) throw new Error('Empty region has no bounds.');
  return { minX: Math.min(...r.map(b => b.x0)), maxX: Math.max(...r.map(b => b.x1)),
    minY: Math.min(...r.flatMap(b => [b.top0, b.top1])), maxY: Math.max(...r.flatMap(b => [b.bottom0, b.bottom1])) };
}
export function fromRing(r: Ring): Region {
  const error = validateRing(r); if (error) throw new Error(error);
  const xs = uniqueSorted(r.map(p => p.x)), out: Region = [];
  for (let k = 0; k < xs.length - 1; k++) {
    const x0 = xs[k], x1 = xs[k + 1], mid = (x0 + x1) / 2;
    const edges: Fn[] = [];
    r.forEach((p, i) => { const q = r[(i + 1) % r.length];
      if (mid > Math.min(p.x, q.x) && mid < Math.max(p.x, q.x)) edges.push(fn(p.x, q.x, p.y, q.y));
    });
    edges.sort((a, b) => val(a, mid) - val(b, mid));
    if (edges.length % 2) throw new Error('Polygon has an odd number of cross-section intersections.');
    for (let j = 0; j < edges.length; j += 2) {
      const b = { x0, x1, top0: val(edges[j], x0), top1: val(edges[j], x1), bottom0: val(edges[j + 1], x0), bottom1: val(edges[j + 1], x1) };
      if (bandArea(b) > EPS) out.push(cleanEndpointRoundoff(b));
    }
  }
  return out;
}
export function boolean(a: Region, b: Region, op: 'union' | 'intersection' | 'difference'): Region {
  const all = [...a, ...b]; if (!all.length) return [];
  let xs = uniqueSorted(all.flatMap(s => [s.x0, s.x1]));
  const extra: number[] = [];
  // At most a handful of active bands for the sheet-lane domain. This pass is
  // intentionally explicit rather than relying on an unverified clipping DLL.
  for (let k = 0; k < xs.length - 1; k++) {
    const lo = xs[k], hi = xs[k + 1], mid = (lo + hi) / 2;
    const fs = all.filter(s => s.x0 < mid && s.x1 > mid).flatMap(s => [top(s), bottom(s)]);
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const dm = fs[i].m - fs[j].m;
      if (Math.abs(dm) < 1e-12) continue;
      const x = (fs[j].c - fs[i].c) / dm;
      if (x > lo + EPS && x < hi - EPS) extra.push(x);
    }
  }
  xs = uniqueSorted([...xs, ...extra]);
  const out: Region = [];
  const inside = (na: number, nb: number): boolean => op === 'union' ? na > 0 || nb > 0 : op === 'intersection' ? na > 0 && nb > 0 : na > 0 && nb === 0;
  for (let k = 0; k < xs.length - 1; k++) {
    const x0 = xs[k], x1 = xs[k + 1], mid = (x0 + x1) / 2;
    const events: { f: Fn; source: 0 | 1; delta: number }[] = [];
    [a, b].forEach((r, source) => { for (const s of r) if (s.x0 < mid && s.x1 > mid) {
      events.push({ f: top(s), source: source as 0 | 1, delta: 1 }, { f: bottom(s), source: source as 0 | 1, delta: -1 });
    } });
    events.sort((l, r) => val(l.f, mid) - val(r.f, mid));
    const counts = [0, 0];
    let start: Fn | null = null;
    for (let i = 0; i < events.length;) {
      const y = val(events[i].f, mid), f = events[i].f, before = inside(counts[0], counts[1]);
      do { counts[events[i].source] += events[i].delta; i++; } while (i < events.length && Math.abs(val(events[i].f, mid) - y) < EPS);
      const after = inside(counts[0], counts[1]);
      if (!before && after) start = f;
      if (before && !after && start) {
        const band = { x0, x1, top0: val(start, x0), top1: val(start, x1), bottom0: val(f, x0), bottom1: val(f, x1) };
        if (bandArea(band) > EPS) out.push(cleanEndpointRoundoff(band)); start = null;
      }
    }
  }
  return out;
}
export const union = (a: Region, b: Region): Region => boolean(a, b, 'union');
export const intersect = (a: Region, b: Region): Region => boolean(a, b, 'intersection');
export const subtract = (a: Region, b: Region): Region => boolean(a, b, 'difference');
export function unionAll(rs: Region[]): Region { return rs.reduce((a, b) => union(a, b), [] as Region); }
export function translate(r: Region, dx: number, dy: number): Region {
  return r.map(b => ({ x0: b.x0 + dx, x1: b.x1 + dx, top0: b.top0 + dy, top1: b.top1 + dy, bottom0: b.bottom0 + dy, bottom1: b.bottom1 + dy }));
}
export function rotate180(r: Region, width: number): Region {
  return r.map(b => ({ x0: width - b.x1, x1: width - b.x0, top0: -b.bottom1, top1: -b.bottom0, bottom0: -b.top1, bottom1: -b.top0 }));
}
export function extendY(r: Region, margin: number): Region {
  if (margin <= 0) return r.map(b => ({ ...b }));
  return unionAll(r.map(b => [{ ...b, top0: b.top0 - margin, top1: b.top1 - margin, bottom0: b.bottom0 + margin, bottom1: b.bottom1 + margin }]));
}
export function isMonotone(r: Region): boolean {
  const xs = uniqueSorted(r.flatMap(b => [b.x0, b.x1]));
  for (let i = 0; i < xs.length - 1; i++) {
    const x = (xs[i] + xs[i + 1]) / 2;
    if (r.filter(b => b.x0 < x && b.x1 > x).length > 1) return false;
  }
  return true;
}
/** Connected components must share a positive-length boundary. A point touch
 * cannot be treated as a handleable metal sheet. */
export function components(r: Region): Region[] {
  const parent = r.map((_, i) => i);
  const root = (i: number): number => { while (parent[i] !== i) i = parent[i]; return i; };
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    let a = r[i], b = r[j]; if (Math.abs(b.x1 - a.x0) < EPS) [a, b] = [b, a];
    if (Math.abs(a.x1 - b.x0) < EPS && Math.min(a.bottom1, b.bottom0) - Math.max(a.top1, b.top0) > EPS) parent[root(j)] = root(i);
  }
  const groups = new Map<number, Region>();
  r.forEach((b, i) => { const k = root(i); const g = groups.get(k) ?? []; g.push(b); groups.set(k, g); });
  return [...groups.values()];
}
/** Fit with fixed rib registration (no sideways sliding). Piece shape, not its
 * bounding rectangle, controls acceptance. All interval endpoints are checked. */
export function fitY(available: Region, required: Region, preference: 'centre'|'lower'|'upper' = 'centre'): number | null {
  if (!available.length || !required.length || !isMonotone(required)) return null;
  // A single physical remnant can be non-monotone (e.g. a rounded stock length
  // leaves a thin return strip joined around a cut). Rejecting the entire piece
  // loses usable metal. Intersect feasible translation INTERVALS instead; every
  // slice of the required continuous sheet must still lie in real source metal.
  let feasible: [number, number][] = [[-Infinity, Infinity]];
  const xs = uniqueSorted([...available, ...required].flatMap(b => [b.x0, b.x1]));
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i], x1 = xs[i + 1], mid = (x0 + x1) / 2;
    const t = required.find(b => b.x0 < mid && b.x1 > mid); if (!t) continue;
    const allowed: [number, number][] = [];
    for (const s of available.filter(b => b.x0 < mid && b.x1 > mid)) {
      const lo = Math.max(...[x0, x1].map(x => val(bottom(t), x) - val(bottom(s), x)));
      const hi = Math.min(...[x0, x1].map(x => val(top(t), x) - val(top(s), x)));
      if (lo <= hi + EPS) allowed.push([lo, hi]);
    }
    const next: [number, number][] = [];
    for (const [a, b] of feasible) for (const [c, d] of allowed) {
      const lo = Math.max(a, c), hi = Math.min(b, d);
      if (lo <= hi + EPS) next.push([lo, hi]);
    }
    if (!next.length) return null;
    next.sort((a, b) => a[0] - b[0]); feasible = [];
    for (const interval of next) {
      const previous = feasible[feasible.length - 1];
      if (previous && interval[0] <= previous[1] + EPS) previous[1] = Math.max(previous[1], interval[1]);
      else feasible.push(interval);
    }
  }
  for (const [lo, hi] of feasible) {
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    const dy = preference==='lower'?hi:preference==='upper'?lo:(lo + hi) / 2;
    if (area(subtract(required, translate(available, 0, dy))) <= Math.max(1e-4, area(required) * 1e-10)) return dy;
  }
  return null;
}
export function pointInRegion(r: Region, p: Point): boolean {
  return r.some(b => p.x >= b.x0 - EPS && p.x <= b.x1 + EPS && p.y >= val(top(b), p.x) - EPS && p.y <= val(bottom(b), p.x) + EPS);
}
/** Boundary extraction cancels shared (possibly partial) edges. */
export function boundarySegments(r: Region): { a: Point; b: Point }[] {
  const nonVertical: { a: Point; b: Point }[] = [];
  const vertical = new Map<string, { x: number; spans: { a: number; b: number; sign: number }[] }>();
  for (const b of r) {
    nonVertical.push({ a: { x: b.x0, y: b.top0 }, b: { x: b.x1, y: b.top1 } }, { a: { x: b.x1, y: b.bottom1 }, b: { x: b.x0, y: b.bottom0 } });
    for (const [x, y0, y1, sign] of [[b.x0, b.top0, b.bottom0, -1], [b.x1, b.top1, b.bottom1, 1]]) {
      const key = x.toFixed(7), e = vertical.get(key) ?? { x, spans: [] };
      e.spans.push({ a: y0, b: y1, sign }); vertical.set(key, e);
    }
  }
  for (const { x, spans } of vertical.values()) {
    const ys = uniqueSorted(spans.flatMap(s => [s.a, s.b]));
    for (let i = 0; i < ys.length - 1; i++) {
      const m = (ys[i] + ys[i + 1]) / 2, sign = spans.reduce((n, s) => n + (m > s.a && m < s.b ? s.sign : 0), 0);
      if (sign) nonVertical.push({ a: { x, y: sign > 0 ? ys[i] : ys[i + 1] }, b: { x, y: sign > 0 ? ys[i + 1] : ys[i] } });
    }
  }
  // Shared horizontal/diagonal boundaries can occur in unions. Cancel exact
  // reverse edges after the common-x sweep has noded them.
  const map = new Map<string, { a: Point; b: Point }>();
  const key = (p: Point): string => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
  for (const e of nonVertical) {
    if (Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y) < EPS) continue;
    const k = `${key(e.a)}|${key(e.b)}`, rev = `${key(e.b)}|${key(e.a)}`;
    if (map.has(rev)) map.delete(rev); else map.set(k, e);
  }
  return [...map.values()];
}
export function rings(r: Region): Ring[] {
  const edges = boundarySegments(r), out: Ring[] = [], key = (p: Point): string => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
  const starts = new Map<string, number[]>();
  edges.forEach((e, i) => { const list = starts.get(key(e.a)) ?? []; list.push(i); starts.set(key(e.a), list); });
  const used = new Set<number>();
  for (let i = 0; i < edges.length; i++) {
    if (used.has(i)) continue;
    let cur = i; const ring: Ring = [];
    for (let n = 0; n <= edges.length; n++) {
      if (used.has(cur)) break;
      used.add(cur); ring.push(edges[cur].a);
      const end = key(edges[cur].b); if (end === key(edges[i].a)) break;
      const next = starts.get(end)?.find(j => !used.has(j));
      if (next === undefined) throw new Error('Region boundary failed to close.'); cur = next;
    }
    if (ring.length >= 3) out.push(ring);
  }
  return out;
}
