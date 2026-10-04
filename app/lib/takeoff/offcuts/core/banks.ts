import { coverStations, ridgeSpacerDemandIds, bankLaneAudit } from './bankLanes';
import { findFit } from './fit';
import { describeCutStrategy, chooseCutCommitments, type CutStrategy } from './cutStrategy';
import { adjacentValleyParents } from './valleyReceivers';
import { auditFaceBehaviour, FACE_GEOMETRY_MODEL } from './faceGeometry';
import { planningBoundary } from './directions';
import type { BankLayout, Demand, Issue, Lap, MaterialBank, Offcut, Placement, RoofFace, Solution, SolveRequest } from './types';
import type { SearchHooks } from './solver';
import { fingerprint, dot } from './math';
import { area } from './regions';
import { frameFor, sceneToSurface, generateDemands, generateFaceDemands, isStraightFiller, offcutsFrom, validateInputs } from './material';
import { buildMaterialBanks, bankOffsets } from './materialBanks';
import { matchCoherentSets, type CoherentMatch } from './coherentMatching';
import { rebuildInventory } from './inventory';
import { isSelfFillCandidate, selfFillDonorWindows, bankAnchorFaces } from './zones';
import { DecisionRecorder, planSignature, planQuality } from './diagnostics';
import { supplyView } from './supply';
import { simplerAssessment, SIMPLER_POLICY } from './simplerPolicy';
import { lessMaterialAssessment, rankMaterialCandidates, LESS_MATERIAL_POLICY } from './lessMaterialPolicy';

interface Info { face:RoofFace; bank:MaterialBank; offsets:number[]; net:number; length:number; ridgeLength:number; selfComplement:boolean }
interface State {
  demands:Demand[]; placements:Placement[]; inventory:Offcut[]; used:Set<string>;
  done:Set<string>; layout:BankLayout; laps:Record<string,Lap>;
  commitments:Offer[]; committedFaces:Set<string>;
  record:DecisionRecorder; trial:number; completed:boolean; seedFaceId:string;
}
interface Offer { info:Info; ds:Demand[]; phase:number; lap:Lap; primary:boolean; match:CoherentMatch; score:number; strategy:CutStrategy }
class Deadline extends Error {}

/** V2.6 longest-useful-bank search with eave-anchored self-fill. Physical faces are never collapsed.
 *
 * 1. Pick a long bank and supply one main cutting operation.
 * 2. Offer WHOLE ordered hip/valley sets to complementary faces, preferring
 *    complete angled coverage and useful sets, not arbitrary scraps.
 * 3. Prefer one source block; a second coherent set may fill fresh gaps.
 *    Actual recuts can feed the
 *    next face (C -> G -> H/I), with an auditable acyclic material tree.
 * 4. Remaining faces start another bank; unused sets may feed their own face.
 *
 * Different bank starts / registrations yield distinct, fully validated
 * alternatives. Timeouts complete all remaining demand with new stock; they
 * never return a half-covered roof or claim a proven optimum. */
