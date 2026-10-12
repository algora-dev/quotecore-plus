import { CERTIFICATE_INPUT_MODEL, certificateInputFingerprint } from './certificateInput';
/** V2.28: a replayable certificate for reversal across CONNECTED operations.
 * Unlike the paired-valley certificate, this does not require two ridge ends on
 * one receiver. Whole physical donor families may feed more than one face.
 * Every split, direct cut, descendant and fresh position remains explicit. */
import type { Issue, Solution, SolveRequest } from './types';
import { area } from './regions';
import { fingerprint } from './math';
import { planSignature } from './diagnostics';
import { rebuildInventory } from './inventory';
import { rootSheetLedger } from './purchaseLedger';
import { physicalCutFamilies, pairedPhysicalFingerprint, receiverFactoryDatum } from './pairedReceiverFamilies';
import { transferRuns } from './familyAlignment';

export const CONNECTED_DONOR_MODEL = 'connected-donor-reversal-v1' as const;
export interface MaterialRoute { sourceFaceId:string; receiverFaceId:string; positions:number }
export interface ConnectedReversalScope {
  donorFaceIds:string[]; receiverFaceIds:string[]; retiredOperationIds:string[];
  /** Exact prior root routes, not inferred from drawing colours. */
  referenceRoutes:MaterialRoute[];
}
export interface ConnectedDonorCertificate {
  model:typeof CONNECTED_DONOR_MODEL; inputModel:typeof CERTIFICATE_INPUT_MODEL; inputFingerprint:string; referenceLayoutId:string;
  scope:ConnectedReversalScope;
  runs:Array<{donorFaceId:string;receiverFaceId:string;cutSetId:string;offcutIds:string[];
    sourceLanes:number[];receiverDemandIds:string[];receiverLanes:number[];rotation:0|180;
    factoryEdgeMm:number}>;
  families:Array<{familyId:string;donorFaceId:string;offcutIds:string[];
    receiverDemandIds:Array<string|null>;completeToReversedReceivers:boolean}>;
  coverage:Array<{faceId:string;freshDemandIds:string[];directDonorDemandIds:string[];
    descendantDemandIds:string[];otherSourceDemandIds:string[]}>;
  dependencyOrder:string[]; physicalFingerprint:string; purchasedSheets:number;
  purchasedLinealM:number; siteSetoutConfirmed:false;
}
function fail(code:string):never{throw new Error(code);}
export function materialRoutes(s:Solution):MaterialRoute[]{
  const dm=new Map(s.demands.map(d=>[d.id,d])),om=new Map(s.offcuts.map(o=>[o.id,o]));
  const routes=new Map<string,MaterialRoute>();
  for(const p of s.placements){
    if(p.kind!=='reuse')continue;
    const cut=om.get(p.offcutId??''),dest=dm.get(p.demandId);
    const source=cut?dm.get(cut.rootDemandId??cut.sourceDemandId):undefined;
    if(!source||!dest||source.faceId===dest.faceId)continue;
    const key=source.faceId+'>'+dest.faceId,entry=routes.get(key)??{sourceFaceId:source.faceId,receiverFaceId:dest.faceId,positions:0};
    entry.positions++;routes.set(key,entry);
  }
  return [...routes.values()].sort((a,b)=>a.sourceFaceId.localeCompare(b.sourceFaceId)||a.receiverFaceId.localeCompare(b.receiverFaceId));
}
/** Used again at the worker/UI boundary to bind the claimed reversal to the
 * exact selected reference. It is not an authorization or pricing credential. */
