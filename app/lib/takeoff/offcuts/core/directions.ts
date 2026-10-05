import type { Point, RoofEdge, RoofFace } from './types';
import { EPS, dot, fingerprint, projection, signedArea, sub, unit, validateRing } from './math';

/** Screen directions: right = 0, down = 90. They are not geographic bearings. */
export const SCREEN_DIRECTIONS = [
  { angle: 270, label: 'Up', arrow: '↑' }, { angle: 0, label: 'Right', arrow: '→' },
  { angle: 90, label: 'Down', arrow: '↓' }, { angle: 180, label: 'Left', arrow: '←' },
] as const;
export function hasFlow(flow: Point | null | undefined): flow is Point {
  return !!flow && Number.isFinite(flow.x) && Number.isFinite(flow.y) && Math.hypot(flow.x, flow.y) > EPS;
}
export function flowAngle(flow: Point | null | undefined): number | null {
  return hasFlow(flow) ? ((Math.atan2(flow.y, flow.x) * 180 / Math.PI) % 360 + 360) % 360 : null;
}
export function flowFromAngle(angle: number): Point {
  if (!Number.isFinite(angle)) throw new Error('Enter a finite water direction.');
  const a = ((angle % 360) + 360) % 360 * Math.PI / 180;
  return { x: Math.abs(Math.cos(a)) < 1e-12 ? 0 : Math.cos(a), y: Math.abs(Math.sin(a)) < 1e-12 ? 0 : Math.sin(a) };
}
/** Missing starts at Up; subsequent clicks advance clockwise to a preset. */
export function nextFlowAngle(flow: Point | null | undefined): number {
  const a = flowAngle(flow); return a === null ? 270 : ((Math.floor((a + 1e-7) / 90) + 1) * 90) % 360;
}
export function directionRevision(face: RoofFace): string {
  return fingerprint([face.id, face.polygon, face.flow, face.boundary]);
}
export function directionApproved(face: RoofFace): boolean {
  return face.confirmed && hasFlow(face.flow) && face.directionApproval === directionRevision(face);
}
/** Confirmation is an explicit UI action, never automatic inference or a way
 * to make missing/zero vectors and corrupt polygons calculable. */
export function confirmReviewedFace(face: RoofFace): RoofFace {
  const invalid = validateRing(face.polygon);
  if (invalid) throw new Error(`${face.name}: ${invalid}`);
  if (!hasFlow(face.flow)) throw new Error(`${face.name}: choose a water direction before confirming.`);
  return { ...face, confirmed: true, directionApproval: directionRevision(face) };
}
/** After approval, bad inferred eave/ridge/barge labels cannot dictate the run
 * or seed a false purchasing window. Preserve the original labels for review;
 * use only compatible ones for planning heuristics. Never alter the polygon,
 * pitch, cut edges, physical containment or side-lap rules. */
export function planningBoundary(face: RoofFace): RoofEdge[] {
  if (!directionApproved(face) || !hasFlow(face.flow)) return face.boundary;
  const v = unit(face.flow), limit = Math.cos(7.5 * Math.PI / 180), perpendicular = Math.sin(7.5 * Math.PI / 180);
  return face.boundary.filter(e => {
    if (!['spouting', 'ridge', 'barge'].includes(e.kind)) return true;
    const delta = sub(e.b, e.a); if (Math.hypot(delta.x, delta.y) <= EPS) return false;
    const d = unit(delta), along = Math.abs(dot(d, v));
    if(e.kind==='barge')return along>=limit;
    if(along>perpendicular)return false;
    if(e.kind==='spouting'){
      // An approved reversed vector must not keep an inward-facing inferred
      // eave as a purchasing anchor. Use the actual polygon's outward normal,
      // independent of the measurement segment's endpoint order.
      const mid={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2};
      const ring=signedArea(face.polygon)>0?face.polygon:[...face.polygon].reverse();
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length];
        if(projection(mid,a,b).distance>1e-4)continue;
        const edge=unit(sub(b,a));
        return dot(v,{x:edge.y,y:-edge.x})>=limit;
      }
      return false;
    }
    return true;
  });
}
