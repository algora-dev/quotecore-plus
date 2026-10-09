/** Quoting-only registration protection. It is not a promise that arbitrary site
 * setout reproduces this cut list. Receiver grids and the original parent-stock
 * purchase remain as planned; the source valley cutting position may move through
 * one COMMON phase band. Both receivers are checked together, not at independent
 * favourable phases. Every scenario is bounded by the REAL nominal source piece.
 *
 * A horizontal sweep gives a conservative continuous envelope on each phase
 * interval (not just point samples). Assignments may change between intervals;
 * the purchased fresh stock and face lap directions are fixed for the whole band.
 * Fresh sheets can swap between the two receivers only when the same purchased
 * blanks physically fit. We do not add each side's independent worst-case buffer.
 * This permits recutting, never stretching, mirroring or re-purchasing an offcut.
 */
import type { Demand, Issue, Lap, Offcut, Placement, Region, Solution, SolveRequest } from './types';
import { adjacentValleyParents } from './valleyReceivers';
import { area, bandRing, extendY, subtract, translate, unionAll } from './regions';
import { matchCoherentSets } from './coherentMatching';
import { materialAtDestination, rebuildInventory } from './inventory';
import { findFit } from './fit';
import { frameFor, sceneToSurface, generateFaceDemands, sheetCount } from './material';

