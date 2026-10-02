/** Face-review precision is deliberately separate from physical cut/fit precision.
 * All limits are in calibrated plan millimetres, never zoomed screen pixels.
 * No measurements or saved takeoff objects are mutated by these helpers. */
import type { Point, RoofEdge, RoofInput, RoofFace } from './types';
import { EPS, distance, projection, sub, unit, validateRing, fingerprint, containsPoint, dot, segmentHits } from './math';
import { area, fromRing, subtract } from './regions';

export type DraftingLevel = 'tight' | 'balanced' | 'relaxed';
const POLICIES = {
  tight: { snapMm: 10, autoJoinMm: 50, suggestMm: 90, maxAreaMm2: 150_000, totalAreaMm2: 400_000, fraction: .001 },
  balanced: { snapMm: 30, autoJoinMm: 150, suggestMm: 200, maxAreaMm2: 350_000, totalAreaMm2: 1_000_000, fraction: .003 },
  relaxed: { snapMm: 50, autoJoinMm: 150, suggestMm: 250, maxAreaMm2: 600_000, totalAreaMm2: 1_500_000, fraction: .005 },
} as const;
export function draftingPolicy(roof: RoofInput) {
  const level: DraftingLevel = roof.draftingTolerance && roof.draftingTolerance in POLICIES ? roof.draftingTolerance : 'balanced';
  const calibrated = roof.calibrationConfirmed && Number.isFinite(roof.mmPerSceneUnit) && roof.mmPerSceneUnit > 0;
  const scale = calibrated ? roof.mmPerSceneUnit : 1;
  return { level, ...POLICIES[level], calibrated, scale,
    snapScene: calibrated ? POLICIES[level].snapMm / scale : 0,
    autoJoinScene: calibrated ? POLICIES[level].autoJoinMm / scale : 0,
    suggestScene: calibrated ? POLICIES[level].suggestMm / scale : 0 };
}
export interface BoundaryRepair {
  id: string; edgeId: string; end: 'a' | 'b'; from: Point; to: Point;
  targetEdgeId: string; kind: 'join' | 'extend' | 'trim'; distanceMm: number;
  ambiguous: boolean; message: string;
}
export interface DrawingAdjustment {
  objectId: string; from: Point; to: Point; distanceMm: number; reason: string;
}
interface Candidate { point: Point; target: RoofEdge; distance: number; kind: BoundaryRepair['kind']; rank: number }
/** Face PROPOSAL recovery only. Never used to accept a short physical offcut.
 * Collinear continuation or an along-line intersection is preferable to bending
 * a line toward a nearby feature. Parallel offset lines remain distinct. */