export function connectedReversalReferenceMatches(previous:Solution,next:Solution):boolean{
  const c=next.installationPlan?.connectedReversal;if(!c)return true;
  try {
    if(c.referenceLayoutId!==planSignature(previous)||fingerprint(c.scope.referenceRoutes)!==fingerprint(materialRoutes(previous)))return false;
    const operations=previous.bankLayout?.primaryOperations??[];
    const retired=operations.filter(op=>c.scope.retiredOperationIds.includes(op.id));
    if(!retired.length||retired.length!==c.scope.retiredOperationIds.length)return false;
    const receivers=[...new Set(retired.flatMap(op=>op.faceIds))].sort();
    return fingerprint([...c.scope.receiverFaceIds].sort())===fingerprint(receivers)&&
      retired.every(op=>c.scope.referenceRoutes.some(route=>c.scope.donorFaceIds.includes(route.receiverFaceId)&&op.faceIds.includes(route.sourceFaceId)&&route.positions>=2))&&
      c.scope.donorFaceIds.every(id=>!receivers.includes(id)&&c.scope.referenceRoutes.some(route=>route.receiverFaceId===id&&receivers.includes(route.sourceFaceId)&&route.positions>=2));
  } catch { return false; }
}
export function deriveConnectedDonorCertificate(r:SolveRequest,s:Solution,scope:ConnectedReversalScope,referenceLayoutId:string):ConnectedDonorCertificate{
  const plan=s.installationPlan,faceIds=new Set(r.faces.map(f=>f.id));
  if(!plan||plan.kind!=='reversed-donors'||!s.bankLayout||plan.pairedReceiver)fail('invalid-connected-plan');
  if(!scope||!Array.isArray(scope.donorFaceIds)||!scope.donorFaceIds.length||scope.donorFaceIds.length>4||
    !Array.isArray(scope.receiverFaceIds)||!scope.receiverFaceIds.length||scope.receiverFaceIds.length>r.faces.length||
    !Array.isArray(scope.retiredOperationIds)||!scope.retiredOperationIds.length||scope.retiredOperationIds.length>r.faces.length||
    !Array.isArray(scope.referenceRoutes)||scope.referenceRoutes.length>r.faces.length*r.faces.length)fail('invalid-connected-scope');
  const donors=new Set(scope.donorFaceIds),receivers=new Set(scope.receiverFaceIds);
  if(donors.size!==scope.donorFaceIds.length||receivers.size!==scope.receiverFaceIds.length||
    [...donors,...receivers].some(id=>!faceIds.has(id))||[...donors].some(id=>receivers.has(id))||
    fingerprint(plan.donorFaceIds)!==fingerprint(scope.donorFaceIds)||fingerprint(plan.receiverFaceIds)!==fingerprint(scope.receiverFaceIds)||
    referenceLayoutId!==plan.referenceLayoutId)fail('inconsistent-connected-scope');
  if(scope.referenceRoutes.some(row=>!faceIds.has(row.sourceFaceId)||!faceIds.has(row.receiverFaceId)||
    row.sourceFaceId===row.receiverFaceId||!Number.isInteger(row.positions)||row.positions<1)||
    [...donors].some(id=>!scope.referenceRoutes.some(row=>row.receiverFaceId===id&&receivers.has(row.sourceFaceId)&&row.positions>=2)))fail('missing-prior-donor-relationship');
  const dm=new Map(s.demands.map(d=>[d.id,d])),pm=new Map(s.placements.map(p=>[p.demandId,p])),om=new Map(s.offcuts.map(o=>[o.id,o]));
  for(const id of donors){
    const ds=s.demands.filter(d=>d.faceId===id);
    if(!ds.length||ds.some(d=>pm.get(d.id)?.kind!=='new')||!s.bankLayout.primaryOperations?.some(op=>op.faceIds.includes(id)))fail('donor-not-fresh-primary-bank');
  }
  const rebuilt=rebuildInventory(s.demands,s.placements,s.profile);
  if(rebuilt.unresolved.length||fingerprint([...rebuilt.offcuts].sort((a,b)=>a.id.localeCompare(b.id)))!==fingerprint([...s.offcuts].sort((a,b)=>a.id.localeCompare(b.id))))fail('stale-connected-inventory');
  const ledger=rootSheetLedger(s);if(!ledger.valid)fail('connected-stock-not-conserved');
  const incoming=s.placements.filter(p=>p.kind==='reuse'&&receivers.has(dm.get(p.demandId)?.faceId??'')&&donors.has(om.get(p.offcutId??'')?.sourceFaceId??''));
  const runs=transferRuns(incoming,dm,om).map(ps=>{
    const first=ps[0],o=om.get(first.offcutId!)!,d=dm.get(first.demandId)!;
    const ys=ps.map(p=>receiverFactoryDatum(om.get(p.offcutId!)!,p,dm.get(p.demandId)!));
    if(Math.max(...ys)-Math.min(...ys)>.001)fail('unaligned-connected-family');
    return{donorFaceId:o.sourceFaceId,receiverFaceId:d.faceId,cutSetId:o.cutSetId??'',offcutIds:ps.map(p=>p.offcutId!),
      sourceLanes:ps.map(p=>om.get(p.offcutId!)!.sourceLaneIndex!),receiverDemandIds:ps.map(p=>p.demandId),
      receiverLanes:ps.map(p=>dm.get(p.demandId)!.laneIndex),rotation:first.rotation,factoryEdgeMm:ys[0]};
  });
  // At least one full, maximal eligible source family per donor must be used
  // in the retired territory. A few scattered scraps never certify a reversal.
  const uses=new Map(incoming.map(p=>[p.offcutId,p.demandId]));
  const families=physicalCutFamilies(s,scope.donorFaceIds).map(f=>({familyId:f.id,donorFaceId:f.donorFaceId,
    offcutIds:f.pieces.map(o=>o.id),receiverDemandIds:f.pieces.map(o=>uses.get(o.id)??null),
    completeToReversedReceivers:f.pieces.every(o=>uses.has(o.id))}));
  for(const id of donors)if(!families.some(f=>f.donorFaceId===id&&f.completeToReversedReceivers)||
    !runs.some(run=>run.donorFaceId===id&&run.offcutIds.length>=2))fail('incomplete-connected-donor-family');
  for(const id of receivers)if(runs.filter(run=>run.receiverFaceId===id).length>4)fail('fragmented-connected-receiver');
  const coverage=scope.receiverFaceIds.map(faceId=>{
    const freshDemandIds:string[]=[],directDonorDemandIds:string[]=[],descendantDemandIds:string[]=[],otherSourceDemandIds:string[]=[];
    for(const d of s.demands.filter(d=>d.faceId===faceId)){
      const p=pm.get(d.id);if(!p)fail('connected-coverage-deficit');
      if(p!.kind==='new'){freshDemandIds.push(d.id);continue;}
      const o=om.get(p!.offcutId??'');if(!o)fail('missing-connected-stock');
      const root=dm.get(o!.rootDemandId??o!.sourceDemandId);
      if(donors.has(o!.sourceFaceId)&&!o!.parentOffcutId)directDonorDemandIds.push(d.id);
      else if(root&&donors.has(root.faceId))descendantDemandIds.push(d.id);
      else otherSourceDemandIds.push(d.id);
    }
    return{faceId,freshDemandIds,directDonorDemandIds,descendantDemandIds,otherSourceDemandIds};
  });
  if(coverage.some(row=>!row.directDonorDemandIds.length&&!row.descendantDemandIds.length))fail('receiver-has-no-reversed-material');
  const order:string[]=[],done=new Set<string>(),pending=[...s.placements];
  while(pending.length){let progress=false;
    for(let i=0;i<pending.length;){const p=pending[i],source=om.get(p.offcutId??'')?.sourceDemandId;
      if(p.kind==='new'||source&&done.has(source)){order.push(p.demandId);done.add(p.demandId);pending.splice(i,1);progress=true;}else i++;
    }
    if(!progress)fail('connected-installation-dependency-cycle');
  }
  // Check totals against the physical ledger independently of saved metrics.
  if(ledger.totals.newSheets!==s.metrics.newSheetCount||Math.abs(ledger.totals.purchasedLinealM-
    s.metrics.newMaterialMm2/(r.profile.coverMm+r.profile.leftLapMm+r.profile.rightLapMm)/1000)>1e-6)fail('connected-purchase-mismatch');
  return{model:CONNECTED_DONOR_MODEL,inputModel:CERTIFICATE_INPUT_MODEL,inputFingerprint:certificateInputFingerprint(r),referenceLayoutId,
    scope:structuredClone(scope),runs,families,coverage,dependencyOrder:order,physicalFingerprint:pairedPhysicalFingerprint(s),
    purchasedSheets:ledger.totals.newSheets,purchasedLinealM:ledger.totals.purchasedLinealM,siteSetoutConfirmed:false};
}
export function validateConnectedDonorCertificate(r:SolveRequest,s:Solution):Issue[]{
  const c=s.installationPlan?.connectedReversal;if(!c)return[];
  try{
    if(c.model!==CONNECTED_DONOR_MODEL)fail('invalid-connected-certificate');
    const actual=deriveConnectedDonorCertificate(r,s,c.scope,c.referenceLayoutId);
    if(fingerprint(actual)!==fingerprint(c))fail('stale-connected-certificate');
    return[];
  }catch(e){return[{severity:'error',code:'CONNECTED_DONOR_FAMILY',message:e instanceof Error?e.message:'malformed-connected-certificate'}];}
}
/** Larger genuine reused area, not number of slivers, describes contribution. */
export function connectedCoverageScore(s:Solution):number{
  const c=s.installationPlan?.connectedReversal;if(!c)return 0;
  const ids=new Set(c.coverage.flatMap(row=>[...row.directDonorDemandIds,...row.descendantDemandIds]));
  return s.demands.filter(d=>ids.has(d.id)).reduce((n,d)=>n+area(d.required),0)/1e6;
}
