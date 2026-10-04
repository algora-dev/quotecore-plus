/** Optional post-plan salvage. This is not another bank optimiser.
 * Only complete, unused physical pieces may replace terminal rectangular fresh
 * fillers. Sources, grids, receiver certificates and all other placements stay put.
 */
import type { Demand, Issue, Offcut, Placement, Solution } from './types';
import { area, bounds, extendY, rectangle, subtract } from './regions';
import { fingerprint } from './math';
import { rebuildInventory, materialAtDestination } from './inventory';
import { recalculateMetrics } from './receiverSafety';
import { planSignature } from './diagnostics';

export const SALVAGE_POLICY = Object.freeze({
  model: 'terminal-filler-salvage-v1' as const,
  minGroupSavingM2: 5, minGroupSheets: 2, maxGroupSheets: 16,
  maxGroups: 2, maxSourceGeneration: 1, maxFitChecks: 20000,
  maxCandidates: 80, maxFinalChecks: 20, defaultMilliseconds: 5000, maxMilliseconds: 10000,
});
export interface SalvageReplacement {
  demandId: string; offcutId: string; sourceDemandId: string; sourceFaceId: string;
  rootDemandId: string; sourceLaneIndex: number; destinationLaneIndex: number;
  sourceGeneration: number; rotation: 0|180; translateY: number;
  sourceLap: -1|1; destinationLap: -1|1;
  /** Finished full-physical-width rectangle, including the configured end allowance. */
  finishedLengthMm: number; orderedLengthRemovedMm: number;
  sourceLongestMm: number; physicalWidthMm: number; coverMm: number;
}
export interface SalvageGroup {
  id: string; sourceFaceId: string; destinationFaceId: string; sourceSetId: string;
  replacements: SalvageReplacement[]; savedSheets: number; savedLinealM: number; savedCoverAreaM2: number;
  /** Topological source ancestors in cut-first order; no promise that whole faces need be installed. */
  prerequisiteFaceIds: string[];
}
export interface SalvageCertificate {
  model: typeof SALVAGE_POLICY.model; baseLayoutId: string; basePhysicalFingerprint: string;
  baseObjective: Solution['objective']; baseLabel: string; baseEngineVersion: Solution['engineVersion'];
  groups: SalvageGroup[]; savedSheets: number; savedLinealM: number; savedCoverAreaM2: number;
  /** Fixed nominal source setout, not a guarantee for arbitrary site phase changes. */
  setoutBasis: 'preserve-base-source-cuts-and-laps';
}
export interface SalvageEligibility {
  eligible: boolean; sourcePieceCount: number; fillerPositionCount: number;
  reason: string;
}
export interface SalvageSearchReport {
  model: typeof SALVAGE_POLICY.model; baseLayoutId: string; basePhysicalFingerprint: string;
  status: 'found'|'no-worthwhile-reuse'; reason: string;
  sourcePieceCount: number; fillerPositionCount: number;
  fitChecks: number; groupsFound: number; finalChecks: number; elapsedMs: number; budgetReached: boolean;
  rejections: Record<string,number>; policy: typeof SALVAGE_POLICY;
}
export interface SalvageResult { status: 'found'|'no-worthwhile-reuse'; solution: Solution|null; report: SalvageSearchReport }
export function salvagePhysicalFingerprint(s:Solution):string {
  return fingerprint({sourceRevision:s.sourceRevision,facesRevision:s.facesRevision,profile:s.profile,settings:s.settings,
    demands:[...s.demands].sort((a,b)=>a.id.localeCompare(b.id)),placements:[...s.placements].sort((a,b)=>a.demandId.localeCompare(b.demandId)),
    bankLayout:s.bankLayout,lapByFace:s.lapByFace,receiverSafety:s.receiverSafety});
}
function fullRectangle(d:Demand):boolean {
  const b=bounds(d.required);
  return Number.isFinite(area(d.required))&&b.maxY>b.minY&&Math.abs(b.minX)<1e-6&&Math.abs(b.maxX-d.widthMm)<1e-6&&
    area(subtract(rectangle(0,b.minY,d.widthMm,b.maxY),d.required))<=.001;
}
/** Even pieces unused nominally may be reserved for another valley phase. Never
 * offer those, or descendants of phase-dependent receiver cuts, as free stock. */