function candidates(edge: RoofEdge, end: 'a'|'b', targets: RoofEdge[], limit: number, micro: number): Candidate[] {
  const p=edge[end], other=edge[end==='a'?'b':'a'], delta=sub(p,other), len=Math.hypot(delta.x,delta.y);
  if(len<EPS||limit<=0)return[];
  const u=unit(delta), out:Candidate[]=[];
  const add=(q:Point,target:RoofEdge,kind:BoundaryRepair['kind']):void=>{
    const d=distance(p,q), next=sub(q,other), nextLen=Math.hypot(next.x,next.y);
    if(d<=EPS||d>limit+EPS||nextLen<Math.max(1e-5,len*.5))return;
    const alignment=dot(u,unit(next));
    if(alignment<Math.cos(7.5*Math.PI/180))return;
    // Do not collapse a real short step into its other endpoint. The old len*.2
    // rule also rejected a 3 mm repair on a tiny barge; use direction and retained
    // length instead of that arbitrary ratio.
    const bend=Math.abs((q.x-p.x)*u.y-(q.y-p.y)*u.x);
    if(kind==='join'&&bend>micro&&bend>d*.15)return;
    out.push({point:{...q},target,distance:d,kind,rank:d+bend*3});
  };
  for(const target of targets){
    if(target.id===edge.id||distance(target.a,target.b)<EPS)continue;
    const v=unit(sub(target.b,target.a)), sine=Math.abs(u.x*v.y-u.y*v.x);
    const collinear=Math.abs((target.a.x-p.x)*u.y-(target.a.y-p.y)*u.x)<1e-6;
    if(sine<.20&&!collinear)continue;
    for(const q of [target.a,target.b])add(q,target,'join');
    if(sine>=.20){
      const a=sub(target.a,p),w=sub(target.b,target.a),den=u.x*w.y-u.y*w.x;
      const t=(a.x*w.y-a.y*w.x)/den,s=(a.x*u.y-a.y*u.x)/den;
      if(s>=-EPS&&s<=1+EPS)add({x:p.x+t*u.x,y:p.y+t*u.y},target,t>=0?'extend':'trim');
    }
  }
  return out.sort((a,b)=>a.rank-b.rank||a.distance-b.distance||a.point.x-b.point.x||a.point.y-b.point.y||a.target.id.localeCompare(b.target.id));
}
function connected(edge:RoofEdge,end:'a'|'b',targets:RoofEdge[]):boolean {
  return targets.some(t=>t.id!==edge.id&&projection(edge[end],t.a,t.b).distance<1e-6);
}
function uniqueCandidates(cs:Candidate[]):Candidate[]{
  const out:Candidate[]=[];for(const c of cs)if(!out.some(x=>distance(c.point,x.point)<1e-5))out.push(c);return out;
}
export function normaliseLinework(roof:RoofInput,outlineEdges:RoofEdge[],overrideScene?:number):{
  edges:RoofEdge[];adjustments:DrawingAdjustment[];repairs:BoundaryRepair[];
}{
  const policy=draftingPolicy(roof),snap=overrideScene??policy.autoJoinScene,suggest=Math.max(snap,policy.suggestScene);
  const micro=policy.calibrated?5/policy.scale:1e-5;
  const edges=roof.edges.filter(e=>!roof.faceDetectionIgnoredEdgeIds?.includes(e.id)&&distance(e.a,e.b)>EPS).map(e=>structuredClone(e));
  const adjustments:DrawingAdjustment[]=[],repairs:BoundaryRepair[]=[];
  const all=()=>[...outlineEdges,...edges];
  const start=new Map(edges.map(e=>[e.id,structuredClone(e)]));
  // Geometry order is invariant to source order and AI/manual component names.
  const ordered=[...edges].sort((a,b)=>Math.min(a.a.x,a.b.x)-Math.min(b.a.x,b.b.x)||Math.min(a.a.y,a.b.y)-Math.min(b.a.y,b.b.y)||distance(b.a,b.b)-distance(a.a,a.b)||a.id.localeCompare(b.id));
  const inside=(p:Point):boolean=>roof.outlines.some(o=>containsPoint(o.polygon,p))||outlineEdges.some(e=>projection(p,e.a,e.b).distance<1e-5);
  const safe=(edge:RoofEdge,end:'a'|'b',c:Candidate):boolean=>{
    const original=start.get(edge.id)![end];
    if(distance(original,c.point)>snap+EPS)return false;
    // Never bridge two separate roof outlines or cross an exterior courtyard.
    for(const t of [.25,.5,.75,1])if(!inside({x:edge[end].x+(c.point.x-edge[end].x)*t,y:edge[end].y+(c.point.y-edge[end].y)*t})){
      // An overshoot is allowed to return INTO the roof, but not cut across an
      // exterior gap. Its pre-existing outside portion must be shortened.
      if(c.kind!=='trim'||!inside(c.point))return false;
    }
    // Stop at the first intervening real boundary, not a farther attractive node.
    const move={a:edge[end],b:c.point};
    for(const t of all())if(t.id!==edge.id&&t.id!==c.target.id){
      for(const hit of segmentHits(move,t))if(distance(hit,move.a)>micro&&distance(hit,move.b)>micro)return false;
    }
    return true;
  };
  const ambiguous=(opts:Candidate[]):boolean=>{
    if(opts.length<2)return false;
    const best=opts[0];
    // Two mathematical projections within 5 mm of the same endpoint are one
    // join, not twenty prompts. Distinct competing junctions are NOT guessed.
    return opts.slice(1).some(c=>c.rank<=best.rank*1.25+1e-6&&distance(c.point,best.point)>micro);
  };
  for(let pass=0;pass<3;pass++){
    let changed=false;
    for(const edge of ordered)for(const end of ['a','b'] as const){
      if(connected(edge,end,all()))continue;
      const options=uniqueCandidates(candidates(edge,end,all(),snap,micro)).filter(c=>safe(edge,end,c));
      if(!options.length||ambiguous(options))continue;
      const best=options[0],from={...edge[end]};edge[end]={...best.point};changed=true;
      adjustments.push({objectId:edge.id,from,to:{...best.point},distanceMm:distance(from,best.point)*policy.scale,reason:`Automatic ${best.kind} to a unique ${best.target.kind} boundary (face proposal only)`});
    }
    if(!changed)break;
  }
  for(const edge of ordered)for(const end of ['a','b'] as const){
    if(connected(edge,end,all()))continue;
    const opts=uniqueCandidates(candidates(edge,end,all(),suggest,micro)).slice(0,3);
    for(const c of opts)repairs.push({id:`repair-${fingerprint([edge.id,end,edge[end],c.point])}`,edgeId:edge.id,end,from:{...edge[end]},to:{...c.point},targetEdgeId:c.target.id,kind:c.kind,distanceMm:c.distance*policy.scale,ambiguous:ambiguous(opts),
      message:`This ${edge.kind==='unknown'?'boundary':edge.kind.replace('_',' ')} has ${ambiguous(opts)?'more than one possible connection':'a connection outside automatic recovery limits'}. Review the highlighted join.`});
  }
  return{edges,adjustments,repairs};
}
export interface DrawingSnap { point:Point; kind:'vertex'|'edge'|'close'; distanceMm:number }
/** Drawing snap is user-intent assisted, bounded in both screen pixels and real
 * distance. It never changes a roof outline or invents a closing edge. */
