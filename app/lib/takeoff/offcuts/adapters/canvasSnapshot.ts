import type { Point } from '../core/types';
import { isPlanLineMeasurement, type QuoteCoreSnapshot } from './quotecore';
import { cloneTakeoffSnapshot } from './liveSnapshot';

/** Structural Fabric bridge: no runtime Fabric dependency, viewport transform or
 * screenshot/OCR. The host supplies only its CURRENT canvas.getObjects(). */
export interface SceneMeasurementObject {
  measurementId?: string; type?: string; visible?: boolean; vertexIndex?: number; segmentIndex?: number;
  left?: number; top?: number; points?: Point[]; pathOffset?: Point;
  calcTransformMatrix?: () => number[];
  calcLinePoints?: () => {x1:number;y1:number;x2:number;y2:number};
  getCenterPoint?: () => Point;
}
function transform(p:Point,m:number[]):Point {
  if(m.length!==6||!m.every(Number.isFinite))throw new Error('The canvas has an invalid object transform. Finish the current edit and try again.');
  return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};
}
function readShape(o:SceneMeasurementObject):Point[]|null {
  const type=o.type?.toLowerCase();
  if(!['line','polygon','polyline'].includes(type??''))return null;
  const matrix=o.calcTransformMatrix?.();
  if(!matrix)throw new Error(`The live ${type} cannot be read in scene coordinates. The host must commit its points before capture.`);
  if(type==='line'){
    const p=o.calcLinePoints?.();
    if(!p)throw new Error('The live line has no local endpoint reader. Commit its points before capture.');
    return [transform({x:p.x1,y:p.y1},matrix),transform({x:p.x2,y:p.y2},matrix)];
  }
  if(!o.points||!o.pathOffset)throw new Error('The live polygon has no point/path-offset geometry. Commit it before capture.');
  return o.points.map(p=>transform({x:p.x-o.pathOffset!.x,y:p.y-o.pathOffset!.y},matrix));
}
const near=(a:Point,b:Point):boolean=>Math.hypot(a.x-b.x,a.y-b.y)<1e-6;
function polyline(objects:SceneMeasurementObject[]):Point[]|null {
  const shapes=objects.filter(o=>['line','polyline'].includes(o.type?.toLowerCase()??''));
  if(!shapes.length)return null;
  if(shapes.length===1)return readShape(shapes[0]);
  if(shapes.some(o=>o.type?.toLowerCase()!=='line'))throw new Error('Duplicate live geometry for one measurement. Finish the current edit and reopen.');
  const ordered=shapes.every(o=>Number.isInteger(o.segmentIndex))?[...shapes].sort((a,b)=>a.segmentIndex!-b.segmentIndex!):shapes;
  // No tolerance repairs at capture time: that belongs to the face builder.
  // Unindexed parts may have been reordered by selection; chain uniquely by
  // endpoint identity, or reject rather than silently scramble a multi-lineal.
  const parts=ordered.map(o=>readShape(o)!);
  if(parts.every((p,i)=>i===0||near(parts[i-1][1],p[0])))return [parts[0][0],...parts.map(p=>p[1])];
  const endpoints=parts.flatMap(p=>p).filter(p=>parts.flatMap(q=>q).filter(q=>near(p,q)).length===1);
  if(endpoints.length!==2)throw new Error('A multi-lineal measurement is not committed as one continuous path. Finish or split it in the takeoff first.');
  const remaining=[...parts];let last=endpoints[0];const result=[last];
  while(remaining.length){
    const choices=remaining.map((p,i)=>({p,i})).filter(({p})=>near(p[0],last)||near(p[1],last));
    if(choices.length!==1)throw new Error('The live multi-lineal path is ambiguous. Commit its ordered points before capture.');
    const {p,i}=choices[0];last=near(p[0],last)?p[1]:p[0];result.push(last);remaining.splice(i,1);
  }
  return result;
}
export interface CanvasCaptureResult {
  snapshot:QuoteCoreSnapshot;
  updatedMeasurementIds:string[];
  /** Orphans are never resurrected. Usually pending commits or stale canvases. */
  unmatchedSceneMeasurementIds:string[];
}
/** The model owns identity/deletion/scope. Known canvas geometry owns the latest
 * positions. No old AI payload is consulted and unseen DB objects aren't added.
 * Untagged rulers, calibration graphics, labels and image annotations are ignored. */
export function reconcileCanvasSnapshot(input:QuoteCoreSnapshot,objects:readonly SceneMeasurementObject[]):CanvasCaptureResult {
  const snapshot=cloneTakeoffSnapshot(input),byId=new Map<string,SceneMeasurementObject[]>();
  for(const o of objects)if(o.measurementId){const list=byId.get(o.measurementId)??[];list.push(o);byId.set(o.measurementId,list);}
  const known=new Set([...snapshot.roofAreas.map(a=>a.id),...snapshot.componentMeasurements.flatMap(g=>g.measurements.map(m=>m.id))]);
  const updatedMeasurementIds:string[]=[];
  const active=(m:{fromPageId?:string|null;quoteRoofAreaId?:string|null})=>(!m.fromPageId||m.fromPageId===snapshot.pageId)&&(!snapshot.areaScopeId||!m.quoteRoofAreaId||m.quoteRoofAreaId===snapshot.areaScopeId);
  for(const a of snapshot.roofAreas){
    if(!active(a)||a.visible===false)continue;
    // Legacy area IDs sometimes tag the same ONE displayed polygon. Never
    // use an area alias where multiple polygons share it.
    const alias=a.quoteRoofAreaId&&snapshot.roofAreas.filter(b=>b.quoteRoofAreaId===a.quoteRoofAreaId).length===1?a.quoteRoofAreaId:undefined;
    if(alias)known.add(alias);
    const list=byId.get(a.id)??(alias?byId.get(alias):undefined);if(!list)continue;
    const markers=list.filter(o=>Number.isInteger(o.vertexIndex));
    let points:Point[]|null=null;
    if(markers.length===a.points.length&&new Set(markers.map(o=>o.vertexIndex)).size===a.points.length&&markers.every(o=>o.vertexIndex!>=0&&o.vertexIndex!<a.points.length)){
      points=[...markers].sort((x,y)=>x.vertexIndex!-y.vertexIndex!).map(o=>{
        const p=o.getCenterPoint?.();if(!p||![p.x,p.y].every(Number.isFinite))throw new Error('An outline handle has no scene position. Finish the current edit first.');
        return {x:p.x,y:p.y};
      });
    }else{
      const polys=list.filter(o=>o.type?.toLowerCase()==='polygon');
      if(polys.length>1)throw new Error('More than one live polygon has the same outline ID. Finish the current edit first.');
      if(polys.length)points=readShape(polys[0]);
    }
    if(points){a.points=points;updatedMeasurementIds.push(a.id);}
  }
  for(const g of snapshot.componentMeasurements)for(const m of g.measurements){
    if(!active(m)||m.visible===false||!isPlanLineMeasurement(m))continue;
    const list=byId.get(m.id);if(!list)continue;
    const points=polyline(list);
    if(points){m.points=points;updatedMeasurementIds.push(m.id);}
  }
  const unmatchedSceneMeasurementIds=[...byId].filter(([id,list])=>!known.has(id)&&list.some(o=>['line','polygon','polyline'].includes(o.type?.toLowerCase()??''))).map(([id])=>id);
  return {snapshot,updatedMeasurementIds,unmatchedSceneMeasurementIds};
}
