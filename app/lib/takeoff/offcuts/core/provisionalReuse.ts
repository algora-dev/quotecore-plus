/** V2.16: conservative, transactional offcut-destination replay.
 *
 * The accepted sequential plan is ALWAYS retained as an incumbent. Its major
 * bank and self-fill operations own real, fixed purchased stock. Other faces
 * are provisional: a replay releases their allocations AND all descendants,
 * then rebuilds only the chosen dependency branch from actual metal. Separate
 * beam states never share inventories. Reusing an offcut never creates a root.
 *
 * This is deliberately a bounded large-neighbourhood search, not a global
 * optimum, a second face detector, or permission to weaken physical checks.
 */
import type { BankLayout, Demand, Issue, Lap, Offcut, Placement, RoofFace, Solution, SolveRequest, WorkflowQuality } from './types';
import { fingerprint } from './math';
import { area } from './regions';
import { frameFor, sceneToSurface, generateFaceDemands, generateDemands } from './material';
import { bankOffsets } from './materialBanks';
import { ridgeSpacerDemandIds } from './bankLanes';
import { adjacentValleyParents } from './valleyReceivers';
import { planningBoundary } from './directions';
import { rebuildInventory } from './inventory';
import { matchCoherentSets, type CoherentMatch } from './coherentMatching';
import { protectValleyReceivers, recalculateMetrics } from './receiverSafety';
import { planSignature, workflowQuality } from './diagnostics';
import { reuseDepth } from './reuseDepth';

export const PROVISIONAL_REUSE_POLICY = Object.freeze({
  model: 'provisional-cut-replay-v1' as const,
  minimumDisplacedCutAreaM2: 2,
  minimumSavingM2: 1,
  beamWidth: 32,
  optionsPerFace: 20,
  variantsPerRoute: 2,
  finalCandidates: 12,
  maxMatches: 12000,
  maxEvents: 100,
  maximumAdditionalTransfers: 1,
  maximumAdditionalSplitSets: 1,
  maximumAdditionalReuseRuns: 2,
  maximumAdditionalFreshCutRuns: 4,
  maximumAdditionalFillerGroups: 2,
  maximumAdditionalPrimaryOperations: 2,
  maximumAdditionalStockLengthGroups: 8,
  /** Additional bounded work, after the incumbent has finished. */
  defaultMilliseconds: 16000,
  maximumMilliseconds: 20000,
});
export interface ProvisionalReuseReport {
  model: typeof PROVISIONAL_REUSE_POLICY.model;
  status: 'skipped'|'kept-incumbent'|'improved';
  reason: string;
  incumbentLayoutId: string;
  fixedFaceIds: string[];
  displacedReceiverFaceIds: string[];
  candidatesBuilt: number;
  candidatesValidated: number;
  matchEvaluations: number;
  budgetReached: boolean;
  elapsedMs: number;
  purchasedSavingM2: number;
  /** A reduction in remainder, NOT a percentage reduction of the entire job. */
  remainderReductionPercent: number;
  sourceStockUnchanged: boolean;
  events: { action: string; data: Record<string, unknown> }[];
}
export interface ProvisionalHooks {
  now?: () => number;
  shouldCancel?: () => boolean;
  onProgress?: (completed:number,total:number) => void;
}
interface Info {
  face:RoofFace; bankId:string; length:number; phases:number[];
  tier:number;
}
interface Branch {
  demands:Demand[]; placements:Placement[]; layout:BankLayout;
  laps:Record<string,Lap>; cost:number; route:string;
}
interface Offer {
  demands:Demand[]; placements:Placement[]; phase:number; lap:Lap;
  cost:number; newCount:number; route:string;
}
class ReplayDeadline extends Error {}
const fresh = (id:string):Placement => ({demandId:id,kind:'new',rotation:0,translateY:0});
const lengthOf = (f:RoofFace,r:SolveRequest):number => {
  const frame=frameFor(f,r.roof),ys=f.polygon.map(p=>sceneToSurface(p,frame).y);
  return Math.max(...ys)-Math.min(...ys);
};

/** Explicit primary operations are fixed, NOT every face that was eventually
 * bought new by the greedy fallback. Preserve self-fill and manual placements,
 * plus any ancestors on which those locked operations actually depend. */
