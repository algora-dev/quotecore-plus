import type { RoofEdge, RoofFace, RoofInput } from './types';
import { distance, dot, projection, sub, unit } from './math';
import { planningBoundary } from './directions';

/** Length of a common physical boundary, independent of edge IDs/order. */
export function sharedBoundaryLength(a:RoofEdge,b:RoofEdge,tolerance:number):number {
  const len=distance(a.a,a.b);if(len<1e-7||distance(b.a,b.b)<1e-7)return 0;
  const d=unit(sub(a.b,a.a)),e=unit(sub(b.b,b.a));if(Math.abs(dot(d,e))<Math.cos(2*Math.PI/180))return 0;
  const lo=Math.max(0,Math.min(dot(sub(b.a,a.a),d),dot(sub(b.b,a.a),d)));
  const hi=Math.min(len,Math.max(dot(sub(b.a,a.a),d),dot(sub(b.b,a.a),d)));
  if(hi<=lo)return 0;
  const p={x:a.a.x+d.x*lo,y:a.a.y+d.y*lo},q={x:a.a.x+d.x*hi,y:a.a.y+d.y*hi};
  return projection(p,b.a,b.b).distance<=tolerance&&projection(q,b.a,b.b).distance<=tolerance?hi-lo:0;
}
/** The small barge/ridge/valley receiver on either side of a pull-out has an
 * immediate cutting parent. Reserve it until that parent's valley cuts exist,
 * even when the parent itself is offcut-fed. This is a topology preference,
 * never permission to use a short or wrongly lapped piece. No face letters. */
export function adjacentValleyParents(faces:RoofFace[],roof:RoofInput):Map<string,string> {
  const result=new Map<string,string>(),tol=Math.min(15,Math.max(1,roof.mmPerSceneUnit))/roof.mmPerSceneUnit;
  for(const target of faces){
    const edges=planningBoundary(target),valleys=edges.filter(e=>e.kind==='valley');
    if(!valleys.length||!edges.some(e=>e.kind==='barge')||!edges.some(e=>e.kind==='spouting')||!edges.some(e=>e.kind==='ridge')||edges.some(e=>e.kind==='hip'||e.kind==='broken_hip'))continue;
    const candidates=faces.filter(f=>f.id!==target.id&&planningBoundary(f).some(e=>e.kind==='hip')&&planningBoundary(f).filter(e=>e.kind==='valley').length>=2)
      .map(source=>({id:source.id,overlap:valleys.reduce((n,e)=>n+Math.max(0,...planningBoundary(source).filter(e=>e.kind==='valley').map(v=>sharedBoundaryLength(v,e,tol))),0)}))
      .filter(c=>c.overlap>tol).sort((a,b)=>b.overlap-a.overlap||a.id.localeCompare(b.id));
    // Ambiguous equal parents are not silently assigned by label order.
    if(candidates.length&&(!candidates[1]||candidates[0].overlap>candidates[1].overlap+tol))result.set(target.id,candidates[0].id);
  }
  return result;
}