export function phaseProtectedIds(s:Solution):Set<string> {
  const result=new Set<string>(),receiverFaces=new Set<string>();
  for(const f of s.receiverSafety?.families??[]){
    f.faceIds.forEach(id=>receiverFaces.add(id));f.sourceOffcutIds.forEach(id=>result.add(id));
    for(const sc of f.scenarios)for(const p of sc.reuse)if(p.offcutId)result.add(p.offcutId);
  }
  for(const o of s.offcuts)if(receiverFaces.has(o.sourceFaceId))result.add(o.id);
  for(let n=0;n<=s.offcuts.length;n++){
    let added=false;for(const o of s.offcuts)if(o.parentOffcutId&&result.has(o.parentOffcutId)&&!result.has(o.id)){result.add(o.id);added=true;}
    if(!added)break;
  }
  return result;
}
export function terminalFillerIds(s:Solution):Set<string> {
  const used=new Set(s.placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId));
  const protectedPieces=phaseProtectedIds(s),donors=new Set(s.offcuts.filter(o=>used.has(o.id)||protectedPieces.has(o.id)).map(o=>o.rootDemandId??o.sourceDemandId));
  const receiverFaces=new Set((s.receiverSafety?.families??[]).flatMap(f=>f.faceIds));
  const self=new Set(s.bankLayout?.selfFillFaceIds??[]),pm=new Map(s.placements.map(p=>[p.demandId,p]));
  return new Set(s.demands.filter(d=>{
    const p=pm.get(d.id);
    if(!p||p.kind!=='new'||p.manual||donors.has(d.id)||self.has(d.faceId)||receiverFaces.has(d.faceId)||d.stockRole==='primary-cut')return false;
    // Generated demands carry explicit cut metadata. Legacy missing metadata is
    // not evidence of a straight filler. A ridge at ONE end is not enough.
    if(!d.cutEdges||d.cutEdges.length||d.reusableCut!==false||!fullRectangle(d))return false;
    return d.stockRole==='filler'||d.stockRole==='supplement'||d.zoneRole==='ridge-fill';
  }).map(d=>d.id));
}
export function unusedSalvagePieces(s:Solution):Offcut[] {
  const used=new Set(s.placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId)),protectedIds=phaseProtectedIds(s);
  const pm=new Map(s.placements.map(p=>[p.demandId,p]));
  return s.offcuts.filter(o=>!used.has(o.id)&&!protectedIds.has(o.id)&&!pm.get(o.sourceDemandId)?.manual&&
    !pm.get(o.rootDemandId??o.sourceDemandId)?.manual&&o.cutSetId&&o.sourceLaneIndex!==undefined&&
    (o.generation??0)<=SALVAGE_POLICY.maxSourceGeneration&&area(o.region)>1);
}
export function salvageEligibility(s:Solution):SalvageEligibility {
  if(s.salvage)return{eligible:false,sourcePieceCount:0,fillerPositionCount:0,reason:'This is already a more-reuse version. Select its original plan to compare.'};
  if(s.status==='invalid'||s.issues.some(i=>i.severity==='error')||s.decisionTrace?.historic||s.placements.some(p=>p.manual))return{eligible:false,sourcePieceCount:0,fillerPositionCount:0,reason:'Use a valid, unedited base plan first.'};
  const sources=unusedSalvagePieces(s),ids=terminalFillerIds(s),byFace=new Map<string,Demand[]>();
  for(const d of s.demands.filter(d=>ids.has(d.id))){const rows=byFace.get(d.faceId)??[];rows.push(d);byFace.set(d.faceId,rows);}
  const eligible=sources.length>=SALVAGE_POLICY.minGroupSheets&&[...byFace.values()].some(rows=>{
    rows.sort((a,b)=>a.laneIndex-b.laneIndex);let count=0,sum=0,prev=-2;
    return rows.some(d=>{if(d.laneIndex!==prev+1){count=0;sum=0;}count++;prev=d.laneIndex;const b=bounds(d.blank);sum+=(b.maxY-b.minY)*s.profile.coverMm/1e6;
      return count>=SALVAGE_POLICY.minGroupSheets&&sum>=SALVAGE_POLICY.minGroupSavingM2;});
  });
  return{eligible,sourcePieceCount:sources.length,fillerPositionCount:ids.size,reason:eligible?'Unused cuts and a worthwhile filler run are available to check; fit is not yet proven.':'No sizeable eligible filler run and unused cut batch found.'};
}
/** Face dependencies are deliberately conservative: salvage cannot make a roofer
 * wait for a source face whose material already depends on the destination. */