export function fixedSourceFaces(s:Solution):Set<string> {
  const fixed=new Set([...(s.bankLayout?.primaryOperations??[]).flatMap(o=>o.faceIds),...(s.bankLayout?.selfFillFaceIds??[])]);
  const dm=new Map(s.demands.map(d=>[d.id,d])),om=new Map(s.offcuts.map(o=>[o.id,o]));
  for(const p of s.placements)if(p.manual)fixed.add(dm.get(p.demandId)!.faceId);
  for(let pass=0;pass<s.demands.length;pass++){
    let changed=false;
    for(const p of s.placements){
      const d=dm.get(p.demandId),o=om.get(p.offcutId??'');
      if(d&&o&&fixed.has(d.faceId)&&!fixed.has(o.sourceFaceId)){fixed.add(o.sourceFaceId);changed=true;}
    }
    if(!changed)break;
  }
  return fixed;
}
/** Opportunity detector, not a roof-letter or percentage rule. A source has
 * spent its valley family away while adjacent valley receivers still buy
 * substantial angled stock. That is evidence worth reopening, not proof of a
 * better fit. Healthy plans pay only this small scan and remain byte-for-byte
 * identical in their physical schedule. */
export function displacedValleyReceivers(r:SolveRequest,s:Solution,fixed=fixedSourceFaces(s)):string[] {
  const parents=adjacentValleyParents(r.faces,r.roof),dm=new Map(s.demands.map(d=>[d.id,d]));
  const om=new Map(s.offcuts.map(o=>[o.id,o])),freshIds=new Set(s.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
  return [...parents].filter(([id,parent])=>{
    if(fixed.has(id)||!fixed.has(parent))return false;
    const rows=s.demands.filter(d=>d.faceId===id&&freshIds.has(d.id)&&d.reusableCut&&(d.eaveOverlapMm??0)<1e-7);
    if(rows.reduce((n,d)=>n+area(d.required),0)<PROVISIONAL_REUSE_POLICY.minimumDisplacedCutAreaM2*1e6)return false;
    return s.placements.some(p=>{
      const o=om.get(p.offcutId??''),target=dm.get(p.demandId);
      return o?.sourceFaceId===parent&&o.cutKind==='valley'&&target&&parents.get(target.faceId)!==parent;
    });
  }).map(([id])=>id);
}
/** Cost and workflow guard in addition to physical validity. A default plan
 * must not become an expensive or fragmented alternate in disguise. */
export function acceptsReplay(incumbent:Solution,proposed:Solution):{accepted:boolean;reason:string;before:WorkflowQuality;after:WorkflowQuality} {
  const before=workflowQuality(incumbent),after=workflowQuality(proposed);
  const scale=incumbent.profile.coverMm/(incumbent.profile.coverMm+incumbent.profile.leftLapMm+incumbent.profile.rightLapMm);
  const saved=(incumbent.metrics.newMaterialMm2-proposed.metrics.newMaterialMm2)*scale/1e6;
  const reject=(reason:string)=>({accepted:false,reason,before,after});
  if(saved<PROVISIONAL_REUSE_POLICY.minimumSavingM2-1e-8)return reject('no-meaningful-purchase-reduction');
  if(after.score>before.score)return reject('workflow-score-increased');
  if(after.sourceRelationships>before.sourceRelationships+PROVISIONAL_REUSE_POLICY.maximumAdditionalTransfers||
    after.splitSets>before.splitSets+PROVISIONAL_REUSE_POLICY.maximumAdditionalSplitSets||
    after.reuseRuns>before.reuseRuns+PROVISIONAL_REUSE_POLICY.maximumAdditionalReuseRuns||
    after.freshCutRuns>before.freshCutRuns+PROVISIONAL_REUSE_POLICY.maximumAdditionalFreshCutRuns||
    after.fillerSeparators>before.fillerSeparators+PROVISIONAL_REUSE_POLICY.maximumAdditionalFillerGroups||
    after.primaryOperations>before.primaryOperations+PROVISIONAL_REUSE_POLICY.maximumAdditionalPrimaryOperations||
    after.stockLengthGroups>before.stockLengthGroups+PROVISIONAL_REUSE_POLICY.maximumAdditionalStockLengthGroups)return reject('workflow-fragmentation');
  const depth=(s:Solution)=>Math.max(0,...reuseDepth(s).values());
  if(depth(proposed)>Math.max(2,depth(incumbent)))return reject('reuse-depth-increased');
  return{accepted:true,reason:'less-purchased-material-with-no-harder-grouped-workflow',before,after};
}

export function replayProvisionalDestinations(r:SolveRequest,incumbent:Solution,
  validate:(s:Solution)=>Issue[],hooks:ProvisionalHooks={}):{solution:Solution;report:ProvisionalReuseReport} {
  const clock=hooks.now??(()=>performance.now()),started=clock();
  const report:ProvisionalReuseReport={model:PROVISIONAL_REUSE_POLICY.model,status:'skipped',reason:'no-displaced-valley-receiver',
    incumbentLayoutId:incumbent.layoutId??planSignature(incumbent),fixedFaceIds:[],displacedReceiverFaceIds:[],
    candidatesBuilt:0,candidatesValidated:0,matchEvaluations:0,budgetReached:false,elapsedMs:0,purchasedSavingM2:0,
    remainderReductionPercent:0,sourceStockUnchanged:true,events:[]};
  const event=(action:string,data:Record<string,unknown>)=>{if(report.events.length<PROVISIONAL_REUSE_POLICY.maxEvents)report.events.push({action,data});};
  const finish=(solution=incumbent)=>{report.elapsedMs=Math.max(0,clock()-started);return{solution,report};};
  if(r.settings.provisionalReuse===false){report.reason='disabled';return finish();}
  if(!incumbent.bankLayout||incumbent.status==='invalid'||r.settings.stockMode!=='bank-first'){report.reason='no-valid-bank-incumbent';return finish();}
  if(incumbent.sourceRevision!==r.roof.sourceRevision||incumbent.facesRevision!==fingerprint({faces:r.faces,profile:r.profile,settings:r.settings})){report.reason='stale-incumbent';return finish();}
  if(!incumbent.bankLayout.materialBanks?.length||r.faces.some(f=>!incumbent.bankLayout!.materialBanks!.some(b=>b.faceIds.includes(f.id)))){report.reason='incomplete-bank-metadata';return finish();}
  if(validate(incumbent).some(i=>i.severity==='error')){report.reason='invalid-incumbent';return finish();}
  const fixed=fixedSourceFaces(incumbent);report.fixedFaceIds=[...fixed];
  const displaced=displacedValleyReceivers(r,incumbent,fixed);report.displacedReceiverFaceIds=displaced;
  if(!fixed.size||!displaced.length)return finish();
  report.status='kept-incumbent';report.reason='no-validated-improvement';
  const budget=Math.min(PROVISIONAL_REUSE_POLICY.maximumMilliseconds,r.settings.provisionalMaxMilliseconds??PROVISIONAL_REUSE_POLICY.defaultMilliseconds);
  const check=()=>{
    if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');
    if(clock()-started>budget)throw new ReplayDeadline('replay-time-budget');
  };
  const {roof,profile,settings}=r,parents=adjacentValleyParents(r.faces,roof);
  const infos:Info[]=r.faces.filter(f=>!fixed.has(f.id)).map(face=>{
    const bank=incumbent.bankLayout!.materialBanks!.find(b=>b.faceIds.includes(face.id))!;
    const edges=planningBoundary(face),hasHip=edges.some(e=>e.kind==='hip'||e.kind==='broken_hip'),hasValley=edges.some(e=>e.kind==='valley');
    return{face,bankId:bank.id,length:lengthOf(face,r),phases:bankOffsets(face,bank,r),
      tier:parents.has(face.id)?0:hasHip&&hasValley?1:hasValley?2:3};
  });
  const lockedDemands=incumbent.demands.filter(d=>fixed.has(d.faceId));
  const lockedIds=new Set(lockedDemands.map(d=>d.id));
  const lockedPlacements=incumbent.placements.filter(p=>lockedIds.has(p.demandId));
  const lockedFingerprint=fingerprint([lockedDemands,lockedPlacements,incumbent.bankLayout.primaryOperations]);
  const baseLayout=structuredClone(incumbent.bankLayout);
  baseLayout.primaryFaceIds=baseLayout.primaryFaceIds.filter(id=>fixed.has(id));
  baseLayout.primarySequence=baseLayout.primarySequence?.filter(id=>fixed.has(id));
  baseLayout.receiverStockLengthByFace=Object.fromEntries(Object.entries(baseLayout.receiverStockLengthByFace??{}).filter(([id])=>fixed.has(id)));
  for(const i of infos){baseLayout.extraLengthByFace[i.face.id]=0;baseLayout.tailExtensionByFace={...baseLayout.tailExtensionByFace,[i.face.id]:0};baseLayout.cutLengthByFace![i.face.id]=i.length;}
  const source:Branch={demands:lockedDemands,placements:lockedPlacements,layout:baseLayout,laps:{...incumbent.lapByFace},
    cost:lockedDemands.filter(d=>lockedPlacements.some(p=>p.demandId===d.id&&p.kind==='new')).reduce((n,d)=>n+area(d.blank),0),route:''};
  event('release-provisional-closure',{fixedFaceIds:[...fixed],releasedFaceIds:infos.map(i=>i.face.id),
    releasedPositions:incumbent.demands.length-lockedDemands.length,
    rule:'discard-all-dependent-recuts-before-replaying; fixed-source-stock-not-repurchased',
    mainOperationCount:baseLayout.primaryOperations?.length??0,
    note:'Two productive banks are a useful starting pattern, not a required bank count.'});
  const dc=new Map<string,Demand[]>(),mc=new Map<string,CoherentMatch>();
  function offers(state:Branch,info:Info,bias:'lower'|'centre'|'upper'):Offer[]{
    check();const rebuilt=rebuildInventory(state.demands,state.placements,profile);
    if(rebuilt.unresolved.length)throw new Error('Provisional branch has an unresolved cut ancestor.');
    const used=new Set(state.placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId!));
    const stock=rebuilt.offcuts.filter(o=>!used.has(o.id));
    const pools=new Map<string,Offcut[]>(),local=parents.get(info.face.id);
    for(const o of stock){
      if(local&&(o.sourceFaceId!==local||o.cutKind!=='valley'))continue;
      // A single arm stays a candidate even when combining both arms would
      // cover this one receiver better. The other arm may serve another face.
      for(const key of [o.sourceFaceId+'|'+o.cutKind,o.sourceFaceId+'|'+o.cutSetId]){
        const pool=pools.get(key)??[];pool.push(o);pools.set(key,pool);
      }
    }
    const options:Offer[]=[],seen=new Set<string>();
    const lapChoices:Lap[]=settings.optimiseLapDirections&&!info.face.lapLocked?[1,-1]:[info.face.lap];
    for(const phase of info.phases)for(const lap of lapChoices){
      const dk=`${info.face.id}/${phase}/${lap}`;let demands=dc.get(dk);
      if(!demands){demands=generateFaceDemands(roof,{...info.face,lap,laneOffsetMm:phase},profile,settings,false,0,info.length,0,info.bankId);dc.set(dk,demands);}
      const fillers=local?new Set(demands.filter(d=>(d.eaveOverlapMm??0)>1e-7).map(d=>d.id)):ridgeSpacerDemandIds(info.face,roof,demands,info.length);
      const targets=demands.filter(d=>!fillers.has(d.id)),poolKeys=new Set<string>();
      for(const pool of pools.values()){
        check();const pk=pool.map(o=>o.id).sort().join('|');if(poolKeys.has(pk))continue;poolKeys.add(pk);
        const mk=dk+'/'+bias+'/'+JSON.stringify(pool.map(o=>[o.id,o.lap,o.region,o.sourceLaneIndex,o.cutSetId,o.cutArm]));
        let match=mc.get(mk);
        if(!match){
          if(report.matchEvaluations>=PROVISIONAL_REUSE_POLICY.maxMatches)throw new ReplayDeadline('replay-match-budget');
          report.matchEvaluations++;match=matchCoherentSets(targets,pool,profile,check,false,3,bias);mc.set(mk,match);
        }
        if(!match.used.size)continue;
        const fits=new Map(match.placements.map(p=>[p.demandId,p]));
        const placements=demands.map(d=>fits.get(d.id)??fresh(d.id));
        const key=JSON.stringify(placements);if(seen.has(key))continue;seen.add(key);
        const newIds=new Set(placements.filter(p=>p.kind==='new').map(p=>p.demandId));
        const route=[...new Set(pool.filter(o=>match!.used.has(o.id)).map(o=>o.cutSetId??o.sourceFaceId))].sort().join(',');
        options.push({demands,placements,phase,lap,cost:demands.filter(d=>newIds.has(d.id)).reduce((n,d)=>n+area(d.blank),0),newCount:newIds.size,route});
      }
      // New fallback is always a valid option. It is not committed inventory
      // until this branch is selected. No implicit free offcut from this option.
      if(phase===0||info.face.laneOffsetLocked)options.push({demands,placements:demands.map(d=>fresh(d.id)),phase,lap,
        cost:demands.reduce((n,d)=>n+area(d.blank),0),newCount:demands.length,route:'fresh'});
    }
    const counts=new Map<string,number>();
    return options.sort((a,b)=>a.cost-b.cost||a.newCount-b.newCount||a.route.localeCompare(b.route)).filter(o=>{
      const key=o.route+'/'+o.lap,n=counts.get(key)??0;counts.set(key,n+1);return n<PROVISIONAL_REUSE_POLICY.variantsPerRoute;
    }).slice(0,PROVISIONAL_REUSE_POLICY.optionsPerFace);
  }
  const completed:Branch[]=[],finalSeen=new Set<string>();
  let best:Solution|undefined;
  try{
    // Several complete branch replays are allowed to disagree about early
    // destinations. No reservation leaks from one replay into the next.
    const modes:[boolean,'lower'|'centre'|'upper'][]=[[false,'lower'],[true,'lower']];
    for(const [reverse,bias] of modes){
      let beam:Branch[]=[source];
      const order=[...infos].sort((a,b)=>a.tier-b.tier||(reverse?a.length-b.length:b.length-a.length)||a.face.id.localeCompare(b.face.id));
      for(const info of order){
        check();const next:Branch[]=[];
        for(const state of beam)for(const o of offers(state,info,bias)){
          const layout={...state.layout,laneOffsetByFace:{...state.layout.laneOffsetByFace,[info.face.id]:o.phase}};
          next.push({demands:[...state.demands,...o.demands],placements:[...state.placements,...o.placements],layout,
            laps:{...state.laps,[info.face.id]:o.lap},cost:state.cost+o.cost,route:state.route+'|'+info.face.id+'<'+o.route});
        }
        const seen=new Set<string>(),routes=new Map<string,number>();
        beam=next.sort((a,b)=>a.cost-b.cost||a.route.localeCompare(b.route)).filter(s=>{
          const key=JSON.stringify(s.placements);if(seen.has(key))return false;seen.add(key);
          const n=routes.get(s.route)??0;routes.set(s.route,n+1);return n<PROVISIONAL_REUSE_POLICY.variantsPerRoute;
        }).slice(0,PROVISIONAL_REUSE_POLICY.beamWidth);
        if(!beam.length)break;
      }
      completed.push(...beam.filter(b=>r.faces.every(f=>b.demands.some(d=>d.faceId===f.id))));
      report.candidatesBuilt=completed.length;
      event('provisional-replay',{bias,reverse,completeBranches:beam.length,faceOrder:order.map(i=>i.face.id),
        bestProvisionalPurchaseM2:beam[0]?.cost/1e6,notYetReceiverCertified:true});
      // Finalise after EACH replay; a later timeout cannot lose an already
      // independently validated improvement.
      const seen=new Set<string>(),shortlist=completed.slice().sort((a,b)=>a.cost-b.cost).filter(b=>{
        const key=JSON.stringify(b.placements);if(seen.has(key))return false;seen.add(key);return true;
      }).slice(0,PROVISIONAL_REUSE_POLICY.finalCandidates);
      for(const branch of shortlist){
        check();const finalKey=JSON.stringify([branch.placements,branch.layout.laneOffsetByFace]);
        if(finalSeen.has(finalKey))continue;finalSeen.add(finalKey);
        const candidate=structuredClone(incumbent);
        candidate.demands=structuredClone(branch.demands);candidate.placements=structuredClone(branch.placements);
        candidate.bankLayout=structuredClone(branch.layout);candidate.lapByFace={...branch.laps};
        candidate.offcuts=rebuildInventory(candidate.demands,candidate.placements,profile).offcuts;
        candidate.receiverSafety=undefined;candidate.decisionTrace=undefined;
        candidate.issues=incumbent.issues.filter(i=>!['RECEIVER_SET_OUT','EXTRA_CUT_STOCK','SEARCH_BUDGET'].includes(i.code)||i.faceId&&fixed.has(i.faceId));
        recalculateMetrics(candidate);
        protectValleyReceivers(r,candidate,()=>{check();return false;});
        report.candidatesValidated++;
        // Approved face/grid generation must agree with every returned demand.
        const regenerated=generateDemands(roof,r.faces,profile,settings,candidate.bankLayout).map(d=>({...d,lap:candidate.lapByFace[d.faceId]}));
        const sorted=(ds:Demand[])=>ds.slice().sort((a,b)=>a.id.localeCompare(b.id));
        const expected=fingerprint(sorted(regenerated)),actual=fingerprint(sorted(candidate.demands));
        const fixedUnchanged=fingerprint([candidate.demands.filter(d=>fixed.has(d.faceId)),candidate.placements.filter(p=>lockedIds.has(p.demandId)),candidate.bankLayout?.primaryOperations])===lockedFingerprint;
        const issues=expected===actual&&fixedUnchanged?validate(candidate):[{severity:'error' as const,code:fixedUnchanged?'REPLAY_DEMAND_MISMATCH':'REPLAY_CHANGED_SOURCE',message:'Replay changed reviewed demands or locked source stock.'}];
        const errors=issues.filter(i=>i.severity==='error');const assessment=acceptsReplay(incumbent,candidate);
        event('validate-provisional-plan',{purchasedM2:candidate.metrics.newMaterialMm2/1e6,newSheets:candidate.metrics.newSheetCount,
          accepted:!errors.length&&assessment.accepted,reason:errors.length?errors[0].code:assessment.reason,
          workflowBefore:assessment.before.score,workflowAfter:assessment.after.score,fixedSourceStockUnchanged:fixedUnchanged});
        if(errors.length||!assessment.accepted)continue;
        if(!best||candidate.metrics.newMaterialMm2<best.metrics.newMaterialMm2-1||
          Math.abs(candidate.metrics.newMaterialMm2-best.metrics.newMaterialMm2)<=1&&assessment.after.score<workflowQuality(best).score)best=candidate;
        hooks.onProgress?.(report.candidatesValidated,PROVISIONAL_REUSE_POLICY.finalCandidates*modes.length);
      }
    }
  }catch(error){
    if(error instanceof ReplayDeadline){report.budgetReached=true;event('replay-budget',{reason:error.message,incumbentPreserved:true});}
    else if(hooks.shouldCancel?.()||error instanceof Error&&error.message==='Offcut search cancelled.')throw error;
    else {event('replay-failed-safely',{reason:error instanceof Error?error.message:'Unknown replay error'});report.reason='replay-error-incumbent-preserved';}
  }
  if(!best)return finish();
  // Atomically commit ONE complete dependency tree; all losing placeholders die.
  // Restore canonical ordering for persistence and freshness checks.
  const faceOrder=new Map(r.faces.map((f,i)=>[f.id,i]));
  best.demands.sort((a,b)=>faceOrder.get(a.faceId)!-faceOrder.get(b.faceId)!||a.laneIndex-b.laneIndex);
  best.placements.sort((a,b)=>a.demandId.localeCompare(b.demandId));
  best.engineVersion='2.20';
  best.layoutId=planSignature(best);best.layoutLabel='Recommended';best.objective='recommended';
  const scale=profile.coverMm/(profile.coverMm+profile.leftLapMm+profile.rightLapMm);
  const saved=incumbent.metrics.newMaterialMm2-best.metrics.newMaterialMm2;
  report.status='improved';report.reason='validated-destination-replay';report.purchasedSavingM2=saved*scale/1e6;
  report.remainderReductionPercent=incumbent.metrics.wasteMm2>0?saved/incumbent.metrics.wasteMm2*100:0;
  const om=new Map(best.offcuts.map(o=>[o.id,o]));
  event('commit-winning-dependency-tree',{layoutId:best.layoutId,savedCoverM2:report.purchasedSavingM2,
    beforeWorkflow:workflowQuality(incumbent),afterWorkflow:workflowQuality(best),
    routing:r.faces.map(f=>({faceId:f.id,newSheets:best!.placements.filter(p=>p.kind==='new'&&best!.demands.find(d=>d.id===p.demandId)?.faceId===f.id).length,
      sources:[...new Set(best!.placements.filter(p=>p.kind==='reuse'&&best!.demands.find(d=>d.id===p.demandId)?.faceId===f.id).map(p=>om.get(p.offcutId!)?.sourceFaceId))]}))});
  best.search={...incumbent.search};
  best.decisionTrace=structuredClone(incumbent.decisionTrace);
  if(best.decisionTrace)best.decisionTrace.engineVersion='2.20';
  return finish(best);
}