export function optimiseBankLayouts(request:SolveRequest,hooks:SearchHooks={}):Solution[] {
  const clock=hooks.now??(()=>performance.now()), started=clock();
  const issues=validateInputs(request.roof,request.faces,request.profile,request.settings);
  if(issues.some(i=>i.severity==='error'))throw new Error(issues.filter(i=>i.severity==='error').map(i=>i.message).join('\n'));
  const {roof,faces,profile,settings}=request;
  const policy=hooks.planSearch, objective=policy?.objective??'recommended', attempt=policy?.attempt??0;
  const simpleMode=objective==='simpler';
  const banks=buildMaterialBanks(request);
  const valleyParents=adjacentValleyParents(faces,roof);
  const baseLayout:BankLayout={primaryFaceIds:[],laneOffsetByFace:Object.fromEntries(faces.map(f=>[f.id,f.laneOffsetMm])),
    extraLengthByFace:Object.fromEntries(faces.map(f=>[f.id,0])),tailExtensionByFace:Object.fromEntries(faces.map(f=>[f.id,0])),
    cutLengthByFace:Object.fromEntries(faces.map(f=>[f.id,Math.min(profile.maxLengthMm,banks.find(b=>b.faceIds.includes(f.id))!.cutLengthMm)])),
    materialBanks:banks,primarySequence:[],selfFillFaceIds:[],primaryOperations:[]};
  const base=generateDemands(roof,faces,profile,settings,baseLayout);
  const infos:Info[]=faces.map(face=>{
    const ds=base.filter(d=>d.faceId===face.id), bank=banks.find(b=>b.faceIds.includes(face.id))!;
    const frame=frameFor(face,roof), points=face.polygon.map(p=>sceneToSurface(p,frame));
    const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    const ridges=planningBoundary(face).filter(e=>e.kind==='ridge');
    // The longest run TO A RIDGE is the purchasing anchor. A long hip point
    // on an end face must not outrank a main face's actual long ridge bank.
    const ridgeLength=ridges.length?Math.max(...ridges.map(e=>maxY-(sceneToSurface(e.a,frame).y+sceneToSurface(e.b,frame).y)/2)):0;

    return{face,bank,offsets:bankOffsets(face,bank,request),net:ds.reduce((n,d)=>n+area(d.cover),0),
      length:maxY-minY,ridgeLength,selfComplement:isSelfFillCandidate(face,roof)};
  });
  const sorted=[...infos].sort((a,b)=>Math.round(b.ridgeLength)-Math.round(a.ridgeLength)||Math.round(b.length)-Math.round(a.length)||b.net-a.net||a.face.id.localeCompare(b.face.id));

  const longestRidge=Math.max(...infos.map(i=>i.ridgeLength));
  const mainBanks=new Set(infos.filter(i=>i.ridgeLength>=longestRidge*.97&&!i.selfComplement).map(i=>i.bank.id));
  // Protect the whole longest elevation operation, including apex-only faces
  // with no ridge of their own. A face such as A must not be stolen while its
  // registered J continuation is waiting to start.
  const mainMembers=new Set(banks.filter(b=>mainBanks.has(b.id)).flatMap(b=>bankAnchorFaces(faces.filter(f=>b.faceIds.includes(f.id)),roof).map(f=>f.id)));
  const check=()=>{if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');if(clock()-started>settings.maxMilliseconds)throw new Deadline();};
  const defaultLaps=Object.fromEntries(faces.map(f=>[f.id,f.lap])) as Record<string,Lap>;
  const newRecorder=():DecisionRecorder=>{const record=new DecisionRecorder();record.add('approved-geometry-model','Cut boundaries derived from polygons and water arrows; input component names are not constraints.',faces.map(f=>f.id),{model:FACE_GEOMETRY_MODEL,faces:auditFaceBehaviour(faces)});return record;};
  const blankState=():State=>({demands:[],placements:[],inventory:[],used:new Set(),done:new Set(),layout:structuredClone(baseLayout),laps:{...defaultLaps},
    commitments:[],committedFaces:new Set(),record:newRecorder(),trial:0,completed:false,seedFaceId:''});
  const cache=new Map<string,Demand[]>();
  const matchCache=new Map<string,CoherentMatch>();
  function matchSets(ds:Demand[],stock:Offcut[],preserve=false):CoherentMatch {
    check();
    const key=fingerprint([ds.map(d=>[d.id,d.lap,d.origin,d.required,d.blank]),stock.map(o=>[o.id,o.lap,o.region,o.sourceCrossMm,o.cutSetId]),preserve]);
    const cached=matchCache.get(key);if(cached)return cached;
    const match=matchCoherentSets(ds,stock,profile,check,preserve,simpleMode?2:4);
    if(matchCache.size<12000)matchCache.set(key,match);
    return match;
  }
  // Total extra stock is capped by the user's existing extension setting.
  // Split it between ends; only an actual angled lower cut uses the tail.
  // Valley -> matching hip needs downstream clearance, not an upstream-only
  // extension which cannot possibly enlarge that valley offcut.
  const totalExtra=Math.min(settings.maxBankExtensionMm??100,Math.max(0,profile.cutGapMm*2+profile.lengthIncrementMm*2));
  const headExtra=Math.min(totalExtra,Math.ceil(totalExtra/2/profile.lengthIncrementMm)*profile.lengthIncrementMm);
  const tailExtra=Math.max(0,totalExtra-headExtra);
  function dsFor(info:Info,phase:number,lap:Lap,primary:boolean,extend:boolean,shared=false,allowance?:{head:number;tail:number}):Demand[]{
    const key=`${info.face.id}/${phase}/${primary}/${extend}/${shared}/${allowance?.head}/${allowance?.tail}`;
    let ds=cache.get(key);
    if(!ds){ds=generateFaceDemands(roof,{...info.face,laneOffsetMm:phase},profile,settings,primary,
      primary&&extend?(allowance?.head??(info.selfComplement?(settings.maxBankExtensionMm??100):headExtra)):0,shared?baseLayout.cutLengthByFace![info.face.id]:info.length,primary&&extend?(allowance?.tail??(info.selfComplement?0:tailExtra)):0,info.bank.id);cache.set(key,ds);}
    return ds.map(d=>({...d,lap}));
  }
  function setLayout(state:State,info:Info,phase:number,lap:Lap,primary:boolean,extend:boolean,shared=false,allowance?:{head:number;tail:number}):void {
    const id=info.face.id;state.layout.cutLengthByFace![id]=shared?baseLayout.cutLengthByFace![id]:info.length;state.layout.laneOffsetByFace[id]=phase;state.laps[id]=lap;
    if(primary&&!state.layout.primaryFaceIds.includes(id))state.layout.primaryFaceIds.push(id);
    state.layout.extraLengthByFace[id]=primary&&extend?(allowance?.head??(info.selfComplement?(settings.maxBankExtensionMm??100):headExtra)):0;
    state.layout.tailExtensionByFace![id]=primary&&extend?(allowance?.tail??(info.selfComplement?0:tailExtra)):0;
  }
  function commit(state:State,info:Info,ds:Demand[],placements:Placement[],phase:number,lap:Lap,primary:boolean,extend:boolean,shared=false,allowance?:{head:number;tail:number}):void {
    const previousInventory=new Set(state.inventory.map(o=>o.id));
    state.demands.push(...ds);state.placements.push(...placements);state.done.add(info.face.id);
    setLayout(state,info,phase,lap,primary,extend,shared,allowance);
    const rebuilt=rebuildInventory(state.demands,state.placements,profile);
    if(rebuilt.unresolved.length)throw new Error('Internal cut-set dependency conflict.');
    state.inventory=rebuilt.offcuts;
    state.used=new Set(state.placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId!));
    if(state.demands.length>settings.maxSheets)throw new Error(`Sheet limit exceeded (${settings.maxSheets}).`);
    const created=state.inventory.filter(o=>!previousInventory.has(o.id));
    state.record.add('commit-face', `Allocated ${info.face.name}; generated cuts from the actual supplied material.`, [info.face.id], {
      valleyReceivingParent:valleyParents.get(info.face.id)??null,bargeFillerDemandIds:[...receivingFillers(info,ds)],
      newSheets:placements.filter(p=>p.kind==='new').length,reusedPositions:placements.filter(p=>p.kind==='reuse').length,
      phaseMm:phase,lap,primary,orderedLengthMm:state.layout.cutLengthByFace?.[info.face.id],
      incoming:placements.filter(p=>p.kind==='reuse').map(p=>({demandId:p.demandId,offcutId:p.offcutId,rotation:p.rotation})),
      generatedSets:[...new Set(created.map(o=>o.cutSetId))].map(id=>({id,kind:created.find(o=>o.cutSetId===id)?.cutKind,
        pieces:created.filter(o=>o.cutSetId===id).length,areaMm2:created.filter(o=>o.cutSetId===id).reduce((n,o)=>n+area(o.region),0)}))
    });
  }
  function completeNew(state:State):void {
    for(const info of infos)if(!state.done.has(info.face.id)){
      const ds=dsFor(info,info.face.laneOffsetMm,info.face.lap,false,false);
      commit(state,info,ds,ds.map(d=>({demandId:d.id,kind:'new',rotation:0,translateY:0})),info.face.laneOffsetMm,info.face.lap,false,false);
    }
  }
  const fallback=blankState();completeNew(fallback);
  const candidates:State[]=[];
  let completed=0,budgetReached=false;
  // Try different longest direction families first; a small triangular face
  // must not win the first-bank decision simply because it has an early ID.
  const leaders:Info[]=[];
  for(const info of sorted)if(!leaders.some(i=>i.bank.id===info.bank.id))leaders.push(info);
  const recommendedSeeds=leaders.filter(i=>mainBanks.has(i.bank.id));
  const seedBase=objective==='less-material'?[...leaders,...sorted.filter(i=>!leaders.includes(i)).slice(0,2)]:recommendedSeeds;
  const seeds=seedBase.length?seedBase:leaders;
  const start=attempt%Math.max(1,seeds.length);
  const trialCount=Math.min(settings.maxTrials,Math.max(1,seeds.length)*(objective==='recommended'?6:6));
  let totalProgress=trialCount;
  const trials=Array.from({length:trialCount},(_,i)=>({seed:seeds[(i+start)%seeds.length],
    shift:Math.floor(i/seeds.length)+Math.floor(attempt/Math.max(1,seeds.length)),extend:true}));
  const reservedSelf=new Set(infos.filter(i=>i.selfComplement).map(i=>i.face.id));

  function receivingFillers(info:Info,ds:Demand[]):Set<string> {
    if(!valleyParents.has(info.face.id))return info.selfComplement?new Set():ridgeSpacerDemandIds(info.face,roof,ds,info.length);
    // Fresh barge-base rectangles are distinct from the valley transition.
    // A crossing lane may use a long enough real offcut; do not impose the
    // self-fill DONOR margin here and accidentally buy an extra receiver sheet.
    return new Set(ds.filter(d=>(d.eaveOverlapMm??0)>1e-7).map(d=>d.id));
  }
  function matchReceiver(info:Info,ds:Demand[],stock:Offcut[],preserve:boolean):CoherentMatch {
    const fillers=receivingFillers(info,ds);
    if(!fillers.size)return matchSets(ds,stock,preserve);
    const match=matchSets(ds.filter(d=>!fillers.has(d.id)),stock,preserve);
    const placements=new Map(match.placements.map(p=>[p.demandId,p]));
    return {...match,freshArea:match.freshArea+ds.filter(d=>fillers.has(d.id)).reduce((n,d)=>n+area(d.blank),0),
      placements:ds.map((d):Placement=>placements.get(d.id)??{demandId:d.id,kind:'new',rotation:0,translateY:0})};
  }
  function bestOffer(state:State,shift:number,extend:boolean):Offer|undefined {
    while(state.commitments.length){
      const reserved=state.commitments.shift()!;
      if(!state.done.has(reserved.info.face.id)&&[...reserved.match.used].every(id=>!state.used.has(id)&&state.inventory.some(o=>o.id===id))){
        state.committedFaces.add(reserved.info.face.id);
        state.record.add('honour-cut-set-commitment','Use the reserved whole-set destination before distributing residual pieces.',[reserved.info.face.id],{strategy:reserved.strategy,offcutIds:[...reserved.match.used]});
        return reserved;
      }
      state.record.add('release-invalid-reservation','A changed inventory invalidated this reservation; it will be evaluated again.',[reserved.info.face.id]);
    }
    const unused=state.inventory.filter(o=>!state.used.has(o.id));
    const rejected:Record<string,Record<string,number>>={};
    const reject=(id:string,reason:string)=>{const entry=rejected[id]??{};entry[reason]=(entry[reason]??0)+1;rejected[id]=entry;};
    const supply=supplyView({...state,offcuts:state.inventory,bankLayout:state.layout});
    const blockOf=(o:Offcut)=>supply.blockByRootDemand.get(o.rootDemandId??o.sourceDemandId)??o.sourceFaceId;
    const rootIds=[...new Set(unused.map(blockOf))];
    const offers=new Map<string,Offer>();
    for(const root of rootIds){
      const stock=unused.filter(o=>blockOf(o)===root),rootFamily=stock[0]?.rootBankId;
      // Different cutting sites are not mixed just because their roots happen
      // to match. A+J may share a supply bank; C and its downstream recut G are
      // separate cutting operations, so G's valley set stays together.
      const sites=new Map<string,Offcut[]>();
      for(const o of stock){
        const siteBank=infos.find(i=>i.face.id===o.sourceFaceId)?.bank.id;
        const key=siteBank===rootFamily?root:o.sourceFaceId;
        const list=sites.get(key)??[];list.push(o);sites.set(key,list);
      }
      const pools:Offcut[][]=[];
      for(const site of sites.values()){
        const valley=site.filter(o=>o.cutKind==='valley'), hips=site.filter(o=>o.cutKind!=='valley');
        if(valley.length)pools.push(valley);if(hips.length)pools.push(hips);
        if(valley.length&&hips.length)pools.push(site);
      }
      for(const info of infos)if(!state.done.has(info.face.id)){
        const localParent=valleyParents.get(info.face.id);
        if(localParent&&!state.done.has(localParent)){reject(info.face.id,'waiting-for-adjacent-valley-cuts');continue;}
        const anchor=infos.find(i=>i.face.id===state.layout.primarySequence?.[0]);
        const keepMain=objective!=='less-material'||!anchor||mainBanks.has(anchor.bank.id);
        if(keepMain&&mainMembers.has(info.face.id)){reject(info.face.id,'reserved-longest-bank');continue;}
        if(reservedSelf.has(info.face.id)){reject(info.face.id,'reserved-self-fill-trial');continue;}
        const primary=mainMembers.has(info.face.id)&&info.bank.id===rootFamily;
        const offsets=[...info.offsets];if(shift&&offsets.length>1)offsets.push(offsets.shift()!);
        const lapChoices:Lap[]=settings.optimiseLapDirections&&!info.face.lapLocked?[info.face.lap,info.face.lap===1?-1:1]:[info.face.lap];
        for(const phase of offsets)for(const lap of lapChoices){
          check();const ds=dsFor(info,phase,lap,primary,extend,primary);
          for(const pool of pools){
            if(localParent&&!pool.every(o=>o.sourceFaceId===localParent&&o.cutKind==='valley')){reject(info.face.id,'reserved-adjacent-valley-set');continue;}
            const sharedRegistration=primary && pool.every(o=>infos.find(i=>i.face.id===o.sourceFaceId)?.bank.id===rootFamily);
            const match=matchReceiver(info,ds,pool,sharedRegistration);
            if(!match.used.size||!match.cutArea){
              reject(info.face.id,pool.every(o=>o.lap!==lap&&(!profile.allowEndForEnd||-o.lap!==lap))?'lap-rule':'no-containment-or-registration-fit');continue;
            }
            const coverage=match.reusedArea/match.cutArea;
            // Straight fillers do not dilute angled coverage. Partial reuse in
            // the same elevation bank may create the bank's next primary strip.
            const extension=sharedRegistration && pool.some(o=>match.used.has(o.id)&&o.cutKind==='broken_hip');
            const positions=match.placements.filter(p=>p.kind==='reuse').length;
            if(Math.max(coverage,positions/Math.max(1,ds.length))<(primary?.30:.45) || positions<Math.min(2,ds.length) || match.sourceUtilisation<.20){reject(info.face.id,'insufficient-coherent-contribution');continue;}
            if(sharedRegistration&&!extension&&(match.retainedFraction<.80||coverage<.70)){reject(info.face.id,'incomplete-common-bank-continuation');continue;}
            const exactValley=pool.every(o=>o.cutKind==='valley')&&match.newCutCount===0&&match.retainedFraction>.90;
            const adjacentValley=localParent&&pool.every(o=>o.sourceFaceId===localParent&&o.cutKind==='valley');
            const score=(adjacentValley?1.25:0)+(extension?2.5:0)+(exactValley?2:0)+4*Math.min(1,coverage)+2*Math.min(1,match.sourceUtilisation)+2*Math.min(1,match.retainedFraction)
              +(match.newCutCount===0?.35:0)+Math.min(.25,match.reusedArea/Math.max(1,sorted[0].net)*.25)
              -(match.groupsUsed-1)*.015;
            const strategy=describeCutStrategy(ds,pool,match);
            // Keep distinct source/cut families for each receiver until whole
            // sets are allocated. The previous one-offer-per-face map erased
            // an alternative that could coexist with another strong receiver.
            const offerKey=info.face.id+'|'+strategy.sourceFaceIds.sort().join('+')+'|'+strategy.usedSetIds.sort().join('+');
            const best=offers.get(offerKey);
            if(!best||strategy.tier>best.strategy.tier||strategy.tier===best.strategy.tier&&(score>best.score+1e-8||Math.abs(score-best.score)<1e-8&&match.reusedArea>best.match.reusedArea))
              offers.set(offerKey,{info,ds,phase,lap,primary,match,score,strategy});
          }
        }
      }
    }
    const ranked=[...offers.values()].sort((a,b)=>b.strategy.tier-a.strategy.tier||b.score-a.score||b.match.reusedArea-a.match.reusedArea||a.info.face.id.localeCompare(b.info.face.id));
    const batch=chooseCutCommitments(ranked.map((offer,i)=>({id:`offer-${i}`,faceId:offer.info.face.id,pieceIds:[...offer.match.used],strategy:offer.strategy,score:offer.score,offer})));
    let selected=batch[0]?.offer;
    // Deliberate alternatives may change a near-equal partial relationship, not
    // break an already superior whole hip pair or valley complement.
    if(objective!=='recommended'&&shift%2&&selected&&selected.strategy.tier<2&&ranked.length>1&&ranked[1].strategy.tier===selected.strategy.tier&&ranked[1].score>=selected.score-.3){
      selected=ranked[1];
    }
    state.commitments=batch.map(x=>x.offer).filter(o=>o!==selected&&!selected?.match.placements.some(p=>p.kind==='reuse'&&o.match.used.has(p.offcutId!))&&o.info.face.id!==selected?.info.face.id);
    if(selected)state.committedFaces.add(selected.info.face.id);
    state.record.add('reserve-complementary-sets','Reserve compatible whole-set relationships together before allocating residual pieces.',batch.map(x=>x.faceId),{
      commitments:[...(selected?[selected]:[]),...state.commitments].map(o=>({faceId:o.info.face.id,strategy:o.strategy,offcutIds:[...o.match.used],phaseMm:o.phase,lap:o.lap})),
      rule:'whole-valley-and-paired-hip-sets-before-partial-reuse',
      rejectedConflicts:ranked.filter(o=>!batch.some(b=>b.offer===o)).slice(0,12).map(o=>({faceId:o.info.face.id,relationship:o.strategy.relationship,reason:'inferior-or-conflicts-with-reserved-face/pieces'}))
    });
    state.record.add('evaluate-destinations','Compared coherent sets against remaining faces; scores are ranking terms, not confidence.',undefined,{
      unusedPieces:unused.length,consumedPieces:state.used.size,rejections:rejected,
      candidates:ranked.slice(0,16).map(o=>({faceId:o.info.face.id,score:o.score,selected:o===selected,
        newSheets:o.match.placements.filter(p=>p.kind==='new').length,reusedPositions:o.match.used.size,
        reuseToAngledAreaRatio:o.match.cutArea?o.match.reusedArea/o.match.cutArea:0,retainedFraction:o.match.retainedFraction,
        sourceUtilisation:o.match.sourceUtilisation,groups:o.match.groupsUsed,phaseMm:o.phase,lap:o.lap,strategy:o.strategy,
        sourceFaces:[...new Set(state.inventory.filter(c=>o.match.used.has(c.id)).map(c=>c.sourceFaceId))],
        offcutIds:[...o.match.used]})),
      selectedFaceId:selected?.info.face.id??null,reason:selected?(selected===ranked[0]?'whole-cut-set-strategy':'compatible-batch-or-partial-variation'):'no-eligible-coherent-offer'
    });
    return selected;
  }
  const selfDiagnostics=new Map<string,Record<string,unknown>[]>();
  const selfCache=new Map<string,{ds:Demand[];ps:Placement[];phase:number}|null>();
  function selfSupply(info:Info,extend:boolean): {ds:Demand[];ps:Placement[];phase:number}|undefined {
    const cacheKey=info.face.id+'/'+extend;
    if(selfCache.has(cacheKey))return selfCache.get(cacheKey)??undefined;
    if(!info.selfComplement)return undefined;
    const assessed:Record<string,unknown>[]=[];selfDiagnostics.set(info.face.id,assessed);
    let best:{ds:Demand[];ps:Placement[];phase:number;cost:number;newCount:number}|undefined;
    for(const phase of info.offsets){
      check();const ds=dsFor(info,phase,info.face.lap,true,extend);
      for(const donors of selfFillDonorWindows(ds,info.face,request)){
        check();const targets=ds.filter(d=>!donors.has(d.id));
        if(!targets.length)continue;
        const stock=ds.filter(d=>donors.has(d.id)).flatMap(d=>offcutsFrom(d,profile));
        const match=matchSets(targets,stock);
        if(!match.used.size){assessed.push({phaseMm:phase,newDonors:donors.size,targetPositions:targets.length,reusedPositions:0,result:'no-physical-self-fit'});continue;}
        const partial:Placement[]=ds.filter(d=>donors.has(d.id)).map(d=>({demandId:d.id,kind:'new',rotation:0,translateY:0}));
        partial.push(...match.placements.filter(p=>p.kind==='reuse'));
        // A self-fill operation can itself yield a second useful cut. Do not
        // buy the final narrow receiver lanes before trying these real remnants.
        for(let pass=0;pass<3;pass++){
          const supplied=new Set(partial.map(p=>p.demandId)), remaining=ds.filter(d=>!supplied.has(d.id));
          if(!remaining.length)break;
          const rebuilt=rebuildInventory(ds,partial,profile);
          if(rebuilt.unresolved.length)break;
          const used=new Set(partial.filter(p=>p.kind==='reuse').map(p=>p.offcutId));
          const available=rebuilt.offcuts.filter(o=>!used.has(o.id));
          const next=matchSets(remaining,available).placements.filter(p=>p.kind==='reuse');
          if(!next.length)break;partial.push(...next);
        }
        const fits=new Map(partial.map(p=>[p.demandId,p]));
        const ps=ds.map((d):Placement=>fits.get(d.id)??{demandId:d.id,kind:'new',rotation:0,translateY:0});
        const fresh=new Set(ps.filter(p=>p.kind==='new').map(p=>p.demandId));
        const cost=ds.filter(d=>fresh.has(d.id)).reduce((n,d)=>n+area(d.blank),0);
        assessed.push({phaseMm:phase,newDonors:donors.size,newSheets:fresh.size,reusedPositions:match.used.size,suppliedMm2:cost});
        if(!best||cost<best.cost-1||Math.abs(cost-best.cost)<=1&&fresh.size<best.newCount)best={ds,ps,phase,cost,newCount:fresh.size};
      }
    }
    selfCache.set(cacheKey,best??null);return best;
  }
  function selfFeed(state:State,onlyFace?:string):void {
    for(let pass=0;pass<2;pass++){
      let changed=false;
      for(const info of infos){
        if(onlyFace&&info.face.id!==onlyFace)continue;
        if(state.committedFaces.has(info.face.id))continue;
        if(valleyParents.has(info.face.id))continue;
        if(state.layout.selfFillFaceIds?.includes(info.face.id)||state.layout.primaryOperations?.some(op=>op.faceIds.includes(info.face.id)))continue;
        check();
        const used=new Set(state.placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId));
        const protectedDemand=new Set(state.inventory.filter(o=>used.has(o.id)).map(o=>o.sourceDemandId));
        const fresh=new Set(state.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
        const eligible=state.demands.filter(d=>d.faceId===info.face.id&&fresh.has(d.id)&&!protectedDemand.has(d.id)&&!isStraightFiller(d.required)).sort((a,b)=>a.laneIndex-b.laneIndex);
        if(!eligible.length)continue;
        const unused=state.inventory.filter(o=>o.sourceFaceId===info.face.id&&!used.has(o.id));
        if(!unused.length)continue;
        // Choose a supplied contiguous half-bank before offering its offcuts to
        // the rest. Matching every lane to its OWN offcut creates cycles and was
        // why the prior implementation could never make K/D/F feed themselves.
        const donorSets:Set<string>[]=[new Set()];
        const n=eligible.length;
        for(const count of [...new Set([1,Math.floor(n/2)-1,Math.floor(n/2),Math.ceil(n/2),Math.ceil(n/2)+1,n-1])].filter(k=>k>0&&k<n)){
          donorSets.push(new Set(eligible.slice(0,count).map(d=>d.id)),new Set(eligible.slice(n-count).map(d=>d.id)));
        }
        let best:Placement[]|undefined,bestSaving=0;
        for(const donors of donorSets){
          check();const targets=eligible.filter(d=>!donors.has(d.id)),targetIds=new Set(targets.map(d=>d.id));
          const stock=unused.filter(o=>!targetIds.has(o.sourceDemandId));
          if(!stock.length||!targets.length)continue;
          const match=matchSets(targets,stock), proposed=match.placements.filter(p=>p.kind==='reuse');
          const saving=targets.filter(d=>proposed.some(p=>p.demandId===d.id)).reduce((n,d)=>n+area(d.blank),0);
          if(saving>bestSaving+1e-3){best=proposed;bestSaving=saving;}
        }
        if(!best?.length)continue;
        const next=state.placements.map(p=>best!.find(q=>q.demandId===p.demandId)??p);
        const rebuilt=rebuildInventory(state.demands,next,profile);
        if(rebuilt.unresolved.length)continue;
        state.placements=next;state.inventory=rebuilt.offcuts;state.used=new Set(next.filter(p=>p.kind==='reuse').map(p=>p.offcutId!));changed=true;
        state.record.add('self-recut','Replaced fresh positions with this face’s actual unused cuts.',[info.face.id],{reused:best.map(p=>({demandId:p.demandId,offcutId:p.offcutId})),savedMm2:bestSaving});
      }
      if(!changed)break;
    }
  }
  /** Revisit fresh gaps only with another useful ordered set. A face can receive
   * two source blocks separated by fillers; alternating scraps are rejected.
   * Already-consumed donor cuts protect their parent new sheets from removal. */
  function topUp(state:State):void {
    for(let pass=0;pass<2;pass++){
      let changed=false;
      for(const info of infos){
        check();if(state.layout.selfFillFaceIds?.includes(info.face.id)||state.layout.primaryOperations?.some(op=>op.faceIds.includes(info.face.id)))continue;
        const view=supplyView({...state,offcuts:state.inventory,bankLayout:state.layout});
        const used=new Set(state.placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId));
        const protectedIds=new Set(state.inventory.filter(o=>used.has(o.id)).map(o=>o.sourceDemandId));
        const fresh=new Set(state.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
        const localFillers=receivingFillers(info,state.demands.filter(d=>d.faceId===info.face.id));
        const targets=state.demands.filter(d=>d.faceId===info.face.id&&fresh.has(d.id)&&!protectedIds.has(d.id)&&!localFillers.has(d.id));
        if(!targets.length)continue;
        const targetIds=new Set(targets.map(d=>d.id));
        const onFace=state.placements.filter(p=>state.demands.find(d=>d.id===p.demandId)?.faceId===info.face.id);
        const existing=new Set(onFace.filter(p=>p.kind==='reuse').map(p=>view.blockByPlacement.get(p.demandId)).filter(Boolean));
        const pools=new Map<string,Offcut[]>();
        for(const o of state.inventory){
          if(used.has(o.id)||o.sourceFaceId===info.face.id||targetIds.has(o.rootDemandId??o.sourceDemandId))continue;
          const localParent=valleyParents.get(info.face.id);if(localParent&&(o.sourceFaceId!==localParent||o.cutKind!=='valley'))continue;
          const block=view.blockByRootDemand.get(o.rootDemandId??o.sourceDemandId);if(!block)continue;
          if(state.committedFaces.has(info.face.id)&&objective!=='less-material'&&!existing.has(block))continue;
          if(!existing.has(block)&&existing.size>=(simpleMode?1:(settings.maxSourceBlocksPerFace??2)))continue;
          const key=block+'|'+o.sourceFaceId, pool=pools.get(key)??[];pool.push(o);pools.set(key,pool);
        }
        let best:Placement[]|undefined,bestScore=0;
        for(const stock of pools.values()){
          check();const match=matchSets(targets,stock),reuse=match.placements.filter(p=>p.kind==='reuse');
          const block=view.blockByRootDemand.get(stock[0].rootDemandId??stock[0].sourceDemandId)!;
          const extraSource=existing.size>0&&!existing.has(block);
          if(reuse.length<Math.min(extraSource?3:2,targets.length)||extraSource&&reuse.length<2)continue;
          const proposed=new Map(reuse.map(p=>[p.demandId,p]));
          let runs=0,last='',lastLane=-Infinity;const visits=new Map<string,number>();
          const ds=state.demands.filter(d=>d.faceId===info.face.id).sort((a,b)=>a.laneIndex-b.laneIndex);
          for(const d of ds){
            const p=proposed.get(d.id)??onFace.find(p=>p.demandId===d.id)!;
            if(p.kind==='new'){lastLane=-Infinity;continue;}
            const id=proposed.has(d.id)?block:view.blockByPlacement.get(d.id)!;
            if(id!==last||d.laneIndex!==lastLane+1){runs++;visits.set(id,(visits.get(id)??0)+1);}
            last=id;lastLane=d.laneIndex;
          }
          if(runs>(simpleMode?2:4)||[...visits.values()].some(n=>n>2))continue;
          const saving=targets.filter(d=>proposed.has(d.id)).reduce((n,d)=>n+area(d.blank),0);
          const localValley=stock.every(o=>o.sourceFaceId===valleyParents.get(info.face.id)&&o.cutKind==='valley');
          const score=saving*(extraSource?.90:1)*(localValley?1.10:1);
          if(score>bestScore+1){best=reuse;bestScore=score;}
        }
        if(!best?.length)continue;
        const replacement=new Map(best.map(p=>[p.demandId,p]));
        const placements=state.placements.map(p=>replacement.get(p.demandId)??p);
        const rebuilt=rebuildInventory(state.demands,placements,profile);
        if(rebuilt.unresolved.length)continue;
        state.placements=placements;state.inventory=rebuilt.offcuts;
        state.used=new Set(placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId!));changed=true;
        state.record.add('top-up','Filled remaining fresh gaps with a coherent set without removing a committed donor.',[info.face.id],{rankingScore:bestScore,savedMm2:state.demands.filter(d=>best!.some(p=>p.demandId===d.id)).reduce((n,d)=>n+area(d.blank),0),placements:best.map(p=>({demandId:p.demandId,offcutId:p.offcutId}))});
      }
      if(!changed)break;
    }
  }
  function commitMainOperation(state:State,leader:Info,shift:number,extend:boolean):void {
    let members=bankAnchorFaces(faces.filter(f=>leader.bank.faceIds.includes(f.id)),roof)
      .map(f=>infos.find(i=>i.face.id===f.id)!).filter(i=>!state.done.has(i.face.id)&&!i.selfComplement)
      .sort((a,b)=>b.ridgeLength-a.ridgeLength||b.net-a.net||a.face.id.localeCompare(b.face.id));
    if(!members.length)return;
    const locked=members.find(i=>i.face.laneOffsetLocked);
    let grid=coverStations(leader.bank,members.map(i=>i.face),request,shift%2?'end':'start');
    if(locked){
      const frame=frameFor(locked.face,roof);
      const lo=Math.min(...locked.face.polygon.map(p=>dot(p,frame.u)*roof.mmPerSceneUnit));
      const mod=(n:number)=>((n%profile.coverMm)+profile.coverMm)%profile.coverMm;
      grid=coverStations(leader.bank,members.map(i=>i.face),request,'start',mod(locked.face.laneOffsetMm-(lo-grid.crossStartMm)));
    }
    const bankLap=members.find(i=>i.face.lapLocked)?.face.lap??leader.face.lap;
    const referenceFrame=frameFor(members[0].face,roof);
    const separated=members.filter(i=>dot(frameFor(i.face,roof).u,referenceFrame.u)<1-1e-10 || i.face.laneOffsetLocked&&Math.abs(i.face.laneOffsetMm-grid.offsetByFace[i.face.id])>.01 || i.face.lapLocked&&i.face.lap!==bankLap);
    if(separated.length){
      state.record.add('locked-registration-separation','Different run axes or incompatible explicit setout/lap locks remain separate physical operations.',separated.map(i=>i.face.id));
      members=members.filter(i=>!separated.includes(i));
      if(members.length){
        const u=frameFor(members[0].face,roof).u;
        const lo=Math.min(...members.flatMap(i=>i.face.polygon.map(p=>dot(p,u)*roof.mmPerSceneUnit)));
        const phase=((lo-grid.crossStartMm)%profile.coverMm+profile.coverMm)%profile.coverMm;
        grid=coverStations(leader.bank,members.map(i=>i.face),request,'start',phase<1e-7||profile.coverMm-phase<1e-7?0:phase);
      }
    }
    if(!members.length)return;
    const operation={id:`operation:${members.map(i=>i.face.id).sort().join('+')}`,bankId:leader.bank.id,
      faceIds:members.map(i=>i.face.id),phaseMm:grid.phaseMm,stockLengthMm:leader.bank.cutLengthMm,coverStations:grid,oneRootPerColumn:false};
    // A common bank is not just a colour label. Solve actual shared physical
    // columns before offering ANY of their cuts to external receiving faces.
    // Subtle linework/clearance differences can need more downstream stock;
    // trying head-only extension does not lengthen a lower valley offcut.
    const limit=extend?(settings.maxBankExtensionMm??100):0;
    const minimum=Math.min(limit,totalExtra);
    const trialBudget=[minimum,Math.min(limit,Math.max(minimum,50)),limit][Math.floor(shift/2)%3];
    const allowances=[{head:Math.ceil(trialBudget/2),tail:Math.floor(trialBudget/2)}];
    if(members.length>1)for(const total of [Math.max(minimum,25),Math.max(minimum,50),limit]){
      if(total>limit)continue;
      for(const ratio of [.25,.5,.75])allowances.push({head:Math.round(total*ratio),tail:total-Math.round(total*ratio)});
    }
    type Simulation={parts:{info:Info;ds:Demand[];ps:Placement[]}[];fresh:number;cost:number;allowance:{head:number;tail:number};duplicates:number};
    let chosen:Simulation|undefined;
    const trials:Record<string,unknown>[]=[];
    for(const allowance of allowances){
      check();const parts:Simulation['parts']=[],dsAll:Demand[]=[],psAll:Placement[]=[],stock:Offcut[]=[];
      const used=new Set<string>(),columns=new Map<number,number>();let cost=0,fresh=0;
      for(const info of members){
        const ds=dsFor(info,grid.offsetByFace[info.face.id],bankLap,true,extend,true,allowance),ps:Placement[]=[];
        for(const d of ds){
          const cross=dot(d.frame.origin,d.frame.u)*d.frame.mmPerSceneUnit+d.origin.x;
          const fits=stock.filter(o=>!used.has(o.id)&&o.lap===bankLap&&o.sourceCrossMm!==undefined&&Math.abs(o.sourceCrossMm-cross)<.01)
            .map(o=>({o,p:findFit(o,d,{...profile,allowEndForEnd:false})})).filter(x=>x.p)
            .sort((a,b)=>area(a.o.region)-area(b.o.region)||a.o.id.localeCompare(b.o.id));
          const p=fits[0]?.p??{demandId:d.id,kind:'new' as const,rotation:0 as const,translateY:0};
          if(p.kind==='reuse')used.add(p.offcutId!);
          else {fresh++;cost+=area(d.blank);const k=Math.round((cross+profile.leftLapMm-grid.crossStartMm)/profile.coverMm);columns.set(k,(columns.get(k)??0)+1);}
          ps.push(p);
        }
        dsAll.push(...ds);psAll.push(...ps);
        const rebuilt=rebuildInventory(dsAll,psAll,profile);if(rebuilt.unresolved.length)throw new Error('Common-bank continuation did not resolve.');
        stock.splice(0,stock.length,...rebuilt.offcuts);parts.push({info,ds,ps});
      }
      const duplicates=[...columns.values()].reduce((n,count)=>n+Math.max(0,count-1),0);
      const trial={parts,fresh,cost,allowance,duplicates};
      trials.push({headMm:allowance.head,tailMm:allowance.tail,freshRoots:fresh,extraRootsInSharedColumns:duplicates,purchasedMm2:cost});
      if(!chosen||duplicates<chosen.duplicates||duplicates===chosen.duplicates&&(cost<chosen.cost-.01||Math.abs(cost-chosen.cost)<.01&&fresh<chosen.fresh))chosen=trial;
      if(!duplicates&&allowance===allowances[0])break;
    }
    if(!chosen)throw new Error('No complete primary operation.');
    operation.oneRootPerColumn=chosen.duplicates===0;
    state.layout.primaryOperations!.push(operation);
    state.record.add('start-primary-operation','Measured the full bank span, fixed cover stations at an end, then fitted all member faces to shared physical parents.',operation.faceIds,{
      operation,spanMm:grid.spanMm,coverMm:profile.coverMm,minimumColumns:grid.minimumColumns,registeredColumns:grid.columns,
      purchasedRoots:chosen.fresh,extraRootsInSharedColumns:chosen.duplicates,allowanceTrials:trials,
      rule:'one-cover-interval-one-parent-when-physical-fit-permits',
      note:chosen.duplicates?'No one-parent continuation fit within the allowed extra stock; additional physical sheets are explicitly reported.':'Every shared column uses one purchased parent.'
    });
    for(const part of chosen.parts){
      commit(state,part.info,part.ds,part.ps,grid.offsetByFace[part.info.face.id],bankLap,true,extend,true,chosen.allowance);
      state.layout.primarySequence!.push(part.info.face.id);
    }
  }
  // A simpler alternative can intentionally replace one or two existing reuse
  // relationships with honest NEW stock. This is a local change to the user's
  // actual previous plan, not a rerun with another random seed. Descendants
  // whose old cut identity disappears are supplied new too, never left dangling.
  if(simpleMode&&policy?.referenceSolution){
    const previous=policy.referenceSolution, view=supplyView(previous);
    const dm=new Map(previous.demands.map(d=>[d.id,d])),om=new Map(previous.offcuts.map(o=>[o.id,o]));
    const relationships=new Map<string,string[]>();
    for(const p of previous.placements){
      if(p.kind!=='reuse'||view.continuationDemandIds.has(p.demandId))continue;
      const d=dm.get(p.demandId)!,o=om.get(p.offcutId??'');
      if(!o||d.faceId===o.sourceFaceId||previous.bankLayout?.selfFillFaceIds?.includes(d.faceId))continue;
      // Simpler means simplify remaining exceptions, not discard a whole clean
      // hip/valley-fed face. Large committed cuts stay intact in this mode.
      if(!previous.placements.some(q=>q.kind==='new'&&dm.get(q.demandId)?.faceId===d.faceId))continue;
      if(previous.placements.some(q=>q.kind==='reuse'&&om.get(q.offcutId??'')?.sourceFaceId===d.faceId&&dm.get(q.demandId)?.faceId!==d.faceId))continue;
      const key=(view.blockByPlacement.get(d.id)??o.sourceFaceId)+'->'+d.faceId;
      const group=relationships.get(key)??[];group.push(d.id);relationships.set(key,group);
    }
    const groups=[...relationships].slice(0,12),neighbours:string[][]=[];
    for(let i=0;i<groups.length;i++){
      neighbours.push(groups[i][1]);
      for(let j=i+1;j<groups.length;j++)neighbours.push([...groups[i][1],...groups[j][1]]);
    }
    totalProgress+=neighbours.length;
    for(const targets of neighbours){
      try{
        check();const state=blankState();state.trial=candidates.length+1;state.seedFaceId=previous.bankLayout?.primarySequence?.[0]??'';
        state.demands=structuredClone(previous.demands);state.layout=structuredClone(previous.bankLayout!);
        state.laps={...previous.lapByFace};state.done=new Set(faces.map(f=>f.id));
        const replaced=new Set(targets);
        const fresh=(id:string):Placement=>({demandId:id,kind:'new',rotation:0,translateY:0});
        state.placements=previous.placements.map(p=>replaced.has(p.demandId)?fresh(p.demandId):{...p});
        let rebuilt=rebuildInventory(state.demands,state.placements,profile);
        // Acyclic cut-tree closure. No changed source can leave fictitious child
        // stock alive. Newly purchased rectangles are already dimension-checked.
        for(let pass=0;rebuilt.unresolved.length&&pass<state.demands.length;pass++){
          const missing=new Set(rebuilt.unresolved);for(const id of missing)replaced.add(id);
          state.placements=state.placements.map(p=>missing.has(p.demandId)?fresh(p.demandId):p);
          rebuilt=rebuildInventory(state.demands,state.placements,profile);
        }
        if(rebuilt.unresolved.length)continue;
        state.inventory=rebuilt.offcuts;state.used=new Set(state.placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId!));state.completed=true;
        state.record.add('reference-plan','Started with the Recommended physical plan; alternative allowances do not accumulate.',undefined,{layoutId:previous.layoutId,quality:planQuality(previous),primarySequence:previous.bankLayout?.primarySequence});
        state.record.add('simplify-relationship','Replaced selected offcut relationships with full new sheets to reduce site complexity.',
          [...new Set([...replaced].map(id=>dm.get(id)!.faceId))],{requestedNewDemandIds:targets,
            dependentNewDemandIds:[...replaced].filter(id=>!targets.includes(id)),rule:'count-every-new-sheet-and-retire-old-cut-identities'});
        candidates.push(state);completed++;hooks.onProgress?.(completed,totalProgress);
      }catch(error){if(error instanceof Deadline){budgetReached=true;break;}throw error;}
    }
  }
  for(const trial of simpleMode&&policy?.referenceSolution?[]:trials){
    const state=blankState();state.trial=candidates.length+1;state.seedFaceId=trial.seed.face.id;
    state.record.add('trial-start','Started an independently searched strategy.',undefined,{
      objective,trial:state.trial,seedFaceId:trial.seed.face.id,registrationVariant:trial.shift,
      protectedMainFaces:[...mainMembers],selfFillCandidates:[...reservedSelf],valleyReceivingParents:Object.fromEntries(valleyParents),attempt
    });
    try{
      check();let next=trial.seed;
      while(state.done.size<faces.length){
        check();
        if(!next||state.done.has(next.face.id))next=(sorted.find(i=>!state.done.has(i.face.id)&&(!valleyParents.has(i.face.id)||state.done.has(valleyParents.get(i.face.id)!)))??sorted.find(i=>!state.done.has(i.face.id)))!;
        const self=selfSupply(next,trial.extend);
        if(next.selfComplement)state.record.add('evaluate-self-fill','Tested real eave-donor windows and the resulting hip cuts against this valley side.',[next.face.id],{windows:selfDiagnostics.get(next.face.id)??[],result:self?'physical-self-fill-found':'no-valid-self-fill-new-stock-fallback'});
        const main=mainBanks.has(next.bank.id)&&mainMembers.has(next.face.id);
        if(main){commitMainOperation(state,next,trial.shift,trial.extend);}
        else if(self){
          commit(state,next,self.ds,self.ps,self.phase,next.face.lap,true,trial.extend);
          state.layout.selfFillFaceIds!.push(next.face.id);
          state.record.add('self-fill','Reserved the eave-based donor run; hip cuts supply this face’s valley side before external use.',[next.face.id],{newSheets:self.ps.filter(p=>p.kind==='new').length,reuse:self.ps.filter(p=>p.kind==='reuse').length});
        }else{
          const phase=next.offsets[trial.shift%Math.min(2,next.offsets.length)];
          const ds=dsFor(next,phase,next.face.lap,true,trial.extend);
          commit(state,next,ds,ds.map(d=>({demandId:d.id,kind:'new',rotation:0,translateY:0})),phase,next.face.lap,true,trial.extend);
        }
        if(!main)state.layout.primarySequence!.push(next.face.id);
        while(state.done.size<faces.length){
          const offer=bestOffer(state,trial.shift,trial.extend);if(!offer)break;
          commit(state,offer.info,offer.ds,offer.match.placements,offer.phase,offer.lap,offer.primary,trial.extend,offer.primary);
        }
        next=(sorted.find(i=>!state.done.has(i.face.id)&&(!valleyParents.has(i.face.id)||state.done.has(valleyParents.get(i.face.id)!)))??sorted.find(i=>!state.done.has(i.face.id)))!;
      }
      selfFeed(state);topUp(state);state.record.add('bank-cover-audit','Physical bank stations and unique new roots after sourcing.',undefined,{banks:bankLaneAudit({...state,profile,bankLayout:state.layout} as unknown as Solution)});state.completed=true;completed++;hooks.onProgress?.(completed,totalProgress);candidates.push(state);
    }catch(error){
      if(error instanceof Deadline){budgetReached=true;state.layout.primaryOperations=state.layout.primaryOperations?.filter(op=>op.faceIds.every(id=>state.done.has(id)));state.record.add('budget-fallback','Search time budget reached; any unallocated positions are purchased new. This is not evidence of no possible reuse.');completeNew(state);candidates.push(state);break;}
      if(error instanceof Error&&/exceeds the profile maximum/.test(error.message)){continue;}
      throw error;
    }
  }
  if(!candidates.length)candidates.push(fallback);
  const asPlan=(state:State)=>({demands:state.demands,placements:state.placements,offcuts:state.inventory,bankLayout:state.layout});
  const qualities=new Map(candidates.map(state=>[state,planQuality(asPlan(state))]));
  const signatures=new Map(candidates.map(state=>[state,planSignature(asPlan(state))]));
  const quality=(state:State)=>qualities.get(state)!;
  const cost=(state:State)=>quality(state).suppliedMm2;
  const cheapest=Math.min(...candidates.map(cost));
  const reference=policy?.referenceQuality;
  const maxExtra=policy?.maxExtraMaterialPercent??SIMPLER_POLICY.maxExtraPercent;
  const assessments=new Map(simpleMode&&policy?.referenceSolution?candidates.map(state=>[state,simplerAssessment(policy.referenceSolution!,asPlan(state),profile,maxExtra)]):[]);
  const materialAssessments=new Map(objective==='less-material'&&policy?.referenceSolution?candidates.map(state=>[state,lessMaterialAssessment(policy.referenceSolution!,asPlan(state),profile)]):[]);
  const excluded=new Set(policy?.excludeSignatures??[]);
  const distinct=candidates.filter(state=>!excluded.has(signatures.get(state)!));
  let eligible=distinct;
  // Simpler uses a bounded final shortlist. These are provisional costs: receiver
  // refinement can change them, so the authoritative gate is AFTER physical checks.
  // Never discard a modest-cost candidate merely because an expensive one has
  // a slightly lower legacy score.
  if(reference&&objective==='less-material')eligible=eligible.filter(s=>cost(s)<reference.suppliedMm2-1);
  let sortedCandidates=[...eligible].sort((a,b)=>objective==='simpler'
    ?Number(!assessments.get(a)?.accepted)-Number(!assessments.get(b)?.accepted)||
      (assessments.get(a)?.proposedWorkflow.score??quality(a).complexity)-(assessments.get(b)?.proposedWorkflow.score??quality(b).complexity)||cost(a)-cost(b)
    :cost(a)-cost(b)||quality(a).complexity-quality(b).complexity);
  if(objective==='less-material'&&materialAssessments.size)sortedCandidates=rankMaterialCandidates(sortedCandidates,s=>materialAssessments.get(s)!);
  // Recommended preserves longest banks/self-fill before preferring simplicity
  // within an 8% material band. Lower-material has a separate explicit objective.
  const macroCount=(state:State)=>state.record.events.filter(e=>['reserve-complementary-sets','honour-cut-set-commitment'].includes(e.action)).reduce((n,e)=>n+(e.action==='honour-cut-set-commitment'?(Number((e.data?.strategy as CutStrategy|undefined)?.tier??0)>=2?1:0):((e.data?.commitments??[]) as {strategy:CutStrategy}[]).slice(0,1).filter(x=>x.strategy.tier>=2).length),0);
  const suggested=objective==='recommended'?[...sortedCandidates].filter(s=>cost(s)<=cheapest*1.08+1)
    .sort((a,b)=>macroCount(b)-macroCount(a)||sorted.findIndex(i=>i.face.id===a.seedFaceId)-sorted.findIndex(i=>i.face.id===b.seedFaceId)||quality(a).complexity-quality(b).complexity||cost(a)-cost(b))[0]:sortedCandidates[0];
  const ordered=suggested?[suggested,...sortedCandidates.filter(s=>s!==suggested)]:[];
  const summaries=candidates.map(state=>({trial:state.trial,seedFaceId:state.seedFaceId,objective,
    signature:signatures.get(state)!,quality:quality(state),completed:state.completed,selected:false,
    evaluationStage:'bank-search' as const,...(assessments.has(state)?{simplification:assessments.get(state)}:{}),
    ...(materialAssessments.has(state)?{materialSaving:materialAssessments.get(state)}:{}),
    reason:excluded.has(signatures.get(state)!)?'already-shown-physical-layout':!eligible.includes(state)?'does-not-improve-requested-objective-within-material-cap':'eligible-candidate'}));
  const traceFor=(state:State|null)=>({schemaVersion:1 as const,engineVersion:'2.17' as const,
    requestFingerprint:fingerprint({faces,profile,settings}),objective,selectedTrial:state?.trial??null,
    events:state?.record.events??[{step:1,action:'no-selection',message:'No unseen candidate improved the requested objective within its material cap. The previous plan is retained.',data:{objective,referenceQuality:reference,excludedSignatures:[...excluded],maxExtraMaterialPercent:maxExtra}}],candidates:summaries.map(c=>({...c,selected:c.trial===state?.trial,
      reason:c.trial===state?.trial?'selected-by-'+objective:c.reason})),
    truncated:(state?.record.droppedEvents??0)>0,droppedEvents:state?.record.droppedEvents??0,
    budgetReached,elapsedMs:clock()-started,scope:'actual-selected-search' as const});
  const seen=new Set<string>(),output:Solution[]=[];
  for(const state of ordered){
    const signature=signatures.get(state)!;if(seen.has(signature))continue;seen.add(signature);
    const solution=toSolution(request,state,issues,completed,clock()-started,budgetReached);
    solution.layoutId=signature;solution.layoutLabel=objective==='recommended'?'Recommended':objective==='simpler'?'Simpler cut plan':'Less material';
    solution.objective=objective;solution.decisionTrace=traceFor(state);output.push(solution);
    if(output.length===(simpleMode?SIMPLER_POLICY.finalCandidateLimit:objective==='less-material'?LESS_MATERIAL_POLICY.finalCandidateLimit:3))break;
  }
  hooks.onDecisionTrace?.(output[0]?.decisionTrace??traceFor(null));
  return output;
}
function toSolution(request:SolveRequest,state:State,inputIssues:Issue[],completed:number,elapsed:number,budgetReached:boolean):Solution {
  const {roof,faces,profile,settings}=request;
  const index=new Map(faces.map((f,i)=>[f.id,i]));
  state.demands.sort((a,b)=>index.get(a.faceId)!-index.get(b.faceId)!||a.laneIndex-b.laneIndex);
  const fresh=new Set(state.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
  const cost=state.demands.reduce((n,d)=>n+(fresh.has(d.id)?area(d.blank):0),0),baseline=state.demands.reduce((n,d)=>n+area(d.blank),0);
  const installed=state.demands.reduce((n,d)=>n+area(d.required),0);
  const issues:Issue[]=[...inputIssues];
  if(!profile.allowEndForEnd)issues.push({severity:'warning',code:'END_FOR_END_RESTRICTED',message:'End-for-end reuse is disabled by the profile; complementary hip/valley sets may require new material instead.'});
  for(const f of faces){
    if(!state.demands.some(d=>d.faceId===f.id&&fresh.has(d.id)&&!isStraightFiller(d.required)))continue;
    const head=state.layout.extraLengthByFace[f.id],tail=state.layout.tailExtensionByFace?.[f.id]??0;
    if(head||tail)issues.push({severity:'warning',code:'EXTRA_CUT_STOCK',faceId:f.id,message:`${f.name}: cut-stock allowance up to ${head+tail} mm (${head} mm upstream, ${tail} mm at an angled downstream edge). Counted in supplied lengths; confirm on site.`});
  }
  if(budgetReached)issues.push({severity:'warning',code:'SEARCH_BUDGET',message:'Time budget reached. Unsolved positions have been supplied new; this complete draft is not proof that no better reuse exists.'});
  issues.push({severity:'warning',code:'PROTOTYPE_ONLY',message:'Draft material-bank plan. Verify profile, sheet registration and site lengths. No guaranteed minimum, manufacturer approval or spare sheets are implied.'});
  return{schemaVersion:1,engineVersion:'2.17',sourceRevision:roof.sourceRevision,facesRevision:fingerprint({faces,profile,settings}),
    profile:structuredClone(profile),settings:structuredClone(settings),demands:state.demands,placements:state.placements.sort((a,b)=>a.demandId.localeCompare(b.demandId)),
    offcuts:state.inventory,lapByFace:state.laps,bankLayout:state.layout,
    metrics:{newMaterialMm2:cost,baselineNewMaterialMm2:baseline,netRoofMm2:state.demands.reduce((n,d)=>n+area(d.cover),0),installedPhysicalMm2:installed,
      wasteMm2:cost-installed,savedMm2:baseline-cost,newSheetCount:fresh.size,reusedPieceCount:state.placements.length-fresh.size},
    search:{method:'material-banks',completedTrials:completed,elapsedMs:elapsed,budgetReached,provenOptimal:false},issues,status:'prototype-review',orderReady:false};
}
export function optimiseBanks(request:SolveRequest,hooks:SearchHooks={}):Solution{return optimiseBankLayouts(request,hooks)[0];}