export const RECEIVER_SAFETY_MODEL='coupled-valley-phase-envelope-v2' as const;
export interface ReceiverFreshAssignment {rootDemandId:string;demandId:string;rotation:0|180;translateY:number}
export interface ReceiverScenario {
  phaseFromMm:number; phaseToMm:number;
  /** Simultaneous assignments for ALL receivers; a source piece can occur once. */
  reuse:Placement[];
  /** Actual quoted fresh roots used in this scenario; no extra purchase. */
  fresh:ReceiverFreshAssignment[];
}
export interface ReceiverFamilyCheck {
  sourceFaceId:string; faceIds:string[]; phaseHalfWidthMm:number;
  freshDemandIds:string[]; sourceOffcutIds:string[];
  scenarios:ReceiverScenario[];
  result:'phase-checked'|'fixed-registration'|'new-material-fallback';
  reason:string;
  nominalNewSheetsBefore:number; newSheetsAfter:number;
  starterAllocationMayVary:boolean;
  availableAreaByIntervalMm2:{from:number;to:number;negative:number;positive:number;apex:number}[];
}
export interface ReceiverSafetyReport {
  model:typeof RECEIVER_SAFETY_MODEL; families:ReceiverFamilyCheck[];
  mode:'quote-safe'|'fixed-registration';
  basis:'fixed-purchased-parents-and-receiver-grid';
  /** Does not certify unplanned changes to all earlier banks/site measurements. */
  orderReady:false;
}
function hull(points:{x:number;y:number}[]) {
  const ps=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),unique=ps.filter((p,i)=>!i||p.x!==ps[i-1].x||p.y!==ps[i-1].y);
  const cross=(o:typeof ps[0],a:typeof ps[0],b:typeof ps[0])=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const l:typeof ps=[],r:typeof ps=[];
  for(const p of unique){while(l.length>=2&&cross(l[l.length-2],l[l.length-1],p)<=1e-9)l.pop();l.push(p);}
  for(const p of [...unique].reverse()){while(r.length>=2&&cross(r[r.length-2],r[r.length-1],p)<=1e-9)r.pop();r.push(p);}
  return [...l.slice(0,-1),...r.slice(0,-1)];
}
function compactBands(r:Region):Region {
  const rows=[...r].sort((a,b)=>a.x0-b.x0||a.top0-b.top0),out:Region=[];
  for(const b of rows){
    const a=out[out.length-1];
    if(a&&Math.abs(a.x1-b.x0)<1e-7&&Math.abs(a.top1-b.top0)<1e-6&&Math.abs(a.bottom1-b.bottom0)<1e-6&&
      Math.abs((a.top1-a.top0)/(a.x1-a.x0)-(b.top1-b.top0)/(b.x1-b.x0))<1e-10&&
      Math.abs((a.bottom1-a.bottom0)/(a.x1-a.x0)-(b.bottom1-b.bottom0)/(b.x1-b.x0))<1e-10){a.x1=b.x1;a.top1=b.top1;a.bottom1=b.bottom1;}
    else out.push({...b});
  }
  return out;
}
/** Exact union of translations through [lo,hi] for piecewise-linear trapezoids. */
export function sweepAcrossSheet(region:Region,lo:number,hi:number):Region {
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi)throw new Error('Invalid phase interval.');
  if(Math.abs(hi-lo)<1e-8)return translate(region,lo,0);
  return unionAll(compactBands(region).map(b=>{
    const p=bandRing(b),ring=hull([...p.map(q=>({x:q.x+lo,y:q.y})),...p.map(q=>({x:q.x+hi,y:q.y}))]);
    // This ring is constructed as a convex hull, not user input. Sweep directly
    // rather than applying the user-polygon intersection tolerance to 1e-9 mm
    // roundoff edges. No physical boundary is moved or enlarged here.
    const xs=[...new Set(ring.map(p=>p.x))].sort((a,b)=>a-b),out:Region=[];
    for(let i=0;i<xs.length-1;i++){
      const x0=xs[i],x1=xs[i+1],mid=(x0+x1)/2;if(x1-x0<1e-7)continue;
      const segments=ring.map((a,j)=>({a,b:ring[(j+1)%ring.length]})).filter(e=>mid>Math.min(e.a.x,e.b.x)&&mid<Math.max(e.a.x,e.b.x));
      if(segments.length<2)continue;
      const y=(e:typeof segments[0],x:number)=>e.a.y+(e.b.y-e.a.y)*(x-e.a.x)/(e.b.x-e.a.x);
      segments.sort((a,b)=>y(a,mid)-y(b,mid));const top=segments[0],bottom=segments[segments.length-1];
      const row={x0,x1,top0:y(top,x0),top1:y(top,x1),bottom0:y(bottom,x0),bottom1:y(bottom,x1)};
      if(row.bottom0<row.top0&&row.top0-row.bottom0<1e-6)row.bottom0=row.top0;
      if(row.bottom1<row.top1&&row.top1-row.bottom1<1e-6)row.bottom1=row.top1;
      if(row.bottom0<row.top0||row.bottom1<row.top1)throw new Error('Invalid derived phase envelope.');
      if(area([row])>1e-7)out.push(row);
    }
    return out;
  }));
}
const phaseStockCache=new Map<string,Offcut[]>();
export function phaseProtectedStock(s:Pick<Solution,'demands'|'profile'>, sourceFaceId:string, stock:Offcut[],lo:number,hi:number):Offcut[] {
  const ds=s.demands.filter(d=>d.faceId===sourceFaceId),dm=new Map(ds.map(d=>[d.id,d]));
  const cacheKey=JSON.stringify([sourceFaceId,s.profile.cutGapMm,lo,hi,ds.map(d=>[d.id,d.origin,d.required]),stock]);
  const cached=phaseStockCache.get(cacheKey);if(cached)return structuredClone(cached);
  // All lanes share this face-local chart. Sweeping the complete cutter avoids
  // discontinuities at the edge of one lane or through the apex-spanning sheet.
  const cutter=unionAll(ds.map(d=>translate(d.required,d.origin.x,d.origin.y)));
  const swept=extendY(sweepAcrossSheet(cutter,lo,hi),s.profile.cutGapMm);
  const result=stock.filter(o=>o.sourceFaceId===sourceFaceId&&o.cutKind==='valley').map(o=>{
    const d=dm.get(o.sourceDemandId);if(!d)return {...o,region:[]};
    const safe=subtract(o.region,translate(swept,-d.origin.x,-d.origin.y));
    return {...o,region:safe};
  }).filter(o=>area(o.region)>1e-4);
  if(phaseStockCache.size>=96)phaseStockCache.delete(phaseStockCache.keys().next().value!);
  phaseStockCache.set(cacheKey,structuredClone(result));return result;
}
export function receiverFreshOrder(ds:Demand[]):{rows:Demand[];minimum:number}|null {
  const sorted=[...ds].sort((a,b)=>a.laneIndex-b.laneIndex),at=sorted.map((d,i)=>(d.eaveOverlapMm??0)>1e-7?i:-1).filter(i=>i>=0);
  if(!sorted.length)return null;
  if(!at.length)return{rows:sorted,minimum:1};
  // Only a barge-side contiguous starter run: do not guess through an interior eave.
  const touchesStart=at[0]===0,touchesEnd=at[at.length-1]===sorted.length-1;
  if(!touchesStart&&!touchesEnd)return null;
  const rows=touchesStart?sorted:sorted.reverse();
  const last=Math.max(...rows.map((d,i)=>(d.eaveOverlapMm??0)>1e-7?i:-1));
  return{rows,minimum:last+1};
}
function fresh(id:string):Placement{return{demandId:id,kind:'new',rotation:0,translateY:0};}
/** Fit a set of already purchased rectangular starters to another allocation.
 * Augmenting-path matching avoids greedily consuming the only suitable root.
 * The quote's root count/lengths stay fixed even when installation sides change. */
