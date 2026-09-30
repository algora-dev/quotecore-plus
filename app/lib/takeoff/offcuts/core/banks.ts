import type { BankLayout, Demand, Issue, Lap, MaterialBank, Offcut, Placement, RoofFace, Solution, SolveRequest } from './types';
import type { SearchHooks } from './solver';
import { fingerprint } from './math';
import { area } from './regions';
import { frameFor, sceneToSurface, generateDemands, generateFaceDemands, isStraightFiller, offcutsFrom, offcutsFromMaterial, validateInputs } from './material';
import { buildMaterialBanks, bankOffsets } from './materialBanks';
import { matchCoherentSets, type CoherentMatch } from './coherentMatching';
import { materialAtDestination, rebuildInventory } from './inventory';

interface Info { face:RoofFace; bank:MaterialBank; offsets:number[]; net:number; length:number; ridgeLength:number; selfComplement:boolean }
interface State {
  demands:Demand[]; placements:Placement[]; inventory:Offcut[]; used:Set<string>;
  done:Set<string>; layout:BankLayout; laps:Record<string,Lap>;
}
interface Offer { info:Info; ds:Demand[]; phase:number; lap:Lap; primary:boolean; match:CoherentMatch; score:number }
class Deadline extends Error {}

/** V2.4 elevation/material-bank search. Physical faces are never collapsed.
 *
 * 1. Pick a long bank and supply one main cutting operation.
 * 2. Offer WHOLE ordered hip/valley sets to complementary faces, preferring
 *    complete angled coverage and useful sets, not arbitrary scraps.
 * 3. A receiving face keeps one root supply bank. Actual recuts can feed the
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
  const banks=buildMaterialBanks(request);
  const baseLayout:BankLayout={primaryFaceIds:[],laneOffsetByFace:Object.fromEntries(faces.map(f=>[f.id,f.laneOffsetMm])),
    extraLengthByFace:Object.fromEntries(faces.map(f=>[f.id,0])),tailExtensionByFace:Object.fromEntries(faces.map(f=>[f.id,0])),
    cutLengthByFace:Object.fromEntries(faces.map(f=>[f.id,Math.min(profile.maxLengthMm,banks.find(b=>b.faceIds.includes(f.id))!.cutLengthMm)])),
    materialBanks:banks,primarySequence:[]};
  const base=generateDemands(roof,faces,profile,settings,baseLayout);
  const infos:Info[]=faces.map(face=>{
    const ds=base.filter(d=>d.faceId===face.id), bank=banks.find(b=>b.faceIds.includes(face.id))!;
    const frame=frameFor(face,roof), points=face.polygon.map(p=>sceneToSurface(p,frame));
    const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    const ridges=face.boundary.filter(e=>e.kind==='ridge');
    // The longest run TO A RIDGE is the purchasing anchor. A long hip point
    // on an end face must not outrank a main face's actual long ridge bank.
    const ridgeLength=ridges.length?Math.max(...ridges.map(e=>maxY-(sceneToSurface(e.a,frame).y+sceneToSurface(e.b,frame).y)/2)):0;
    const angled=face.boundary.filter(e=>['hip','valley','broken_hip'].includes(e.kind));
    const slopes=angled.map(e=>{const a=sceneToSurface(e.a,frame),b=sceneToSurface(e.b,frame);return (b.y-a.y)/(b.x-a.x);});
    return{face,bank,offsets:bankOffsets(face,bank,request),net:ds.reduce((n,d)=>n+area(d.cover),0),
      length:maxY-minY,ridgeLength,selfComplement:angled.length===2 && ridges.length>0 && slopes.every(Number.isFinite) && Math.abs(slopes[0]-slopes[1])<1e-5};
  });
  const sorted=[...infos].sort((a,b)=>Math.round(b.ridgeLength)-Math.round(a.ridgeLength)||Math.round(b.length)-Math.round(a.length)||b.net-a.net||a.face.id.localeCompare(b.face.id));
  const longestRidge=Math.max(...infos.map(i=>i.ridgeLength));
  const mains=new Set(infos.filter(i=>i.ridgeLength>=longestRidge*.97 && !i.selfComplement).map(i=>i.face.id));
  const check=()=>{if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');if(clock()-started>settings.maxMilliseconds)throw new Deadline();};
  const defaultLaps=Object.fromEntries(faces.map(f=>[f.id,f.lap])) as Record<string,Lap>;
  const blankState=():State=>({demands:[],placements:[],inventory:[],used:new Set(),done:new Set(),layout:structuredClone(baseLayout),laps:{...defaultLaps}});
  const cache=new Map<string,Demand[]>();
  // Total extra stock is capped by the user's existing extension setting.
  // Split it between ends; only an actual angled lower cut uses the tail.
  // Valley -> matching hip needs downstream clearance, not an upstream-only
  // extension which cannot possibly enlarge that valley offcut.
  const totalExtra=Math.min(settings.maxBankExtensionMm??100,Math.max(0,profile.cutGapMm*2+profile.lengthIncrementMm*2));
  const headExtra=Math.min(totalExtra,Math.ceil(totalExtra/2/profile.lengthIncrementMm)*profile.lengthIncrementMm);
  const tailExtra=Math.max(0,totalExtra-headExtra);
  function dsFor(info:Info,phase:number,lap:Lap,primary:boolean,extend:boolean,shared=false):Demand[]{
    const key=`${info.face.id}/${phase}/${primary}/${extend}/${shared}`;
    let ds=cache.get(key);
    if(!ds){ds=generateFaceDemands(roof,{...info.face,laneOffsetMm:phase},profile,settings,primary,
      primary&&extend?headExtra:0,shared?baseLayout.cutLengthByFace![info.face.id]:info.length,primary&&extend?tailExtra:0,info.bank.id);cache.set(key,ds);}
    return ds.map(d=>({...d,lap}));
  }
  function setLayout(state:State,info:Info,phase:number,lap:Lap,primary:boolean,extend:boolean,shared=false):void {
    const id=info.face.id;state.layout.cutLengthByFace![id]=shared?baseLayout.cutLengthByFace![id]:info.length;state.layout.laneOffsetByFace[id]=phase;state.laps[id]=lap;
    if(primary&&!state.layout.primaryFaceIds.includes(id))state.layout.primaryFaceIds.push(id);
    state.layout.extraLengthByFace[id]=primary&&extend?headExtra:0;
    state.layout.tailExtensionByFace![id]=primary&&extend?tailExtra:0;
  }
  function commit(state:State,info:Info,ds:Demand[],placements:Placement[],phase:number,lap:Lap,primary:boolean,extend:boolean,shared=false):void {
    const map=new Map(state.inventory.map(o=>[o.id,o]));
    state.demands.push(...ds);state.placements.push(...placements);state.done.add(info.face.id);
    setLayout(state,info,phase,lap,primary,extend,shared);
    const ps=new Map(placements.map(p=>[p.demandId,p]));
    for(const d of ds){
      const p=ps.get(d.id)!;
      if(p.kind==='new')state.inventory.push(...offcutsFrom(d,profile));
      else{
        const o=map.get(p.offcutId!);if(!o||state.used.has(o.id))throw new Error('Internal cut-set dependency conflict.');
        state.used.add(o.id);
        state.inventory.push(...offcutsFromMaterial(d,profile,materialAtDestination(o,p),o));
      }
    }
    if(state.demands.length>settings.maxSheets)throw new Error(`Sheet limit exceeded (${settings.maxSheets}).`);
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
  const seeds=[...leaders,...sorted.filter(i=>!leaders.includes(i)).slice(0,2)];
  const trials=Array.from({length:Math.min(settings.maxTrials,Math.max(1,seeds.length)*2)},(_,i)=>({seed:seeds[i%seeds.length],shift:Math.floor(i/seeds.length),extend:true}));

  function bestOffer(state:State,shift:number,extend:boolean):Offer|undefined {
    const unused=state.inventory.filter(o=>!state.used.has(o.id));
    const rootIds=[...new Set(unused.map(o=>o.rootBankId??o.sourceFaceId))];
    const offers=new Map<string,Offer>();
    for(const root of rootIds){
      const stock=unused.filter(o=>(o.rootBankId??o.sourceFaceId)===root);
      // Different cutting sites are not mixed just because their roots happen
      // to match. A+J may share a supply bank; C and its downstream recut G are
      // separate cutting operations, so G's valley set stays together.
      const sites=new Map<string,Offcut[]>();
      for(const o of stock){
        const siteBank=infos.find(i=>i.face.id===o.sourceFaceId)?.bank.id;
        const key=siteBank===root?root:o.sourceFaceId;
        const list=sites.get(key)??[];list.push(o);sites.set(key,list);
      }
      const pools:Offcut[][]=[];
      for(const site of sites.values()){
        const valley=site.filter(o=>o.cutKind==='valley'), hips=site.filter(o=>o.cutKind!=='valley');
        if(valley.length)pools.push(valley);if(hips.length)pools.push(hips);
        if(valley.length&&hips.length)pools.push(site);
      }
      for(const info of infos)if(!state.done.has(info.face.id) && !mains.has(info.face.id)){
        const primary=info.bank.id===root;
        const offsets=[...info.offsets];if(shift&&offsets.length>1)offsets.push(offsets.shift()!);
        const lapChoices:Lap[]=settings.optimiseLapDirections&&!info.face.lapLocked?[info.face.lap,info.face.lap===1?-1:1]:[info.face.lap];
        for(const phase of offsets)for(const lap of lapChoices){
          check();const ds=dsFor(info,phase,lap,primary,extend,primary);
          for(const pool of pools){
            const sharedRegistration=primary && pool.every(o=>infos.find(i=>i.face.id===o.sourceFaceId)?.bank.id===root);
            const match=matchCoherentSets(ds,pool,profile,check,sharedRegistration);
            if(!match.used.size||!match.cutArea)continue;
            const coverage=match.reusedArea/match.cutArea;
            // Straight fillers do not dilute angled coverage. Partial reuse in
            // the same elevation bank may create the bank's next primary strip.
            const extension=sharedRegistration && pool.some(o=>match.used.has(o.id)&&o.cutKind==='broken_hip');
            if(Math.max(coverage,(match.cutCount-match.newCutCount)/Math.max(1,match.cutCount))<(primary?.35:.60)||match.sourceUtilisation<.35)continue;
            if(sharedRegistration&&!extension&&(match.retainedFraction<.80||coverage<.70))continue;
            const score=(extension?2.5:0)+4*Math.min(1,coverage)+2*Math.min(1,match.sourceUtilisation)+2*Math.min(1,match.retainedFraction)
              +(match.newCutCount===0?.35:0)+Math.min(.25,match.reusedArea/Math.max(1,sorted[0].net)*.25)
              -(match.groupsUsed-1)*.015;
            const best=offers.get(info.face.id);
            if(!best||score>best.score+1e-8||Math.abs(score-best.score)<1e-8&&match.reusedArea>best.match.reusedArea)
              offers.set(info.face.id,{info,ds,phase,lap,primary,match,score});
          }
        }
      }
    }
    const ranked=[...offers.values()].sort((a,b)=>b.score-a.score||b.match.reusedArea-a.match.reusedArea||a.info.face.id.localeCompare(b.info.face.id));
    if(shift && ranked.length>1){
      const first=ranked[0], stockIds=first.match.used;
      const exactValley=state.inventory.filter(o=>stockIds.has(o.id)).every(o=>o.cutKind==='valley') && first.match.newCutCount===0 && first.match.retainedFraction>.95;
      // A variation changes an actual destination relationship, not just labels
      // or a random seed. Do not disturb near-exact valley complements.
      if(!exactValley && ranked[1].score>=first.score-.45)return ranked[1];
    }
    return ranked[0];
  }
  function selfFeed(state:State,onlyFace?:string):void {
    for(let pass=0;pass<2;pass++){
      let changed=false;
      for(const info of infos){
        if(onlyFace&&info.face.id!==onlyFace)continue;
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
          const match=matchCoherentSets(targets,stock,profile,check), proposed=match.placements.filter(p=>p.kind==='reuse');
          const saving=targets.filter(d=>proposed.some(p=>p.demandId===d.id)).reduce((n,d)=>n+area(d.blank),0);
          if(saving>bestSaving+1e-3){best=proposed;bestSaving=saving;}
        }
        if(!best?.length)continue;
        const next=state.placements.map(p=>best!.find(q=>q.demandId===p.demandId)??p);
        const rebuilt=rebuildInventory(state.demands,next,profile);
        if(rebuilt.unresolved.length)continue;
        state.placements=next;state.inventory=rebuilt.offcuts;state.used=new Set(next.filter(p=>p.kind==='reuse').map(p=>p.offcutId!));changed=true;
      }
      if(!changed)break;
    }
  }
  for(const trial of trials){
    const state=blankState();
    try{
      check();let next=trial.seed;
      while(state.done.size<faces.length){
        check();
        if(!next||state.done.has(next.face.id))next=sorted.find(i=>!state.done.has(i.face.id))!;
        const phase=next.offsets[trial.shift%Math.min(2,next.offsets.length)];
        const ds=dsFor(next,phase,next.face.lap,true,trial.extend);
        commit(state,next,ds,ds.map(d=>({demandId:d.id,kind:'new',rotation:0,translateY:0})),phase,next.face.lap,true,trial.extend);
        state.layout.primarySequence!.push(next.face.id);
        if(next.selfComplement)selfFeed(state,next.face.id);
        while(state.done.size<faces.length){
          const offer=bestOffer(state,trial.shift,trial.extend);if(!offer)break;
          commit(state,offer.info,offer.ds,offer.match.placements,offer.phase,offer.lap,offer.primary,trial.extend,offer.primary);
        }
        next=sorted.find(i=>!state.done.has(i.face.id))!;
      }
      selfFeed(state);completed++;hooks.onProgress?.(completed,trials.length);candidates.push(state);
    }catch(error){
      if(error instanceof Deadline){budgetReached=true;completeNew(state);candidates.push(state);break;}
      if(error instanceof Error&&/exceeds the profile maximum/.test(error.message)){continue;}
      throw error;
    }
  }
  if(!candidates.length)candidates.push(fallback);
  const cost=(state:State)=>state.demands.reduce((n,d)=>n+(state.placements.find(p=>p.demandId===d.id)?.kind==='new'?area(d.blank):0),0);
  const relationshipCount=(state:State)=>new Set(state.placements.filter(p=>p.kind==='reuse').map(p=>{
    const o=state.inventory.find(o=>o.id===p.offcutId)!,d=state.demands.find(d=>d.id===p.demandId)!;return`${o.sourceFaceId}->${d.faceId}`;
  })).size;
  candidates.sort((a,b)=>cost(a)-cost(b)||relationshipCount(a)-relationshipCount(b));
  // Simplicity wins within a small material band; it never hides supplied metal.
  const cheapest=cost(candidates[0]);
  const simple=[...candidates].filter(s=>cost(s)<=cheapest*1.03+1).sort((a,b)=>relationshipCount(a)-relationshipCount(b)||cost(a)-cost(b))[0];
  const ordered=[simple,...candidates.filter(c=>c!==simple)];
  const signatures=new Set<string>(), output:Solution[]=[];
  for(const state of ordered){
    if(cost(state)>cheapest*1.08+1)continue; // do not offer a materially poor rerun as an attractive variation
    const signature=fingerprint(faces.map(f=>{
      const ids=new Set(state.demands.filter(d=>d.faceId===f.id).map(d=>d.id));
      const ps=state.placements.filter(p=>ids.has(p.demandId));
      return[f.id,ps.filter(p=>p.kind==='new').length,[...new Set(ps.filter(p=>p.kind==='reuse').map(p=>state.inventory.find(o=>o.id===p.offcutId)!.sourceFaceId))].sort()];
    }));
    if(signatures.has(signature))continue;signatures.add(signature);
    const solution=toSolution(request,state,issues,completed,clock()-started,budgetReached);
    solution.layoutId=signature;solution.layoutLabel=output.length===0?'Suggested layout':`Alternative ${output.length}`;
    output.push(solution);if(output.length===3)break;
  }
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
  return{schemaVersion:1,engineVersion:'2.4',sourceRevision:roof.sourceRevision,facesRevision:fingerprint({faces,profile,settings}),
    profile:structuredClone(profile),settings:structuredClone(settings),demands:state.demands,placements:state.placements.sort((a,b)=>a.demandId.localeCompare(b.demandId)),
    offcuts:state.inventory,lapByFace:state.laps,bankLayout:state.layout,
    metrics:{newMaterialMm2:cost,baselineNewMaterialMm2:baseline,netRoofMm2:state.demands.reduce((n,d)=>n+area(d.cover),0),installedPhysicalMm2:installed,
      wasteMm2:cost-installed,savedMm2:baseline-cost,newSheetCount:fresh.size,reusedPieceCount:state.placements.length-fresh.size},
    search:{method:'material-banks',completedTrials:completed,elapsedMs:elapsed,budgetReached,provenOptimal:false},issues,status:'prototype-review',orderReady:false};
}
export function optimiseBanks(request:SolveRequest,hooks:SearchHooks={}):Solution{return optimiseBankLayouts(request,hooks)[0];}
