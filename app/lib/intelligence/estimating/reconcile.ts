import { assessBrief } from '../brief/readiness';
import { computeMaterialCostByStrategy, computeQuoteTotals, type QuoteComponent } from '../../pricing/engine';
import { computeTaxLines } from '../../taxes/types';
import { parseEstimateSnapshot } from './snapshot';
import type { JobFact, JobIssue } from '../contracts/brief';

const norm=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
// Strict tolerance avoids inventing a currency rounding policy. Adapter must
// use the canonical unrounded value or explicitly withhold readiness.
const equal=(a:number,b:number)=>Math.abs(a-b)<=1e-7;
export type EstimateFinding={code:string;targetId:string|null;priority:'critical'|'high'|'medium'|'low';evidenceIds:string[]};
export function reconcileEstimate(rawBrief:unknown,rawSnapshot:unknown,nowMs:number,reviewerAuthorized:(id:string)=>boolean){
 const {brief,blockers}=assessBrief(rawBrief),s=parseEstimateSnapshot(rawSnapshot,brief.manifest.scope);
 const findings:EstimateFinding[]=blockers.map(b=>({code:b.code,targetId:b.recordId??null,priority:'high',evidenceIds:[...(brief.facts.find(f=>f.id===b.recordId)?.evidenceIds??[]),...(brief.issues.find(i=>i.id===b.recordId)?.evidenceIds??[])]}));
 const add=(code:string,targetId:string|null=null,evidenceIds:string[]=[],priority:EstimateFinding['priority']='high')=>findings.push({code,targetId,priority,evidenceIds});
 if(!s.complete||s.briefRevision!==brief.revision)add('incomplete_or_stale_snapshot');
 if(!s.geometryComplete)add('incomplete_geometry');
 if(!s.canonicalTotalsCurrent||s.canonicalBuilderTotal===null)add('canonical_totals_unavailable');
 if(s.unsupportedCustomLines)add('custom_lines_require_canonical_review');
 if(!s.lines.length)add('no_priced_lines');
 const lib=new Map(s.library.map(x=>[x.id,x])),measurements=new Map(s.measurements.map(x=>[x.id,x])),lines=new Map(s.lines.map(x=>[x.id,x]));
 const confirmed=brief.facts.filter(f=>f.state==='confirmed');
 const evidence=(id:string|null)=>confirmed.find(f=>f.id===id)?.evidenceIds??[];
 const goodLines=new Set<string>();
 for(const l of s.lines){
   const start=findings.length,m=measurements.get(l.measurementId),item=l.libraryId===null?undefined:lib.get(l.libraryId),ev=evidence(m?.factId??null);
   const warn=(code:string)=>add(code,l.id,ev);
   if(!m||!m.verified||m.geometryRevision!==s.geometryRevision||m.version!==l.measurementVersion)warn('measurement_unverified_or_stale');
   if(l.geometryRevision!==s.geometryRevision||l.pricingRevision!==s.pricingRevision)warn('stale_line_revision');
   if(!item||!item.active||!item.approved||item.version!==l.libraryVersion)warn('missing_or_unapproved_library');
   if(!m||l.pricingUnit!==m.pricingUnit||l.pricingUnit!==item?.unit)warn('pricing_unit_mismatch');
   if(!m||l.quantity<=0||!equal(l.quantity,m.pricedQuantity))warn('invalid_or_mismatched_quantity');
   if(s.lines.some(other=>other.id!==l.id&&other.measurementId===l.measurementId&&other.libraryId===l.libraryId))warn('possible_duplicate_line');
   if(l.materialCost===null||l.labourCost===null)warn('missing_saved_cost');
   if(item){
     if(item.labourRate===null||(item.labourRate===0&&!item.zeroLabourApproved))warn('missing_labour_rate');
     if(item.strategy==='per_unit'&&(item.materialRate===null||(item.materialRate===0&&!item.zeroMaterialApproved)))warn('missing_material_rate');
     const expected=computeMaterialCostByStrategy({strategy:item.strategy,totalQuantity:l.quantity,materialRate:item.materialRate??0,packPrice:item.packPrice,packSize:item.packSize,packCoverageM2:item.packCoverageM2});
     if(expected.packDataMissing)warn('missing_pack_data');
     if(l.materialCost!==null&&!equal(l.materialCost,expected.cost))warn('material_cost_mismatch');
     if(l.labourCost!==null&&item.labourRate!==null&&!equal(l.labourCost,l.quantity*item.labourRate))warn('labour_cost_mismatch');
   }
   if(findings.length===start)goodLines.add(l.id);
 }
 for(const m of s.measurements){
   const ev=evidence(m.factId);
   if(!m.verified||m.geometryRevision!==s.geometryRevision||m.sourceValue<=0||m.pricedQuantity<=0||(m.basis==='count'&&!Number.isSafeInteger(m.sourceValue)))add('invalid_measurement',m.id,ev);
   if(m.factId!==null){const f=confirmed.find(f=>f.id===m.factId),q=f?.quantity;
     if(!f||!q||m.factVersion!==f.version||q.basis!==m.basis||q.unit!==m.sourceUnit||!equal(q.value,m.sourceValue))add('source_quantity_mismatch',m.id,ev);
   }
   if(!s.lines.some(l=>l.measurementId===m.id&&goodLines.has(l.id)))add('unpriced_measurement',m.id,ev);
 }
 // No fuzzy matching or automatic selection. An exact company alias merely
 // suggests a candidate; the human still links it to existing priced lines.
 const suggestions=confirmed.filter(f=>['roof_system','material','flashing','drainage','penetration','access_and_labour','removal','installation','quantity'].includes(f.category)).map(f=>({factId:f.id,evidenceIds:f.evidenceIds,candidateLibraryIds:s.library.filter(i=>i.active&&i.approved&&[i.name,...i.aliases].some(a=>norm(a)===norm(f.title)||norm(a)===norm(f.finding))).map(i=>i.id).sort(),selected:false as const}));
 const dispositions=new Map(s.dispositions.map(d=>[d.kind+':'+d.recordId,d]));
 function check(kind:'fact'|'issue',r:JobFact|JobIssue){
   const d=dispositions.get(kind+':'+r.id),warn=(c:string)=>add(c,r.id,r.evidenceIds,kind==='issue'&&'priority' in r?r.priority:'high');
   if(!d||d.recordVersion!==r.version||d.briefRevision!==brief.revision||d.pricingRevision!==s.pricingRevision||d.geometryRevision!==s.geometryRevision||d.libraryRevision!==s.libraryRevision||d.totalsRevision!==s.totalsRevision||d.atMs>nowMs||!reviewerAuthorized(d.reviewerId)){warn('estimate_disposition_required');return;}
   if(d.outcome==='included'){
     if(!d.lineIds.length||d.lineIds.some(i=>!goodLines.has(i))){warn('included_scope_not_priced');return;}
     if(kind==='fact'&&'quantity' in r&&r.category==='quantity'&&!d.lineIds.some(i=>{const m=measurements.get(lines.get(i)!.measurementId);return m?.factId===r.id&&m.factVersion===r.version;}))warn('quantity_not_reconciled');
   }else {
     if(d.lineIds.length)warn('nonincluded_scope_has_priced_links');
     if(kind==='fact'&&s.measurements.some(m=>m.factId===r.id&&s.lines.some(l=>l.measurementId===m.id)))warn('excluded_quantity_still_priced');
   }
   if(kind==='issue'&&'decision' in r){
     // Phase 2B records resolved/not_applicable only. A resolved clarification
     // may be given a more specific commercial disposition here.
     if(r.decision?.outcome!=='resolved'&&r.decision?.outcome!==d.outcome)warn('brief_estimate_disposition_conflict');
     if(d.outcome==='included'&&r.decision?.linkedComponentIds.some(i=>!d.lineIds.includes(i)))warn('brief_component_link_mismatch');
   }
   // A commercial fact cannot be marked generically resolved to bypass inclusion/exclusion.
   if(d.outcome==='resolved'&&['scope','roof_system','material','flashing','drainage','penetration','access_and_labour','removal','installation','quantity'].includes(r.category))warn('explicit_scope_disposition_required');
 }
 for(const f of confirmed)check('fact',f);
 for(const i of brief.issues.filter(i=>i.state!=='superseded'))check('issue',i);
 for(const l of s.lines)if(!s.dispositions.some(d=>d.outcome==='included'&&d.lineIds.includes(l.id)))add('priced_line_without_scope_disposition',l.id,evidence(measurements.get(l.measurementId)?.factId??null));
 for(const d of s.dispositions)if(!(d.kind==='fact'?confirmed:brief.issues.filter(i=>i.state!=='superseded')).some(r=>r.id===d.recordId))add('orphan_disposition',d.recordId);
 let totalCheck:null|{material:number;labour:number;subtotalWithMargins:number;tax:number;builderTotal:number}=null;
 if(s.complete&&!s.unsupportedCustomLines&&s.lines.length&&s.lines.every(l=>l.materialCost!==null&&l.labourCost!==null)){
   // Same narrow stored-cost projection as existing smart-assistant totals reader.
   const totals=computeQuoteTotals(s.lines.map(l=>({materialCost:l.materialCost!,labourCost:l.labourCost!})) as QuoteComponent[],{materialMarginPct:s.materialMarginPct,labourMarginPct:s.labourMarginPct,taxRate:0});
   const tax=computeTaxLines(s.taxes,totals.subtotalWithMargins,'quote').total,builderTotal=totals.subtotalWithMargins+tax;
   totalCheck={material:totals.totalMaterials,labour:totals.totalLabour,subtotalWithMargins:totals.subtotalWithMargins,tax,builderTotal};
   if(s.canonicalBuilderTotal===null||!equal(builderTotal,s.canonicalBuilderTotal))add('canonical_total_mismatch');
 }
 const ranks={critical:0,high:1,medium:2,low:3};findings.sort((a,b)=>ranks[a.priority]-ranks[b.priority]||a.code.localeCompare(b.code)||(a.targetId??'').localeCompare(b.targetId??''));
 return {scope:s.scope,briefRevision:brief.revision,currency:s.currency,findings,suggestions,dispositions:s.dispositions,lines:s.lines,readyForEstimateReview:findings.length===0,canonicalBuilderTotal:findings.length===0?s.canonicalBuilderTotal:null,totalCheck,manualAvailable:true as const,writeAuthorized:false as const};
}