export function matchReceiverFreshStock(roots:Demand[],targets:Demand[],profile:Solution['profile']):ReceiverFreshAssignment[]|null {
  if(targets.length>roots.length)return null;
  const source=(d:Demand):Offcut=>({id:'fresh:'+d.id,sourceDemandId:d.id,sourceFaceId:d.faceId,region:d.blank,widthMm:d.widthMm,lap:d.lap});
  const edges=targets.map(d=>roots.map((root,i)=>({i,p:findFit(source(root),d,profile)})).filter(e=>e.p!==null).sort((a,b)=>Number(roots[a.i].id!==d.id)-Number(roots[b.i].id!==d.id)));
  const assigned=new Map<number,number>();
  function claim(t:number,seen:Set<number>):boolean {
    const choices=[...edges[t].filter(e=>!assigned.has(e.i)),...edges[t].filter(e=>assigned.has(e.i))];
    for(const e of choices){if(seen.has(e.i))continue;seen.add(e.i);const previous=assigned.get(e.i);
      if(previous===undefined||claim(previous,seen)){assigned.set(e.i,t);return true;}}
    return false;
  }
  for(let t=0;t<targets.length;t++)if(!claim(t,new Set()))return null;
  return [...assigned].map(([i,t])=>{const p=edges[t].find(e=>e.i===i)!.p!;return{rootDemandId:roots[i].id,demandId:targets[t].id,rotation:p.rotation,translateY:p.translateY};});
}
/** A changed receiver cannot leave a fictitious descendant alive. Invalidated
 * descendants receive a real new blank, counted once, instead of phantom reuse. */