export function faceDependencies(s:Solution,extra:Placement[]=[]):Map<string,Set<string>> {
  const ds=new Map(s.demands.map(d=>[d.id,d])),os=new Map(s.offcuts.map(o=>[o.id,o])),g=new Map<string,Set<string>>();
  for(const p of [...s.placements,...extra])if(p.kind==='reuse'){
    const a=os.get(p.offcutId??'')?.sourceFaceId,b=ds.get(p.demandId)?.faceId;
    if(a&&b&&a!==b){const targets=g.get(a)??new Set<string>();targets.add(b);g.set(a,targets);}
  }
  return g;
}
export function hasPath(g:Map<string,Set<string>>,from:string,to:string,seen=new Set<string>()):boolean {
  if(from===to)return true;if(seen.has(from))return false;seen.add(from);
  return [...g.get(from)??[]].some(n=>hasPath(g,n,to,seen));
}
export function sourcePrerequisites(s:Solution,source:string):string[] {
  const g=faceDependencies(s),done=new Set<string>(),active=new Set<string>(),order:string[]=[];
  const visit=(id:string)=>{if(done.has(id))return;if(active.has(id))throw new Error('Existing face sequence has a cycle.');active.add(id);
    for(const [a,bs]of g)if(bs.has(id))visit(a);active.delete(id);done.add(id);order.push(id);};
  visit(source);return order;
}
export function salvageGroup(s:Solution,placements:Placement[]):SalvageGroup {
  if(!placements.length)throw new Error('No salvage placements.');
  const ds=new Map(s.demands.map(d=>[d.id,d])),os=new Map(s.offcuts.map(o=>[o.id,o]));
  const replacements=placements.map(p=>{
    const d=ds.get(p.demandId)!,o=os.get(p.offcutId!)!,r=bounds(d.required),b=bounds(d.blank),ob=bounds(o.region);
    return {demandId:d.id,offcutId:o.id,sourceDemandId:o.sourceDemandId,sourceFaceId:o.sourceFaceId,rootDemandId:o.rootDemandId??o.sourceDemandId,
      sourceLaneIndex:o.sourceLaneIndex!,destinationLaneIndex:d.laneIndex,sourceGeneration:o.generation??0,rotation:p.rotation,translateY:p.translateY,
      sourceLap:o.lap,destinationLap:d.lap,finishedLengthMm:r.maxY-r.minY,orderedLengthRemovedMm:b.maxY-b.minY,
      sourceLongestMm:ob.maxY-ob.minY,physicalWidthMm:d.widthMm,coverMm:s.profile.coverMm};
  }).sort((a,b)=>a.destinationLaneIndex-b.destinationLaneIndex);
  const sourceFaceId=replacements[0].sourceFaceId,destinationFaceId=ds.get(replacements[0].demandId)!.faceId;
  const savedLinealM=replacements.reduce((n,r)=>n+r.orderedLengthRemovedMm/1000,0);
  return{id:'salvage:'+fingerprint(replacements),sourceFaceId,destinationFaceId,sourceSetId:os.get(replacements[0].offcutId)!.cutSetId!,replacements,
    savedSheets:replacements.length,savedLinealM,savedCoverAreaM2:savedLinealM*s.profile.coverMm/1000,
    prerequisiteFaceIds:sourcePrerequisites(s,sourceFaceId)};
}
export function reconstructedSalvageBase(s:Solution):Solution {
  if(!s.salvage)throw new Error('No salvage certificate.');const c=s.salvage,base=structuredClone(s);
  const ids=new Set(c.groups.flatMap(g=>g.replacements.map(r=>r.demandId)));
  base.placements=base.placements.map(p=>ids.has(p.demandId)?{demandId:p.demandId,kind:'new',rotation:0,translateY:0}:p);
  delete base.salvage;delete base.comparison;
  base.engineVersion=c.baseEngineVersion;base.objective=c.baseObjective;base.layoutLabel=c.baseLabel;
  base.offcuts=rebuildInventory(base.demands,base.placements,base.profile).offcuts;recalculateMetrics(base);base.layoutId=planSignature(base);return base;
}
/** Called on every validation/import/export, not just after the worker search.
 * Reconstruct the actual unmodified base and prove that only permitted terminal
 * fresh roots were removed. Never trust report numbers or display colours. */
