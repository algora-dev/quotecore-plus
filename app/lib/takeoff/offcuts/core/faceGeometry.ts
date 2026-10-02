/** V2.11: approved shapes + drainage vectors are the material model.
 * Catalogue labels are optional review hints, NEVER inputs to cutting behaviour.
 * These are per-face material roles, not claims about hidden heights/structure.
 * The same step edge can be upper on one face and lower on its neighbour. */
import type { Point, RoofEdge, RoofFace, RoofInput } from './types';
import { EPS, distance, dot, fingerprint, projection, signedArea, sub, unit, validateRing } from './math';

export const FACE_GEOMETRY_MODEL = 'approved-geometry-v1' as const;
export type CutBoundaryRole = 'upper-cut' | 'lower-cut' | 'upper-end' | 'lower-end' | 'side-trim';
export interface GeometricBoundary extends RoofEdge {
  role: CutBoundaryRole;
  basis: typeof FACE_GEOMETRY_MODEL;
}
export function usableFlow(v: Point | null | undefined): v is Point {
  return !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Math.hypot(v.x,v.y)>EPS;
}
/** Independent of names, face IDs, measurement IDs, hint labels, and winding. */
export function geometricFaceRevision(face: Pick<RoofFace,'polygon'|'flow'>): string {
  return fingerprint([FACE_GEOMETRY_MODEL, face.polygon, face.flow]);
}
/** Exact geometry stays unchanged. A small angular tolerance affects heuristic
 * end/side classification only; material dimensions never snap to ideal angles.
 * Near-axis edges use conservative end/side roles; physical envelopes still
 * follow the exact polygon rather than an ideal straight/diagonal boundary. */
export function geometricBoundary(face: Pick<RoofFace,'polygon'|'flow'>): GeometricBoundary[] {
  if (!usableFlow(face.flow)) return [];
  if (validateRing(face.polygon)) return [];
  const ring=signedArea(face.polygon)>0?face.polygon:[...face.polygon].reverse();
  const v=unit(face.flow), axis=Math.sin(1.5*Math.PI/180);
  const out:GeometricBoundary[]=[];
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];if(distance(a,b)<=EPS)continue;
    const along=unit(sub(b,a)), normal={x:along.y,y:-along.x};
    const through=dot(v,normal), withRun=Math.abs(dot(v,along));
    let role:CutBoundaryRole,kind:RoofEdge['kind'];
    if(Math.abs(through)<=axis){role='side-trim';kind='barge';}
    else if(withRun<=axis){role=through<0?'upper-end':'lower-end';kind=through<0?'ridge':'spouting';}
    else {role=through<0?'upper-cut':'lower-cut';kind=through<0?'hip':'valley';}
    // One stable id per oriented polygon edge; input catalogue IDs cannot alter
    // ordering, cut-set identity or the generated material inventory.
    out.push({id:`shape-edge-${fingerprint([a,b])}`,a:{...a},b:{...b},kind,role,basis:FACE_GEOMETRY_MODEL});
  }
  return out;
}
export interface BoundaryBehaviourAudit {
  faceId:string; name:string; shapeRevision:string; reviewConfirmed:boolean;
  model:typeof FACE_GEOMETRY_MODEL; flow:Point|null;
  boundaries:GeometricBoundary[];
  note:string;
}
export function auditFaceBehaviour(faces:RoofFace[]):BoundaryBehaviourAudit[]{
  return faces.map(f=>({faceId:f.id,name:f.name,reviewConfirmed:f.confirmed,shapeRevision:geometricFaceRevision(f),model:FACE_GEOMETRY_MODEL,
    flow:f.flow?{...f.flow}:null,boundaries:geometricBoundary(f),
    note:f.confirmed?'Derived from the reviewed polygon and water arrow. Original component names do not determine these roles.':'Proposed from this polygon and arrow; awaits user review. Original component names do not determine these roles.'}));
}

/** A flow SUGGESTION only. Known spouting on the outer roof is optional evidence.
 * Without hints a unique dominant exterior run is usable; a tie asks the user.
 * Neither an internal labelled line nor an arbitrary component name is an eave.
 * Water approval, rather than this heuristic, is the source of authority. */
export function suggestGeometryFlow(polygon:Point[], roof:RoofInput):{flow:Point|null;basis:'spouting-hint'|'outer-boundary'|'needs-review'} {
  if(validateRing(polygon))return{flow:null,basis:'needs-review'};
  const ring=signedArea(polygon)>0?polygon:[...polygon].reverse();
  const outer=roof.outlines.flatMap(o=>o.polygon.map((a,i)=>({a,b:o.polygon[(i+1)%o.polygon.length]})));
  const tolerance=roof.calibrationConfirmed&&roof.mmPerSceneUnit>0?Math.min(30/roof.mmPerSceneUnit,2):1e-5;
  const overlap=(a:Point,b:Point,e:{a:Point;b:Point}):number=>{
    const len=distance(a,b);if(len<=EPS||distance(e.a,e.b)<=EPS)return 0;
    const d=unit(sub(b,a)),q=unit(sub(e.b,e.a));
    if(Math.abs(dot(d,q))<Math.cos(1.5*Math.PI/180))return 0;
    const lo=Math.max(0,Math.min(dot(sub(e.a,a),d),dot(sub(e.b,a),d)));
    const hi=Math.min(len,Math.max(dot(sub(e.a,a),d),dot(sub(e.b,a),d)));
    if(hi<=lo)return 0;
    const p={x:a.x+d.x*lo,y:a.y+d.y*lo},r={x:a.x+d.x*hi,y:a.y+d.y*hi};
    return projection(p,e.a,e.b).distance<=tolerance+1e-5&&projection(r,e.a,e.b).distance<=tolerance+1e-5?hi-lo:0;
  };
  const runs=ring.map((a,i)=>{
    const b=ring[(i+1)%ring.length],d=unit(sub(b,a));
    const length=Math.min(distance(a,b),outer.reduce((n,e)=>n+overlap(a,b,e),0));
    const hinted=Math.min(length,roof.edges.filter(e=>e.kind==='spouting'&&!roof.faceDetectionIgnoredEdgeIds?.includes(e.id)).reduce((n,e)=>n+overlap(a,b,e),0));
    return {normal:{x:d.y,y:-d.x},length,hinted};
  }).filter(r=>r.length>EPS);
  if(!runs.length)return{flow:null,basis:'needs-review'};
  const hints=runs.filter(r=>r.hinted>EPS),active=hints.length?hints:runs;
  const groups:{flow:Point;length:number}[]=[];
  for(const r of active){const n=hints.length?r.hinted:r.length;const g=groups.find(g=>dot(g.flow,r.normal)>Math.cos(7.5*Math.PI/180));
    if(g){g.flow=unit({x:g.flow.x*g.length+r.normal.x*n,y:g.flow.y*g.length+r.normal.y*n});g.length+=n;}
    else groups.push({flow:r.normal,length:n});}
  groups.sort((a,b)=>b.length-a.length);
  // Conflicting spouting hints should never be silently resolved from lengths.
  if(hints.length&&groups.length>1)return{flow:null,basis:'needs-review'};
  if(groups.length>1&&groups[0].length<groups[1].length*1.5)return{flow:null,basis:'needs-review'};
  return{flow:groups[0].flow,basis:hints.length?'spouting-hint':'outer-boundary'};
}
