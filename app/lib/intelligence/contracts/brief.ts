import { parseEvidence, parseManifest, sameScope, type SourceManifest, type EvidenceRef } from './evidence';
import { choice, ensure, finite, id, ids, integer, list, record, text, unique } from './validation';

export const CATEGORIES=['scope','roof_system','pitch','quantity','material','flashing','drainage','penetration','access_and_labour','removal','installation','warranty','revision_conflict','missing_information','other'] as const;
export type Category=typeof CATEGORIES[number];
export type Quantity={value:number;unit:string;sourceUnit:string|null;basis:'plan'|'surface'|'count'|'unknown';sourceText:string};
export type FactCandidate={id:string;category:Category;title:string;finding:string;basis:'explicit'|'derived'|'inferred';evidenceIds:string[];quantity?:Quantity};
export type Review={actorId:string;reason:string;atMs:number;manifestRevision:number;recordVersion:number};
export type JobFact=FactCandidate & {version:number;state:'proposed'|'confirmed'|'rejected'|'superseded';review?:Review};
export type IssueCandidate={id:string;category:Category;priority:'critical'|'high'|'medium'|'low';title:string;finding:string;pricingImpact:string;evidenceIds:string[]};
export type IssueDecision=Review & {outcome:'included'|'excluded'|'not_applicable'|'resolved';linkedComponentIds:string[]};
export type JobIssue=IssueCandidate & {version:number;state:'open'|'needs_clarification'|'proposed_resolution'|'closed'|'superseded';decision?:IssueDecision};
export type JobBrief={manifest:SourceManifest;revision:number;facts:JobFact[];issues:JobIssue[];evidence:EvidenceRef[];selectedPages:{revisionId:string;pageIndex:number}[]};
const FACT_KEYS=['id','category','title','finding','basis','evidenceIds','quantity'];
const ISSUE_KEYS=['id','category','priority','title','finding','pricingImpact','evidenceIds'];
function parseQuantity(v:unknown,f:string):Quantity {
  const r=record(v,f,['value','unit','sourceUnit','basis','sourceText']);
  const unit=choice(r.unit,f,['m','mm','cm','ft','in','yd','m2','ft2','yd2','roof_square','count','deg','rise_run','unknown'] as const);
  const basis=choice(r.basis,f,['plan','surface','count','unknown'] as const);
  ensure((unit==='count')===(basis==='count'),`${f}.count basis`);
  ensure(r.sourceUnit!==null||unit==='unknown',`${f}.missing source unit`);
  const value=finite(r.value,f,0,1e12);
  ensure(unit!=='count'||Number.isSafeInteger(value),`${f}.count value`);
  return {value,unit,sourceUnit:r.sourceUnit===null?null:text(r.sourceUnit,f,64),basis,sourceText:text(r.sourceText,f,512)};
}
function factFields(r:Record<string,unknown>,f:string):FactCandidate {
  const evidenceIds=ids(r.evidenceIds,f); ensure(evidenceIds.length>0,`${f}.evidenceIds`);
  const category=choice(r.category,f,CATEGORIES);
  const quantity=r.quantity===undefined?undefined:parseQuantity(r.quantity,f);
  ensure(category!=='quantity'||quantity!==undefined,`${f}.quantity`);
  return {id:id(r.id,f),category,title:text(r.title,f,200),finding:text(r.finding,f),basis:choice(r.basis,f,['explicit','derived','inferred'] as const),evidenceIds,...(quantity?{quantity}:{})};
}
function issueFields(r:Record<string,unknown>,f:string):IssueCandidate {
  const category=choice(r.category,f,CATEGORIES);const evidenceIds=ids(r.evidenceIds,f);
  ensure(evidenceIds.length>0 || category==='missing_information',`${f}.evidenceIds`);
  return {id:id(r.id,f),category,priority:choice(r.priority,f,['critical','high','medium','low'] as const),title:text(r.title,f,200),finding:text(r.finding,f),pricingImpact:text(r.pricingImpact,f),evidenceIds};
}
/** Provider outputs cannot assert approval, tenant identity, coverage, prices or task state. */
export function parseCandidates(v:unknown):{facts:FactCandidate[];issues:IssueCandidate[]} {
  const r=record(v,'candidates',['facts','issues']);
  const facts=list(r.facts,'facts',(x,f)=>factFields(record(x,f,FACT_KEYS),f),200);
  const issues=list(r.issues,'issues',(x,f)=>issueFields(record(x,f,ISSUE_KEYS),f),200);
  unique(facts,x=>x.id,'facts');unique(issues,x=>x.id,'issues');return {facts,issues};
}
const REVIEW_KEYS=['actorId','reason','atMs','manifestRevision','recordVersion'];
function reviewFields(r:Record<string,unknown>,f:string):Review {
  return {actorId:id(r.actorId,f),reason:text(r.reason,f),atMs:integer(r.atMs,f,1),manifestRevision:integer(r.manifestRevision,f,1),recordVersion:integer(r.recordVersion,f,1)};
}
export function parseBrief(v:unknown):JobBrief {
  const r=record(v,'brief',['manifest','revision','facts','issues','evidence','selectedPages']);
  const manifest=parseManifest(r.manifest);
  const evidence=list(r.evidence,'evidence',parseEvidence,10000);unique(evidence,x=>x.id,'evidence IDs');
  ensure(evidence.every(e=>sameScope(e.scope,manifest.scope)),'evidence scope');
  const known=new Set(evidence.map(e=>e.id));
  const facts=list(r.facts,'facts',(x,f):JobFact=>{
    const a=record(x,f,[...FACT_KEYS,'version','state','review']);const c=factFields(a,f);
    ensure(c.evidenceIds.every(e=>known.has(e)),`${f}.evidence`);
    const state=choice(a.state,f,['proposed','confirmed','rejected','superseded'] as const);
    const review=a.review===undefined?undefined:reviewFields(record(a.review,f,REVIEW_KEYS),f);
    ensure(state!=='confirmed' && state!=='rejected' || review,`${f}.review`);
    return {...c,state,version:integer(a.version,f,1),...(review?{review}:{})};
  });
  const issues=list(r.issues,'issues',(x,f):JobIssue=>{
    const a=record(x,f,[...ISSUE_KEYS,'version','state','decision']);const c=issueFields(a,f);
    ensure(c.evidenceIds.every(e=>known.has(e)),`${f}.evidence`);
    const state=choice(a.state,f,['open','needs_clarification','proposed_resolution','closed','superseded'] as const);
    const d=a.decision===undefined?undefined:record(a.decision,f,[...REVIEW_KEYS,'outcome','linkedComponentIds']);
    const decision=d?{...reviewFields(d,f),outcome:choice(d.outcome,f,['included','excluded','not_applicable','resolved'] as const),linkedComponentIds:ids(d.linkedComponentIds,f)}:undefined;
    ensure(state!=='closed'||decision,`${f}.decision`);
    return {...c,state,version:integer(a.version,f,1),...(decision?{decision}:{})};
  });
  unique(facts,x=>x.id,'facts');unique(issues,x=>x.id,'issues');
  const selectedPages=list(r.selectedPages,'selectedPages',(x,f)=>{
    const s=record(x,f,['revisionId','pageIndex']); const revisionId=id(s.revisionId,f);const pageIndex=integer(s.pageIndex,f);
    ensure(manifest.documents.some(d=>d.status==='active'&&d.revisionId===revisionId&&d.pages.some(p=>p.index===pageIndex)),f);return {revisionId,pageIndex};
  },10000);
  unique(selectedPages,x=>`${x.revisionId}:${x.pageIndex}`,'selected pages');
  return {manifest,revision:integer(r.revision,'revision',1),facts,issues,evidence,selectedPages};
}