export function snapDrawingPoint(point:Point,roof:RoofInput,faces:RoofFace[],options:{sceneUnitsPerPixel:number;pending?:Point[];excludePoint?:Point}):DrawingSnap|null {
  const policy=draftingPolicy(roof), limit=Math.min(10*options.sceneUnitsPerPixel,policy.suggestScene);
  if(!Number.isFinite(limit)||limit<=0)return null;
  const pending=options.pending??[], first=pending[0];
  if(pending.length>=3&&first&&distance(point,first)<=limit)return{point:{...first},kind:'close',distanceMm:distance(point,first)*policy.scale};
  const rings=[...roof.outlines.map(o=>o.polygon),...faces.map(f=>f.polygon)];
  const candidates:{point:Point;kind:'vertex'|'edge';distance:number}[]=[];
  const excluded=(p:Point)=>options.excludePoint&&distance(p,options.excludePoint)<1e-5;
  for(const ring of rings)for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    if(!excluded(a)&&distance(point,a)<=limit)candidates.push({point:a,kind:'vertex',distance:distance(point,a)});
    // Do not snap a moved vertex back onto one of its own incident edges.
    if(excluded(a)||excluded(b))continue;
    const hit=projection(point,a,b);
    if(hit.distance<=limit)candidates.push({point:hit.point,kind:'edge',distance:hit.distance});
  }
  for(const e of roof.edges){
    if(excluded(e.a)||excluded(e.b))continue;
    const hit=projection(point,e.a,e.b);if(hit.distance<=limit)candidates.push({point:hit.point,kind:'edge',distance:hit.distance});
  }
  candidates.sort((a,b)=>(a.kind==='vertex'?0:1)-(b.kind==='vertex'?0:1)||a.distance-b.distance);
  const best=candidates[0];return best?{point:{...best.point},kind:best.kind,distanceMm:best.distance*policy.scale}:null;
}
/** Safe review-only vertex alignment. Earlier faces and the accepted outline
 * are anchors. A narrow, legitimate plane is never collapsed. All changes are
 * returned for auditing/undo; approval is invalidated on changed faces. */
export function alignReviewedFaces(roof:RoofInput,faces:RoofFace[]):{faces:RoofFace[];adjustments:DrawingAdjustment[]}{
  const policy=draftingPolicy(roof),out=structuredClone(faces),adjustments:DrawingAdjustment[]=[];
  if(!policy.calibrated)return{faces:out,adjustments};
  for(let i=0;i<out.length;i++){
    const f=out[i];if(validateRing(f.polygon))continue;
    const anchors=[...roof.outlines.map(o=>o.polygon),...out.slice(0,i).map(a=>a.polygon)],before=f.polygon;
    const proposed=before.map((p,k)=>{
      const short=Math.min(distance(p,before[(k+before.length-1)%before.length]),distance(p,before[(k+1)%before.length]));
      const limit=Math.min(policy.snapScene,short*.1);let best=p,bestD=limit+EPS;
      // A nearby corner wins over an exactly-on-edge projection: a human can
      // land on the top edge 2 mm beside its intended shared corner.
      let vertexFound=false;
      for(const ring of anchors)for(const q of ring){const d=distance(p,q);if(d<=limit&&d<bestD){best=q;bestD=d;vertexFound=true;}}
      if(!vertexFound)for(const ring of anchors)for(let j=0;j<ring.length;j++){
        const a=ring[j],b=ring[(j+1)%ring.length],h=projection(p,a,b);
        if(h.distance<bestD){best=h.point;bestD=h.distance;}
      }
      return {...best};
    });
    if(validateRing(proposed))continue;
    const a=fromRing(before),b=fromRing(proposed),changed=(area(subtract(a,b))+area(subtract(b,a)))*policy.scale**2;
    if(changed>Math.min(policy.maxAreaMm2,area(a)*policy.scale**2*.01))continue;
    for(let j=0;j<before.length;j++)if(distance(before[j],proposed[j])>EPS)adjustments.push({objectId:f.id,from:{...before[j]},to:{...proposed[j]},distanceMm:distance(before[j],proposed[j])*policy.scale,reason:'Align reviewed vertex with neighbouring face / roof outline'});
    if(changed>EPS){f.polygon=proposed;f.confirmed=false;delete f.directionApproval;f.provenance='edited';}
  }
  return{faces:out,adjustments};
}

/** Explicit Rebuild can reconsider the previous AUTO proposals under a new
 * tolerance. Accepted manual connections and changed endpoints are untouched.
 * The user's original takeoff is never modified. */
export function revertAutomaticJoins(roof:RoofInput,adjustments:DrawingAdjustment[]):RoofInput {
  const next=structuredClone(roof);
  for(const change of [...adjustments].reverse()){
    if(!change.reason.startsWith('Automatic '))continue;
    const edge=next.edges.find(e=>e.id===change.objectId);if(!edge)continue;
    for(const end of ['a','b'] as const)if(distance(edge[end],change.to)<1e-6){edge[end]={...change.from};break;}
  }
  return next;
}
