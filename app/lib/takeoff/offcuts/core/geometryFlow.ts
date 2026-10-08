/** Name-independent suggestions. These are NOT manufacturer/structural facts.
 * Approval of polygon + drainage, not inferred labels, remains the cut authority. */
import type { Point, RoofEdge, RoofFace, RoofInput } from './types';
import type { FlowEvidence } from './geometryPolicy';
import { distance, dot, projection, signedArea, sub, unit } from './math';

interface ExteriorRun { a: Point; b: Point; normal: Point; length: number; barge: boolean }
export function topologyFlowSuggestions(roof: RoofInput, faces: RoofFace[], edges: RoofEdge[]): { faces: RoofFace[]; evidence: FlowEvidence[] } {
  const out = structuredClone(faces), evidence: FlowEvidence[] = [];
  const outer = roof.outlines.flatMap(o => {
    const ring = signedArea(o.polygon) > 0 ? o.polygon : [...o.polygon].reverse();
    return ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length] }));
  });
  const epsilon = 1e-5, perpendicular = Math.sin(5 * Math.PI / 180);
  const onBoundary = (p: Point) => outer.some(e => projection(p, e.a, e.b).distance < epsilon);
  const atCorner = (p: Point) => outer.some(e => distance(e.a, p) < epsilon);
  // A spine meeting the MIDDLE of an exterior run at ~90° is evidence of a
  // gable/rake boundary. No diagonal at a corner alone does NOT prove a barge.
  const bargeRuns = outer.filter(o => edges.some(e => (['a', 'b'] as const).some(end => {
    const p = e[end], q = e[end === 'a' ? 'b' : 'a'];
    const h = projection(p, o.a, o.b);
    const throughGable = outer.some(other => {
      const far = projection(q, other.a, other.b);
      return far.distance < epsilon && far.t > 1e-6 && far.t < 1 - 1e-6 && !atCorner(q)
        && Math.abs(dot(unit(sub(q, p)), unit(sub(other.b, other.a)))) < perpendicular;
    });
    return h.distance < epsilon && h.t > 1e-6 && h.t < 1 - 1e-6 && !atCorner(p) && (!onBoundary(q) || throughGable)
      && Math.abs(dot(unit(sub(q, p)), unit(sub(o.b, o.a)))) < perpendicular;
  })));
  const overlap = (a: Point, b: Point, o: { a: Point; b: Point }): number => {
    const length = distance(a, b); if (length < epsilon) return 0;
    const d = unit(sub(b, a)); if (Math.abs(dot(d, unit(sub(o.b, o.a)))) < 1 - 1e-8) return 0;
    const lo = Math.max(0, Math.min(dot(sub(o.a, a), d), dot(sub(o.b, a), d)));
    const hi = Math.min(length, Math.max(dot(sub(o.a, a), d), dot(sub(o.b, a), d)));
    if (hi <= lo) return 0;
    return projection({ x: a.x + d.x * lo, y: a.y + d.y * lo }, o.a, o.b).distance < epsilon &&
      projection({ x: a.x + d.x * hi, y: a.y + d.y * hi }, o.a, o.b).distance < epsilon ? hi - lo : 0;
  };
  for (const f of out) {
    // Trusted semantic enum is optional evidence, never a name lookup or a
    // prerequisite. Preserve the established explicit-eave suggestion.
    if (f.flow && f.flowSuggestionBasis === 'spouting-hint') {
      evidence.push({ faceId: f.id, flow: f.flow, basis: 'spouting-hint', message: 'Explicit spouting metadata agrees with an exterior boundary; confirm the suggested fall.' });
      continue;
    }

    const ring = signedArea(f.polygon) > 0 ? f.polygon : [...f.polygon].reverse();
    const runs: ExteriorRun[] = ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length], d = unit(sub(b, a));
      const length = Math.min(distance(a, b), outer.reduce((n, o) => n + overlap(a, b, o), 0));
      return { a, b, normal: { x: d.y, y: -d.x }, length, barge: bargeRuns.some(o => overlap(a, b, o) > length * .99 && length > epsilon) };
    }).filter(r => r.length > epsilon);
    const active = runs.filter(r => !r.barge), groups: { v: Point; length: number }[] = [];
    for (const r of active) {
      const g = groups.find(g => dot(g.v, r.normal) > Math.cos(7.5 * Math.PI / 180));
      if (g) { g.v = unit({ x: g.v.x * g.length + r.normal.x * r.length, y: g.v.y * g.length + r.normal.y * r.length }); g.length += r.length; }
      else groups.push({ v: r.normal, length: r.length });
    }
    groups.sort((a, b) => b.length - a.length);
    const hasGable = runs.some(r => r.barge);
    const unique = groups.length === 1 || groups.length > 1 && groups[0].length >= groups[1].length * 1.5;
    const flow = unique ? groups[0].v : null;
    f.flow = flow; f.flowSource = 'inferred'; f.flowSuggestionBasis = flow ? 'geometry-topology' : 'needs-review';
    f.confirmed = false; delete f.directionApproval;
    evidence.push({ faceId: f.id, flow, basis: flow ? hasGable ? 'gable-ridge-end' : 'topology-eave' : 'needs-review',
      message: flow ? hasGable ? 'Likely rake identified at a perpendicular spine/perimeter junction; water suggested toward the other exterior run.' : 'Water suggested out through the dominant exterior run of this cleaned face.' : 'More than one drainage direction is plausible. Set the water arrow; no uphill/downhill assumption was made.' });
  }
  return { faces: out, evidence };
}
