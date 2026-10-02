import type { Issue, Point, RoofEdge, RoofFace, RoofInput } from './types';
import { EPS, distance, projection, segmentHits, signedArea, validateRing, containsPoint } from './math';
import { area, fromRing, intersect, subtract, unionAll } from './regions';
import { validatePartition } from './partition';
import { inferredFlow } from './reviewGeometry';
import { normaliseLinework, type BoundaryRepair, type DrawingAdjustment } from './drafting';
export { validatePartition } from './partition';
export interface FaceDetection { faces: RoofFace[]; issues: Issue[]; repairs: BoundaryRepair[]; adjustments: DrawingAdjustment[]; normalisedEdges?: RoofEdge[] }
/** Node real crossings, conservatively repair near misses, and polygonise the
 * cyclic graph. Dangling bridges are diagnosed LOCALLY, not walked twice into
 * an invalid outer cycle that discards otherwise closed neighbouring cells. */
export function deriveFaces(roof: RoofInput, snapTolerance?: number): FaceDetection {
  const issues:Issue[]=[], perimeter:RoofEdge[]=[];
  if(!roof.outlines.length)return{faces:[],issues:[{severity:'error',code:'NO_OUTLINE',message:'Select at least one roof outline.'}],repairs:[],adjustments:[]};
  if(snapTolerance!==undefined&&(!Number.isFinite(snapTolerance)||snapTolerance<0))throw new Error('Drawing tolerance must be finite and non-negative.');
  for(const o of roof.outlines){
    const invalid=validateRing(o.polygon);if(invalid)throw new Error(`${o.name}: ${invalid}`);
    o.polygon.forEach((a,i)=>perimeter.push({id:`${o.id}:boundary:${i}`,a:{...a},b:{...o.polygon[(i+1)%o.polygon.length]},kind:'unknown'}));
  }
  if(perimeter.length+roof.edges.length>1200)throw new Error('This review supports at most 1200 selected boundary/component segments.');
  if(roof.edges.some(e=>![e.a.x,e.a.y,e.b.x,e.b.y].every(Number.isFinite)))throw new Error('A roof boundary has invalid coordinates.');
  const prepared=normaliseLinework(roof,perimeter,snapTolerance);
  const input=[...perimeter,...prepared.edges],splits=input.map(e=>[e.a,e.b]);
  if(prepared.adjustments.length)issues.push({severity:'warning',code:'SNAPPED_ENDPOINTS',message:`Aligned ${prepared.adjustments.length} nearby boundary endpoints for this review. Original takeoff measurements are unchanged.`});
  for(let i=0;i<input.length;i++)for(let j=i+1;j<input.length;j++){
    const hits=segmentHits(input[i],input[j]);splits[i].push(...hits);splits[j].push(...hits);
  }
  const pts:Point[]=[],buckets=new Map<string,number[]>(),epsilon=1e-6;
  const idx=(p:Point):number=>{
    const x=Math.round(p.x/epsilon),y=Math.round(p.y/epsilon);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const i of buckets.get(`${x+dx}:${y+dy}`)??[])if(distance(p,pts[i])<epsilon)return i;
    if(pts.length>=20000)throw new Error('Too many boundary intersections. Review duplicated/crossing measurement lines.');
    const i=pts.push({...p})-1,k=`${x}:${y}`;buckets.set(k,[...(buckets.get(k)??[]),i]);return i;
  };
  interface Link { a:number; b:number; edge:RoofEdge; key:string }
  const key=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
  const links=new Map<string,Link>(),conflictingKeys=new Set<string>();
  input.forEach((e,i)=>{
    const ps=splits[i].sort((a,b)=>projection(a,e.a,e.b).t-projection(b,e.a,e.b).t);
    for(let j=0;j<ps.length-1;j++){
      const a=idx(ps[j]),b=idx(ps[j+1]);if(a===b)continue;
      const k=key(a,b),prev=links.get(k);
      if(prev&&prev.edge.kind!=='unknown'&&e.kind!=='unknown'&&prev.edge.kind!==e.kind){
        issues.push({severity:'warning',code:'CONFLICTING_EDGE',objectId:e.id,location:pts[a],message:`Two overlapping boundaries have different labels (${prev.edge.kind} / ${e.kind}). Review that boundary in the takeoff; its geometry is retained.`});
        // Preserve the geometric separator, without inventing a reliable cut
        // classification. User review must settle an ambiguous material label.
        conflictingKeys.add(k);prev.edge={...prev.edge,kind:'unknown'};continue;
      }
      if(conflictingKeys.has(k))continue;
      if(!prev||prev.edge.kind==='unknown')links.set(k,{a,b,key:k,edge:{...e,a:pts[a],b:pts[b]}});
    }
  });
  const adjacent:Link[][]=pts.map(()=>[]);for(const e of links.values()){adjacent[e.a].push(e);adjacent[e.b].push(e);}
  // Iterative Tarjan bridge search avoids JS recursion depth for long polylines.
  const visitedAt=new Int32Array(pts.length),low=new Int32Array(pts.length),bridges=new Set<string>();let clock=0;
  for(let root=0;root<pts.length;root++){
    if(visitedAt[root])continue;
    const stack:{v:number;parent:number;via:string;next:number}[]=[{v:root,parent:-1,via:'',next:0}];visitedAt[root]=low[root]=++clock;
    while(stack.length){
      const f=stack[stack.length-1];
      if(f.next<adjacent[f.v].length){
        const e=adjacent[f.v][f.next++],w=e.a===f.v?e.b:e.a;if(e.key===f.via)continue;
        if(!visitedAt[w]){visitedAt[w]=low[w]=++clock;stack.push({v:w,parent:f.v,via:e.key,next:0});}
        else low[f.v]=Math.min(low[f.v],visitedAt[w]);
      }else{
        stack.pop();if(f.parent>=0){low[f.parent]=Math.min(low[f.parent],low[f.v]);if(low[f.v]>visitedAt[f.parent])bridges.add(f.via);}
      }
    }
  }
  const neighbors:number[][]=pts.map(()=>[]);
  for(const e of links.values())if(!bridges.has(e.key)){neighbors[e.a].push(e.b);neighbors[e.b].push(e.a);}
  neighbors.forEach((ns,i)=>ns.sort((a,b)=>Math.atan2(pts[a].y-pts[i].y,pts[a].x-pts[i].x)-Math.atan2(pts[b].y-pts[i].y,pts[b].x-pts[i].x)));
  const walked=new Set<string>(),faces:RoofFace[]=[],outlineRegion=unionAll(roof.outlines.map(o=>fromRing(o.polygon)));
  for(const link of links.values()){
    if(bridges.has(link.key))continue;
    for(const [startA,startB] of [[link.a,link.b],[link.b,link.a]]){
      if(walked.has(`${startA}:${startB}`))continue;
      let a=startA,b=startB,closed=false;const cycle:number[]=[],boundary:RoofEdge[]=[];
      for(let count=0;count<=links.size*2;count++){
        const k=`${a}:${b}`;if(walked.has(k))break;walked.add(k);cycle.push(a);
        const e=links.get(key(a,b))!;boundary.push({...e.edge,a:pts[a],b:pts[b]});
        const ns=neighbors[b],position=ns.indexOf(a);if(position<0||!ns.length)break;
        const next=ns[(position-1+ns.length)%ns.length];a=b;b=next;
        if(a===startA&&b===startB){closed=true;break;}
      }
      const polygon=cycle.map(i=>pts[i]);if(!closed||polygon.length<3||signedArea(polygon)<=EPS)continue;
      const invalid=validateRing(polygon);
      if(invalid){issues.push({severity:'error',code:'OPEN_TOPOLOGY',location:polygon[0],message:'This local boundary could not form a simple roof face. Split or redraw the highlighted area.'});continue;}
      const region=fromRing(polygon);if(area(subtract(region,outlineRegion))>Math.max(1e-5,area(region)*1e-10))continue;
      const owner=roof.outlines.find(o=>area(intersect(region,fromRing(o.polygon)))>area(region)*.99),id=`face-${faces.length+1}`,flow=inferredFlow({boundary});
      faces.push({id,name:`Face ${String.fromCharCode(65+faces.length%26)}${faces.length>=26?Math.floor(faces.length/26):''}`,polygon,boundary,flow,lap:1,lapLocked:false,pitchDeg:owner?.suggestedPitchDeg??null,laneOffsetMm:0,confirmed:false,provenance:'derived'});
      if(!flow)issues.push({severity:'warning',code:'FLOW_REVIEW',faceId:id,message:'Choose the water direction for this face.'});
    }
  }
  // Annotate the face touched by an unresolved line instead of discarding all
  // other closed faces. Approval may acknowledge it; missing roof area cannot.
  const seen=new Set<string>();
  for(const k of bridges){
    const l=links.get(k)!,e=l.edge;if(seen.has(e.id))continue;seen.add(e.id);
    const mid={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2};
    const f=faces.find(f=>containsPoint(f.polygon,mid));
    if(!f&&!roof.outlines.some(o=>containsPoint(o.polygon,mid)))continue;
    const location=adjacent[l.a].length===1?e.a:adjacent[l.b].length===1?e.b:mid;
    const repair=prepared.repairs.find(r=>r.edgeId===e.id);
    issues.push({severity:'error',code:'DANGLING_LINE',faceId:f?.id,objectId:e.id,location,suggestionId:repair?.id,
      message:`A ${e.kind==='unknown'?'boundary':e.kind.replace('_',' ')} stops before closing ${f?.name??'this area'}. Connect the suggested end, split/draw the missing face, or confirm this face if the line is not a roof-plane boundary.`});
  }
  issues.push(...validatePartition(roof,faces));
  return{faces,issues,repairs:prepared.repairs,adjustments:prepared.adjustments,normalisedEdges:roof.edges.map(e=>structuredClone(prepared.edges.find(n=>n.id===e.id)??e))};
}
