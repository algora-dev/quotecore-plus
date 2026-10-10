/** V2.18 end-specific purchase refinement. This does NOT reallocate sheets,
 * change receiver starters, consume scrap, change triangles or remove columns.
 * It only removes unproductive square stock while retaining every generated cut.
 * Canonical generation + the full existing validator remain authoritative. */
import type { Demand, Issue, Solution, SolveRequest } from './types';
import { bounds } from './regions';
import { fingerprint } from './math';
import { generateDemands, offcutsFrom } from './material';
import { proposeStockEnds, samePhysicalCuts, STOCK_END_MODEL, STOCK_END_POLICY } from './stockEnds';
import { rebuildInventory } from './inventory';
import { recalculateMetrics } from './receiverSafety';
import { planSignature } from './diagnostics';

export interface StockLengthRow {
  demandId:string;faceId:string;laneIndex:number;beforeLengthMm:number;afterLengthMm:number;
  upstreamRemovedMm:number;downstreamRemovedMm:number;preservedOffcutIds:string[];
  upstreamUseful:boolean;downstreamUseful:boolean;savedLinealM:number;savedCoverM2:number;
}
export interface StockLengthReport {
  model:typeof STOCK_END_MODEL;status:'improved'|'unchanged'|'rejected';reason:string;
  examinedPurchases:number;changedSheets:number;savedLinealM:number;savedCoverM2:number;
  beforeLinealM:number;afterLinealM:number;beforeCoverM2:number;afterCoverM2:number;
  placementsUnchanged:boolean;offcutsUnchanged:boolean;receiverSafetyUnchanged:boolean;
  elapsedMs:number;budgetReached:boolean;rows:StockLengthRow[];rejectionCodes:string[];
}
/** UI/export quantities come from current physical blanks/proofs, not a report. */
export function stockLengthRows(s:Solution):StockLengthRow[]{
  const fresh=new Set(s.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
  return s.demands.filter(d=>fresh.has(d.id)&&d.stockEndProof).map(d=>{
    const proof=d.stockEndProof!,a=bounds(proof.originalBlank),b=bounds(d.blank);
    const before=a.maxY-a.minY,after=b.maxY-b.minY,saved=(before-after)/1000;
    return{demandId:d.id,faceId:d.faceId,laneIndex:d.laneIndex,beforeLengthMm:before,afterLengthMm:after,
      upstreamRemovedMm:proof.upstreamRemovedMm,downstreamRemovedMm:proof.downstreamRemovedMm,
      preservedOffcutIds:[...proof.preservedOffcutIds],upstreamUseful:!!proof.usefulUpstreamCutIds.length,
      downstreamUseful:!!proof.usefulDownstreamCutIds.length,savedLinealM:saved,savedCoverM2:saved*s.profile.coverMm/1000};
  });
}
const lineals=(s:Solution)=>{const ids=new Set(s.placements.filter(p=>p.kind==='new').map(p=>p.demandId));return s.demands.filter(d=>ids.has(d.id)).reduce((n,d)=>{const b=bounds(d.blank);return n+(b.maxY-b.minY)/1000;},0);};
export function refinePurchasedStock(request:SolveRequest,incumbent:Solution,validate:(s:Solution)=>Issue[],hooks:{now?:()=>number;shouldCancel?:()=>boolean}={}):{solution:Solution;report:StockLengthReport}{
  const clock=hooks.now??(()=>performance.now()),start=clock(),before=lineals(incumbent),cover=request.profile.coverMm/1000;
  const report:StockLengthReport={model:STOCK_END_MODEL,status:'unchanged',reason:'no-safe-square-end-reduction',examinedPurchases:0,
    changedSheets:0,savedLinealM:0,savedCoverM2:0,beforeLinealM:before,afterLinealM:before,beforeCoverM2:before*cover,afterCoverM2:before*cover,
    placementsUnchanged:true,offcutsUnchanged:true,receiverSafetyUnchanged:true,elapsedMs:0,budgetReached:false,rows:[],rejectionCodes:[]};
  const finish=(s=incumbent)=>{report.elapsedMs=Math.max(0,clock()-start);return{solution:s,report};};
  const cancel=()=>{if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');};
  cancel();
  if(incumbent.bankLayout?.stockEndRefinement){report.reason='already-canonically-refined';return finish();}
  if(request.settings.stockMode!=='bank-first'||!incumbent.bankLayout||incumbent.salvage||incumbent.placements.some(p=>p.manual)||incumbent.status==='invalid'||incumbent.decisionTrace?.historic){report.reason='protected-or-ineligible-plan';return finish();}
  try{
    if(validate(incumbent).some(i=>i.severity==='error')){report.reason='invalid-incumbent';return finish();}
    const original=generateDemands(request.roof,request.faces,request.profile,request.settings,incumbent.bankLayout).map(d=>({...d,lap:incumbent.lapByFace[d.faceId]}));
    if(fingerprint(original)!==fingerprint(incumbent.demands)){report.reason='noncanonical-incumbent';return finish();}
    const layout=incumbent.bankLayout,fresh=new Set(incumbent.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
    const protectedIds=new Set(incumbent.receiverSafety?.families.flatMap(f=>f.freshDemandIds)??[]),targets:string[]=[];
    for(const d of incumbent.demands){
      cancel();if(clock()-start>STOCK_END_POLICY.maxMilliseconds){report.budgetReached=true;break;}
      if(!fresh.has(d.id)||!layout.primaryFaceIds.includes(d.faceId)||layout.selfFillFaceIds?.includes(d.faceId)||protectedIds.has(d.id)||layout.receiverStockLengthByFace?.[d.faceId]!==undefined)continue;
      report.examinedPurchases++;
      if(proposeStockEnds(d,incumbent.profile,layout.extraLengthByFace[d.faceId]??0,layout.tailExtensionByFace?.[d.faceId]??0,offcutsFrom))targets.push(d.id);
    }
    if(!targets.length)return finish();
    cancel();
    const trial=structuredClone(incumbent);
    trial.bankLayout!.stockEndRefinement={model:STOCK_END_MODEL,demandIds:targets};
    trial.demands=generateDemands(request.roof,request.faces,request.profile,request.settings,trial.bankLayout).map(d=>({...d,lap:trial.lapByFace[d.faceId]}));
    const shape=(ds:Demand[])=>ds.map(({blank:_blank,stockEndProof:_proof,...d})=>d);
    if(fingerprint(shape(trial.demands))!==fingerprint(shape(incumbent.demands)))throw new Error('Installed lane geometry changed.');
    const rebuilt=rebuildInventory(trial.demands,trial.placements,trial.profile);
    if(rebuilt.unresolved.length||!samePhysicalCuts(incumbent.offcuts,rebuilt.offcuts))throw new Error('A required or unused offcut/descendant changed.');
    trial.offcuts=rebuilt.offcuts;recalculateMetrics(trial);
    report.placementsUnchanged=fingerprint(trial.placements)===fingerprint(incumbent.placements);
    report.receiverSafetyUnchanged=fingerprint(trial.receiverSafety)===fingerprint(incumbent.receiverSafety);
    if(!report.placementsUnchanged||!report.receiverSafetyUnchanged)throw new Error('Cut sequence or receiver certificate changed.');
    trial.engineVersion='2.23';
    const failures=validate(trial).filter(i=>i.severity==='error');
    if(failures.length){report.status='rejected';report.reason='failed-final-physical-check';report.rejectionCodes=[...new Set(failures.map(i=>i.code))];return finish();}
    const after=lineals(trial);if(after>=before-1e-7)return finish();
    report.status='improved';report.reason='same-cuts-shorter-square-ended-stock';report.afterLinealM=after;report.afterCoverM2=after*cover;
    report.savedLinealM=before-after;report.savedCoverM2=(before-after)*cover;report.rows=stockLengthRows(trial);report.changedSheets=report.rows.length;
    trial.layoutId=planSignature(trial);trial.stockLengthRefinement=report;
    // No old error is hidden by the refinement. Current checks were just run;
    // retain all informational/order-review warnings from the incumbent.
    trial.issues=trial.issues.filter(i=>i.severity==='warning');trial.status='prototype-review';trial.orderReady=false;
    return finish(trial);
  }catch(e){
    cancel();report.status='rejected';report.reason='refinement-failed-original-kept';report.rejectionCodes=[e instanceof Error?e.message:'Unknown refinement error'];return finish();
  }
}
