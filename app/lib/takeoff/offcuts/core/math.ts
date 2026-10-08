import type { Point, Ring } from './types';
export const EPS = 1e-7;
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
export const length = (a: Point): number => Math.hypot(a.x, a.y);
export const distance = (a: Point, b: Point): number => length(sub(a, b));
export function unit(a: Point): Point { const n = length(a); if (!Number.isFinite(n) || n < EPS) throw new Error('Direction must be a finite nonzero vector.'); return mul(a, 1 / n); }
export const lerp = (a: Point, b: Point, t: number): Point => add(a, mul(sub(b, a), t));
export function signedArea(r: Ring): number { return r.reduce((s, p, i) => s + cross(p, r[(i + 1) % r.length]), 0) / 2; }
export function centroid(r: Ring): Point {
  const a = signedArea(r); if (Math.abs(a) < EPS) return r[0] ?? { x: 0, y: 0 };
  let x = 0, y = 0;
  r.forEach((p, i) => { const q = r[(i + 1) % r.length], c = cross(p, q); x += (p.x + q.x) * c; y += (p.y + q.y) * c; });
  return { x: x / (6 * a), y: y / (6 * a) };
}
export function cleanRing(r: Ring): Ring {
  const out: Ring = [];
  for (const p of r) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('Polygon contains non-finite coordinates.');
    if (!out.length || distance(out[out.length - 1], p) > EPS) out.push({ ...p });
  }
  if (out.length > 1 && distance(out[0], out[out.length - 1]) < EPS) out.pop();
  return out;
}
export function projection(p: Point, a: Point, b: Point): { t: number; point: Point; distance: number } {
  const d = sub(b, a), n = dot(d, d), t = n < EPS * EPS ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), d) / n));
  const point = lerp(a, b, t); return { t, point, distance: distance(p, point) };
}
export function containsPoint(r: Ring, p: Point, boundary = true): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[j], b = r[i];
    if (projection(p, a, b).distance < EPS) return boundary;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function uniqueSorted(xs: number[], eps = EPS): number[] {
  const sorted = xs.sort((a, b) => a - b), out: number[] = [];
  for (const x of sorted) if (!out.length || x - out[out.length - 1] > eps) out.push(x);
  return out;
}
export interface Segment { a: Point; b: Point }
/** Includes collinear endpoint intersections, allowing T junctions and duplicates. */
export function segmentHits(s: Segment, t: Segment): Point[] {
  const r = sub(s.b, s.a), v = sub(t.b, t.a), d = cross(r, v), q = sub(t.a, s.a);
  if (Math.abs(d) > EPS * Math.max(1, length(r), length(v))) {
    const u = cross(q, r) / d, k = cross(q, v) / d;
    return k >= -EPS && k <= 1 + EPS && u >= -EPS && u <= 1 + EPS ? [lerp(s.a, s.b, Math.max(0, Math.min(1, k)))] : [];
  }
  return [s.a, s.b, t.a, t.b].filter(p => projection(p, s.a, s.b).distance < EPS && projection(p, t.a, t.b).distance < EPS);
}
export function validateRing(r: Ring): string | null {
  if (r.length < 3 || r.length > 2000) return 'A polygon needs 3–2000 vertices.';
  if (!r.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return 'Non-finite polygon coordinates.';
  if (Math.abs(signedArea(r)) < EPS) return 'Zero-area polygon.';
  for (let i = 0; i < r.length; i++) {
    if (distance(r[i], r[(i + 1) % r.length]) < EPS) return 'Repeated adjacent vertex.';
    for (let j = i + 1; j < r.length; j++) {
      if (j === i + 1 || (i === 0 && j === r.length - 1)) continue;
      if (segmentHits({ a: r[i], b: r[(i + 1) % r.length] }, { a: r[j], b: r[(j + 1) % r.length] }).length) return 'Self-intersecting or self-touching polygon.';
    }
  }
  return null;
}
export function fingerprint(value: unknown): string {
  // Change detector, NOT a security/authentication hash.
  const text = JSON.stringify(value); let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
/** Postgres jsonb and structured clones do not preserve object key order, so a
 * raw JSON.stringify hash of the same data differs after a persistence
 * round-trip. Canonical hashing sorts object keys (arrays keep their order)
 * so equal data always hashes equal, on creation and on verification. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>, out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalize(source[key]);
    return out;
  }
  return value;
}
export function canonicalFingerprint(value: unknown): string { return fingerprint(canonicalize(value)); }