export function reconcileCutDependencies(s:Solution):void {
  const dm=new Map(s.demands.map(d=>[d.id,d]));
  for(let pass=0;pass<=s.placements.length;pass++){
    const result=rebuildInventory(s.demands,s.placements,s.profile),os=new Map(result.offcuts.map(o=>[o.id,o]));
    let changed=false;
    s.placements=s.placements.map(p=>{
      if(p.kind==='new')return p;
      const o=os.get(p.offcutId??''),d=dm.get(p.demandId)!;
      if(!o){changed=true;return fresh(p.demandId);}
      if((p.rotation===180?-o.lap:o.lap)!==d.lap||area(subtract(d.required,materialAtDestination(o,p)))>Math.max(.001,area(d.required)*1e-9)){
        const fitted=findFit(o,d,s.profile);changed=true;return fitted??fresh(d.id);
      }
      return p;
    });
    if(!changed){s.offcuts=result.offcuts;return;}
  }
  throw new Error('Could not reconcile receiver cut dependencies.');
}
export function recalculateMetrics(s:Solution):void {
  const freshIds=new Set(s.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
  const supplied=s.demands.filter(d=>freshIds.has(d.id)).reduce((n,d)=>n+area(d.blank),0);
  const baseline=s.demands.reduce((n,d)=>n+area(d.blank),0),net=s.demands.reduce((n,d)=>n+area(d.cover),0),required=s.demands.reduce((n,d)=>n+area(d.required),0);
  s.metrics={newMaterialMm2:supplied,baselineNewMaterialMm2:baseline,netRoofMm2:net,installedPhysicalMm2:required,wasteMm2:supplied-required,
    savedMm2:baseline-supplied,newSheetCount:freshIds.size,reusedPieceCount:s.placements.filter(p=>p.kind==='reuse').length};
}
/** Refine a few small adjoining receivers, not the main bank strategy. This runs
 * after the bounded bank search and before final ranking and quantity export. */
function protectFixedReceiverGrids(request:SolveRequest,s:Solution,cancel?:()=>boolean):void {
  const refinementStarted=performance.now();
  const mode=request.settings.receiverPhaseMode??'quote-safe';
  const report:ReceiverSafetyReport={model:RECEIVER_SAFETY_MODEL,mode,basis:'fixed-purchased-parents-and-receiver-grid',families:[],orderReady:false};
  const groups=new Map<string,string[]>();
  for(const [target,parent] of adjacentValleyParents(request.faces,request.roof)){const group=groups.get(parent)??[];group.push(target);groups.set(parent,group);}
  for(const [parent,faces] of groups){
    if(cancel?.())throw new Error('Offcut search cancelled.');
    // A terminal receiving pair is NOT another long primary elevation bank.
    // Do not buy A/J's controlling length for an I starter merely because they
    // point the same way. Keep full LOCAL ridge lengths for angled starters.
    // Existing outgoing cuts or an explicit main-bank operation protect stock
    // continuity: those operations are never shortened by this local allowance.
    const outgoing=s.placements.some(p=>p.kind==='reuse'&&!faces.includes(s.demands.find(d=>d.id===p.demandId)?.faceId??'')&&
      faces.includes(s.offcuts.find(o=>o.id===p.offcutId)?.sourceFaceId??''));
    const protectedOperation=s.bankLayout?.primaryOperations?.some(op=>op.faceIds.some(id=>faces.includes(id)))||
      s.bankLayout?.selfFillFaceIds?.some(id=>faces.includes(id));
    if(s.bankLayout&&!outgoing&&!protectedOperation){
      for(const id of faces){
        const face=request.faces.find(f=>f.id===id)!,frame=frameFor(face,request.roof),points=face.polygon.map(p=>sceneToSurface(p,frame));
        const localLength=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
        s.bankLayout.receiverStockLengthByFace={...s.bankLayout.receiverStockLengthByFace,[id]:localLength};
        s.bankLayout.extraLengthByFace[id]=0;s.bankLayout.tailExtensionByFace={...s.bankLayout.tailExtensionByFace,[id]:0};
        s.bankLayout.primaryFaceIds=s.bankLayout.primaryFaceIds.filter(faceId=>faceId!==id);
        const bank=s.bankLayout.materialBanks?.find(b=>b.faceIds.includes(id));
        const generated=generateFaceDemands(request.roof,{...face,lap:s.lapByFace[id],laneOffsetMm:s.bankLayout.laneOffsetByFace[id]},s.profile,s.settings,false,0,localLength,0,bank?.id,localLength);
        const byId=new Map(generated.map(d=>[d.id,d]));s.demands=s.demands.map(d=>d.faceId===id?byId.get(d.id)!:d);
      }
      reconcileCutDependencies(s);
    }
    const before=s.placements.filter(p=>faces.includes(s.demands.find(d=>d.id===p.demandId)?.faceId??'')&&p.kind==='new').length;
    const elsewhere=new Set(s.placements.filter(p=>p.kind==='reuse'&&!faces.includes(s.demands.find(d=>d.id===p.demandId)?.faceId??'')).map(p=>p.offcutId));
    const stock=s.offcuts.filter(o=>o.sourceFaceId===parent&&o.cutKind==='valley'&&!elsewhere.has(o.id));
    const ds=s.demands.filter(d=>faces.includes(d.faceId));
    const orders=faces.map(id=>({id,order:receiverFreshOrder(ds.filter(d=>d.faceId===id)),face:request.faces.find(f=>f.id===id)!}));
    if(orders.some(o=>!o.order))continue; // Non-barge geometry is not silently treated as this receiver pattern.
    const half=mode==='quote-safe'?s.profile.coverMm*(request.settings.receiverPhaseCoverFraction??1)/2:0;
    const intervals: [number,number][]=half>1e-7?Array.from({length:8},(_,i)=>[-half+i*half/4,-half+(i+1)*half/4]):[[0,0]];
    const pools=[stock,...intervals.map(([a,b])=>phaseProtectedStock(s,parent,stock,a,b))];
    const start=performance.now(),budget=Math.min(6000,Math.max(1000,request.settings.maxMilliseconds*.5));
    let timedOut=false;
    const check=()=>{if(cancel?.())throw new Error('Offcut search cancelled.');if(performance.now()-start>budget){timedOut=true;throw new Error('receiver-budget');}};
    interface Option {freshIds:Set<string>;targets:Demand[];laps:Record<string,Lap>;cost:number}
    let options:Option[]=[{freshIds:new Set(),targets:[],laps:{},cost:0}];
    for(const {id,order:orderMaybe,face} of orders){
      const order=orderMaybe!,next:Option[]=[];
      const laps:Lap[]=request.settings.optimiseLapDirections&&!face.lapLocked?[s.lapByFace[id],s.lapByFace[id]===1?-1:1]:[s.lapByFace[id]];
      // A Simpler candidate may deliberately buy these rows to avoid a transfer.
      // Safety refinement must not undo that explicit simplicity choice.
      const chosenNew=new Set(s.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
      const minimum=s.objective==='simpler'?Math.max(order.minimum,1+Math.max(-1,...order.rows.map((d,i)=>chosenNew.has(d.id)?i:-1))):order.minimum;
      for(let k=minimum;k<=order.rows.length;k++)for(const lap of laps)for(const prior of options){
        const starter=order.rows.slice(0,k),targets=order.rows.slice(k).map(d=>({...d,lap}));
        next.push({freshIds:new Set([...prior.freshIds,...starter.map(d=>d.id)]),targets:[...prior.targets,...targets],laps:{...prior.laps,[id]:lap},cost:prior.cost+starter.reduce((n,d)=>n+area(d.blank),0)});
      }
      options=next.sort((a,b)=>a.cost-b.cost||a.freshIds.size-b.freshIds.size).slice(0,256);
    }
    // Equal-price starter arrangements should keep both valley halves useful,
    // instead of showing one entire receiver new and the other reused only due
    // to enumeration order. Physical fit/coupled phase checks still decide.
    const balance=(o:Option)=>Math.max(0,...faces.map(id=>ds.filter(d=>d.faceId===id&&o.freshIds.has(d.id)).length));
    // Full new material is a real, deterministic fallback even beyond the option budget.
    const allNew:Option={freshIds:new Set(ds.map(d=>d.id)),targets:[],laps:Object.fromEntries(faces.map(id=>[id,s.lapByFace[id]])),cost:ds.reduce((n,d)=>n+area(d.blank),0)};
    options.push(allNew);options.sort((a,b)=>a.cost-b.cost||a.freshIds.size-b.freshIds.size||balance(a)-balance(b));
    const cache=new Map<string,Placement[]|null>();
    function fitTogether(opt:Option,pool:Offcut[],interval:number):Placement[]|null {
      if(!opt.targets.length)return [];
      for(const sequence of [faces,[...faces].reverse()]){
        let available=pool;const placements:Placement[]=[];let fits=true;
        for(const id of sequence){
          const targets=opt.targets.filter(d=>d.faceId===id);if(!targets.length)continue;
          const key=JSON.stringify([interval,id,targets.map(d=>[d.id,d.lap]),available.map(o=>o.id)]);
          let ps=cache.get(key);
          if(ps===undefined){
            check();const match=matchCoherentSets(targets,available,s.profile,check,false,2);
            ps=match.placements.every(p=>p.kind==='reuse')?match.placements:null;cache.set(key,ps);
          }
          if(!ps){fits=false;break;}
          placements.push(...ps);const used=new Set(ps.map(p=>p.offcutId));available=available.filter(o=>!used.has(o.id));
        }
        if(fits)return placements;
      }
      return null;
    }
    let chosen=allNew, nominal:Placement[]=[],scenarios:ReceiverScenario[]=intervals.map(([a,b])=>({phaseFromMm:a,phaseToMm:b,reuse:[],fresh:ds.map(d=>({rootDemandId:d.id,demandId:d.id,rotation:0 as const,translateY:0}))}));
    // If receiver remnants have already been committed outside this pair, keep
    // its allocation fixed: a local phase certificate must not imply those
    // further downstream cuts are robust under an unmodelled fresh-stock swap.
    const outbound=s.placements.some(p=>p.kind==='reuse'&&!faces.includes(s.demands.find(d=>d.id===p.demandId)?.faceId??'')&&
      faces.includes(s.offcuts.find(o=>o.id===p.offcutId)?.sourceFaceId??''));
    const starterCache=new Map<string,ReceiverFreshAssignment[]|null>();
    try{
      for(const opt of options){
        check();const ps=fitTogether(opt,pools[0],-1);if(!ps)continue;
        const tested:ReceiverScenario[]=[];let valid=true;
        const roots=ds.filter(d=>opt.freshIds.has(d.id)).map(d=>({...d,lap:opt.laps[d.faceId]}));
        for(let i=0;i<intervals.length;i++){
          let certificate:ReceiverScenario|undefined;
          // Nominal allocation first. Otherwise transfer existing starter blanks
          // to the other side if there is an exact physical stock matching.
          const variants=outbound?[opt]:[opt,...options.filter(other=>other!==opt&&other.freshIds.size<=opt.freshIds.size&&faces.every(id=>other.laps[id]===opt.laps[id]))];
          for(const alternative of variants){
            check();const key=JSON.stringify([[...opt.freshIds],[...alternative.freshIds],opt.laps]);
            let freshAssignments=starterCache.get(key);
            if(freshAssignments===undefined){freshAssignments=matchReceiverFreshStock(roots,ds.filter(d=>alternative.freshIds.has(d.id)).map(d=>({...d,lap:opt.laps[d.faceId]})),s.profile);starterCache.set(key,freshAssignments);}
            if(!freshAssignments)continue;
            const result=fitTogether(alternative,pools[i+1],i);if(!result)continue;
            certificate={phaseFromMm:intervals[i][0],phaseToMm:intervals[i][1],reuse:result,fresh:freshAssignments};break;
          }
          if(!certificate){valid=false;break;}tested.push(certificate);
        }
        if(valid){chosen=opt;nominal=ps;scenarios=tested;break;}
      }
    }catch(error){if(!(error instanceof Error&&error.message==='receiver-budget'))throw error;}
    const replacements=new Map([...ds.filter(d=>chosen.freshIds.has(d.id)).map(d=>fresh(d.id)),...nominal].map(p=>[p.demandId,p]));
    s.placements=s.placements.map(p=>replacements.get(p.demandId)??p);
    for(const d of ds){d.lap=chosen.laps[d.faceId];s.lapByFace[d.faceId]=d.lap;}
    reconcileCutDependencies(s);
    report.families.push({sourceFaceId:parent,faceIds:faces,phaseHalfWidthMm:half,freshDemandIds:[...chosen.freshIds],sourceOffcutIds:stock.map(o=>o.id),scenarios,
      result:nominal.length?mode==='quote-safe'?'phase-checked':'fixed-registration':'new-material-fallback',
      reason:timedOut?'Receiver search reached its budget; real new starter stock retained.':nominal.length?'Smallest evaluated purchased starter stock that fits both receivers over the shared phase band; sides may share those same blanks where physically possible.':'The evaluated inherited stock did not safely complete the receiver; supply new material.',
      nominalNewSheetsBefore:before,newSheetsAfter:chosen.freshIds.size,
      starterAllocationMayVary:scenarios.some(c=>c.fresh.length!==chosen.freshIds.size||c.fresh.some(p=>p.rootDemandId!==p.demandId)),
      availableAreaByIntervalMm2:intervals.map(([from,to],i)=>({from,to,negative:pools[i+1].filter(o=>o.cutArm==='negative').reduce((n,o)=>n+area(o.region),0),positive:pools[i+1].filter(o=>o.cutArm==='positive').reduce((n,o)=>n+area(o.region),0),apex:pools[i+1].filter(o=>o.cutArm==='apex').reduce((n,o)=>n+area(o.region),0)}))});
  }
  s.receiverSafety=report;recalculateMetrics(s);s.search.elapsedMs+=performance.now()-refinementStarted;
  if(report.families.length){
    s.issues.push({severity:'warning',code:'RECEIVER_SET_OUT',message:'Valley receivers include a shared source-phase check. Follow the receiving grid and recheck site lengths before ordering; unplanned changes to earlier banks require recalculation.'});
    if(s.decisionTrace)s.decisionTrace.events.push({step:s.decisionTrace.events.length+1,action:'coupled-valley-receiver-check',message:'Both sides were checked together using actual inherited stock. New starter sheets counted once; final quantities follow this refinement.',data:{mode,model:RECEIVER_SAFETY_MODEL,families:report.families}});
  }
}
/** Compare a few barge-anchored receiving grids before finalising starters.
 * Source parents remain fixed. A phase audit is run again for EVERY candidate;
 * changing the grid is not permission to keep an old certificate or invent cuts.
 * We only alter terminal receiver families with no outgoing commitments. */
export function protectValleyReceivers(request:SolveRequest,s:Solution,cancel?:()=>boolean):void {
  protectFixedReceiverGrids(request,s,cancel);
  if(s.objective==='simpler'||!s.bankLayout)return;
  const started=performance.now();
  const budget=Math.max(1000,Math.min(6000,request.settings.maxMilliseconds));
  const families=new Map<string,string[]>();
  for(const [id,parent] of adjacentValleyParents(request.faces,request.roof)){
    const ids=families.get(parent)??[];ids.push(id);families.set(parent,ids);
  }
  for(const [parent,ids] of families){
    if(ids.length>2||performance.now()-started>budget)continue;
    const outgoing=s.placements.some(p=>p.kind==='reuse'&&!ids.includes(s.demands.find(d=>d.id===p.demandId)?.faceId??'')&&ids.includes(s.offcuts.find(o=>o.id===p.offcutId)?.sourceFaceId??''));
    if(outgoing)continue;
    let combinations:Record<string,number>[]=[{}];
    for(const id of ids){
      const face=request.faces.find(f=>f.id===id)!,frame=frameFor(face,request.roof),xs=face.polygon.map(p=>sceneToSurface(p,frame).x);
      const span=Math.max(...xs)-Math.min(...xs),slack=sheetCount(span,s.profile.coverMm)*s.profile.coverMm-span;
      const offsets=face.laneOffsetLocked?[face.laneOffsetMm]:[0,Math.max(0,slack)];
      combinations=combinations.flatMap(c=>offsets.map(phase=>({...c,[id]:phase})));
    }
    const original=structuredClone(s);let best=s;
    const assessed:Record<string,unknown>[]=[];
    for(const offsets of combinations){
      if(cancel?.())throw new Error('Offcut search cancelled.');
      if(performance.now()-started>budget)break;
      if(ids.every(id=>Math.abs(offsets[id]-original.bankLayout!.laneOffsetByFace[id])<1e-5))continue;
      const trial=structuredClone(original),targetIds=new Set(trial.demands.filter(d=>ids.includes(d.faceId)).map(d=>d.id));
      trial.demands=trial.demands.filter(d=>!ids.includes(d.faceId));
      trial.placements=trial.placements.filter(p=>!targetIds.has(p.demandId));
      for(const id of ids){
        const face=request.faces.find(f=>f.id===id)!,frame=frameFor(face,request.roof),points=face.polygon.map(p=>sceneToSurface(p,frame));
        const length=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
        trial.bankLayout!.laneOffsetByFace[id]=offsets[id];
        trial.bankLayout!.receiverStockLengthByFace={...trial.bankLayout!.receiverStockLengthByFace,[id]:length};
        const ds=generateFaceDemands(request.roof,{...face,lap:trial.lapByFace[id],laneOffsetMm:offsets[id]},trial.profile,trial.settings,false,0,length,0,trial.bankLayout!.materialBanks?.find(b=>b.faceIds.includes(id))?.id,length);
        trial.demands.push(...ds);trial.placements.push(...ds.map(d=>fresh(d.id)));
      }
      const inventory=rebuildInventory(trial.demands,trial.placements,trial.profile);
      if(inventory.unresolved.length)continue;trial.offcuts=inventory.offcuts;
      trial.receiverSafety=undefined;
      protectFixedReceiverGrids(request,trial,cancel);
      const valid=!validateReceiverSafety(trial).some(i=>i.severity==='error');
      assessed.push({phaseByFace:offsets,valid,purchasedMm2:trial.metrics.newMaterialMm2,newSheets:trial.metrics.newSheetCount});
      if(valid&&trial.metrics.newMaterialMm2<best.metrics.newMaterialMm2-1)best=trial;
    }
    if(best!==s)Object.assign(s,best);
    if(s.decisionTrace)s.decisionTrace.events.push({step:s.decisionTrace.events.length+1,action:'receiver-barge-grid-search',message:'Compared barge-anchored grids using the same purchased source stock and a newly checked coupled phase certificate.',faceIds:ids,data:{parent,assessed,selectedOffsets:Object.fromEntries(ids.map(id=>[id,s.bankLayout!.laneOffsetByFace[id]]))}});
  }
  // Refining a terminal grid must preserve canonical face/lane ordering as well
  // as geometry; imports/alternatives independently regenerate this exact array.
  const order=new Map(request.faces.map((f,i)=>[f.id,i]));
  s.demands.sort((a,b)=>(order.get(a.faceId)??0)-(order.get(b.faceId)??0)||a.laneIndex-b.laneIndex);
  const demandOrder=new Map(s.demands.map((d,i)=>[d.id,i]));
  s.placements.sort((a,b)=>(demandOrder.get(a.demandId)??0)-(demandOrder.get(b.demandId)??0));
}
/** Independently check every reported phase certificate against current physical
 * source pieces, one common interval and the same fixed fresh starter plan. */
export function validateReceiverSafety(s:Solution):Issue[] {
  try{return validateReceiverCertificate(s);}catch{
    return[{severity:'error',code:'RECEIVER_SAFETY',message:'The receiver certificate is malformed. Recalculate from the reviewed roof.'}];
  }
}
function validateReceiverCertificate(s:Solution):Issue[] {
  const issues:Issue[]=[],r=s.receiverSafety;
  if(!r)return (s.engineVersion==='2.13'||s.engineVersion==='2.14'||s.engineVersion==='2.15'||s.engineVersion==='2.16'||s.engineVersion==='2.17'||s.engineVersion==='2.18'||(s.engineVersion==='2.19'||s.engineVersion==='2.20'||s.engineVersion==='2.21'))&&s.settings.stockMode==='bank-first'
    ?[{severity:'error',code:'RECEIVER_SAFETY',message:'This plan is missing its receiver check. Recalculate from the reviewed roof.'}]:issues;
  const error=(message:string,faceId?:string)=>issues.push({severity:'error' as const,code:'RECEIVER_SAFETY',message,faceId});
  if(r.model!==RECEIVER_SAFETY_MODEL||!Array.isArray(r.families)||r.mode!==(s.settings.receiverPhaseMode??'quote-safe')||r.basis!=='fixed-purchased-parents-and-receiver-grid'){error('Unknown valley receiver safety model.');return issues;}
  const dm=new Map(s.demands.map(d=>[d.id,d])),pm=new Map(s.placements.map(p=>[p.demandId,p]));
  for(const family of r.families){
    if(!Array.isArray(family.faceIds)||new Set(family.faceIds).size!==family.faceIds.length||!Array.isArray(family.scenarios)||family.scenarios.length>32||!Number.isFinite(family.phaseHalfWidthMm)){error('Invalid receiver family definition.');continue;}
    const ds=s.demands.filter(d=>family.faceIds.includes(d.faceId)),newIds=new Set(family.freshDemandIds);
    if(newIds.size!==family.freshDemandIds.length||newIds.size!==family.newSheetsAfter||ds.some(d=>(pm.get(d.id)?.kind==='new')!==newIds.has(d.id))){error('Receiver starter stock no longer matches the checked plan.',family.faceIds[0]);continue;}
    const stock=s.offcuts.filter(o=>family.sourceOffcutIds.includes(o.id));
    if(stock.length!==family.sourceOffcutIds.length||stock.some(o=>o.sourceFaceId!==family.sourceFaceId||o.cutKind!=='valley')){error('Valley source inventory changed; recalculate the paired receivers.');continue;}
    const expectedHalf=(s.settings.receiverPhaseMode??'quote-safe')==='quote-safe'?s.profile.coverMm*(s.settings.receiverPhaseCoverFraction??1)/2:0;
    if(Math.abs(family.phaseHalfWidthMm-expectedHalf)>1e-6){error('Receiver phase range was changed.');continue;}
    let end=-expectedHalf;
    for(const scenario of family.scenarios){
      if(!Number.isFinite(scenario.phaseFromMm)||!Number.isFinite(scenario.phaseToMm)||Math.abs(scenario.phaseFromMm-end)>1e-6||scenario.phaseToMm<scenario.phaseFromMm){error('Receiver phase certificate has a gap.');break;}end=scenario.phaseToMm;
      const safe=new Map(phaseProtectedStock(s,family.sourceFaceId,stock,scenario.phaseFromMm,scenario.phaseToMm).map(o=>[o.id,o]));
      const used=new Set<string>(),covered=new Set<string>(),freshRoots=new Set<string>();
      if(!Array.isArray(scenario.fresh)){error('Receiver certificate is missing its fresh-stock assignments.');continue;}
      for(const p of scenario.fresh){
        const root=dm.get(p.rootDemandId),target=dm.get(p.demandId);
        if(!root||!newIds.has(root.id)||freshRoots.has(root.id)||!target||!family.faceIds.includes(target.faceId)||covered.has(target.id)){error('Receiver certificate invents or duplicates a purchased starter sheet.');continue;}
        freshRoots.add(root.id);covered.add(target.id);
        const placed={demandId:target.id,kind:'reuse' as const,rotation:p.rotation,translateY:p.translateY};
        const material:Offcut={id:root.id,sourceDemandId:root.id,sourceFaceId:root.faceId,region:root.blank,widthMm:root.widthMm,lap:root.lap};
        if((p.rotation!==0&&p.rotation!==180)||(p.rotation===180&&!s.profile.allowEndForEnd)||(p.rotation===180?-root.lap:root.lap)!==target.lap||!Number.isFinite(p.translateY)||area(subtract(target.required,materialAtDestination(material,placed)))>Math.max(.001,area(target.required)*1e-9))error('A shared fresh starter is too short or wrongly lapped for this receiver phase.');
      }
      for(const p of scenario.reuse){
        const d=dm.get(p.demandId),o=safe.get(p.offcutId??'');
        if(!d||!family.faceIds.includes(d.faceId)||covered.has(d.id)||p.kind!=='reuse'||!o||used.has(o.id)) {error('Receiver phase certificate duplicates a sheet or lacks source material.');continue;}
        covered.add(d.id);used.add(o.id);
        if((p.rotation!==0&&p.rotation!==180)||(p.rotation===180&&!s.profile.allowEndForEnd)||(p.rotation===180?-o.lap:o.lap)!==d.lap||!Number.isFinite(p.translateY)||area(subtract(d.required,materialAtDestination(o,p)))>Math.max(.001,area(d.required)*1e-9))error('A receiver piece is short or wrongly lapped inside the stated source-phase range.',d.faceId);
      }
      if(ds.some(d=>!covered.has(d.id)))error('Receiver phase certificate leaves required material uncovered.');
      const usedElsewhere=s.placements.filter(p=>p.kind==='reuse'&&!family.faceIds.includes(dm.get(p.demandId)?.faceId??'')).some(p=>used.has(p.offcutId??''));
      if(usedElsewhere)error('A phase-reserved valley piece has also been consumed outside its receiver family.');
    }
    if(!family.scenarios.length||Math.abs(end-expectedHalf)>1e-6)error('Receiver phase certificate does not cover its whole uncertainty band.');
  }
  return issues;
}