export function validateSalvageCertificate(s:Solution):Issue[] {
  if(!s.salvage)return[];
  const fail=(message:string):Issue[]=>[{severity:'error',code:'SALVAGE_CERTIFICATE',message:'More-reuse plan: '+message}];
  try{
    const c=s.salvage;
    if(c.model!==SALVAGE_POLICY.model||c.setoutBasis!=='preserve-base-source-cuts-and-laps'||!Array.isArray(c.groups)||!c.groups.length||c.groups.length>SALVAGE_POLICY.maxGroups)return fail('invalid reuse certificate.');
    const base=reconstructedSalvageBase(s);
    if(salvagePhysicalFingerprint(base)!==c.basePhysicalFingerprint||planSignature(base)!==c.baseLayoutId)return fail('the original physical plan no longer matches.');
    const ids=terminalFillerIds(base),sources=new Map(unusedSalvagePieces(base).map(o=>[o.id,o])),ds=new Map(base.demands.map(d=>[d.id,d])),pm=new Map(s.placements.map(p=>[p.demandId,p]));
    const used=new Set<string>(),targets=new Set<string>(),extra:Placement[]=[];let lm=0,n=0;
    for(const group of c.groups){
      if(!Array.isArray(group.replacements)||group.replacements.length<SALVAGE_POLICY.minGroupSheets||group.replacements.length>SALVAGE_POLICY.maxGroupSheets)return fail('reuse must be a worthwhile contiguous group.');
      const ps:Placement[]=[];let prev:number|undefined,sourceStep:number|undefined,previousSource:number|undefined;
      for(const r of group.replacements){
        const d=ds.get(r.demandId),o=sources.get(r.offcutId),p=pm.get(r.demandId);
        if(!d||!o||!p||p.manual||p.kind!=='reuse'||p.offcutId!==o.id||!ids.has(d.id)||used.has(o.id)||targets.has(d.id))return fail('a donor, protected starter, spent piece or duplicate position was used.');
        if(d.faceId!==group.destinationFaceId||o.sourceFaceId!==group.sourceFaceId||o.cutSetId!==group.sourceSetId||o.sourceFaceId===d.faceId)return fail('group source/destination changed.');
        if(prev!==undefined&&d.laneIndex!==prev+1)return fail('filler replacements are scattered.');prev=d.laneIndex;
        if(previousSource!==undefined){const step=o.sourceLaneIndex!-previousSource;if(Math.abs(step)!==1||(sourceStep!==undefined&&sourceStep!==step))return fail('source sheets are not one ordered batch.');sourceStep=step;}previousSource=o.sourceLaneIndex;
        if(ps.length&&p.rotation!==ps[0].rotation)return fail('one batch has inconsistent rotation.');
        if(area(subtract(extendY(d.required,s.profile.cutGapMm),materialAtDestination(o,p)))>.001)return fail('insufficient full-width stock including trim clearance.');
        used.add(o.id);targets.add(d.id);ps.push(p);extra.push(p);
      }
      const expected=salvageGroup(base,ps);
      if(fingerprint(expected)!==fingerprint(group)||expected.savedCoverAreaM2+1e-8<SALVAGE_POLICY.minGroupSavingM2)return fail('group quantities or instructions do not match the real pieces.');
      const graph=faceDependencies(base,extra);
      if(hasPath(graph,group.destinationFaceId,group.sourceFaceId))return fail('the cutting sequence is circular.');
      lm+=expected.savedLinealM;n+=expected.savedSheets;
    }
    if(c.savedSheets!==n||Math.abs(c.savedLinealM-lm)>1e-7||Math.abs(c.savedCoverAreaM2-lm*s.profile.coverMm/1000)>1e-7)return fail('savings do not match removed purchased sheets.');
    return[];
  }catch{return fail('malformed or stale reuse data; regenerate from the original plan.');}
}
