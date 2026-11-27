import { parseBrief, parseCandidates, type JobBrief, type IssueCandidate, type FactCandidate } from '../contracts/brief';
import { evidenceIsCurrent, parseEvidence, parseManifest, type EvidenceRef } from '../contracts/evidence';
import { ensure, integer, unique, id, hash } from '../contracts/validation';
import { digest } from '../policy/approval';
import type { DocumentRun } from '../documents/worker';
import { LIMITS } from '../documents/pages';
import { coverage } from '../brief/coverage';

const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
const norm=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
const sortedIds=(es:readonly EvidenceRef[])=>Array.from(new Set(es.map(e=>e.id))).sort(cmp);
function issue(key:string,category:IssueCandidate['category'],priority:IssueCandidate['priority'],title:string,finding:string,pricingImpact:string,evidenceIds:string[]):IssueCandidate {
  return {id:'roof-'+digest({key,evidenceIds}),category,priority,title,finding,pricingImpact,evidenceIds};
}
/** Deliberately narrow textual rules. Only compare explicit, named roof declarations in
 * the same field, not generic material mentions, alternatives, or inferred quantities.
 * Different spellings/units are review candidates, not proof of a contradiction. */
function reconcile(evidence:EvidenceRef[],facts:FactCandidate[]):IssueCandidate[] {
  const issues:IssueCandidate[]=[];
  const declarations=new Map<string,{values:Set<string>;evidence:EvidenceRef[]}>();
  const sheets=new Set<string>();
  const references=new Map<string,EvidenceRef[]>();
  for(const e of evidence){
    const line=e.excerpt.trim();
    const sheet=/^(?:sheet|drawing)\s*(?:id\s*)?[:=]\s*([A-Z0-9][A-Z0-9.-]{0,31})$/i.exec(line);
    if(sheet)sheets.add(norm(sheet[1]));
    // Exact, explicit references only. A found title is not a reviewed detail.
    const ref=/^(?:see|refer to)\s+(?:sheet|drawing)\s+([A-Z0-9][A-Z0-9.-]{0,31})\.?$/i.exec(line);
    if(ref){const k=norm(ref[1].replace(/\.$/,''));references.set(k,[...(references.get(k)??[]),e]);}
    const d=/^roof\s+([a-z0-9][a-z0-9 _-]{0,39})\s*:\s*(pitch|material|roof system|underlay|insulation)\s*[:=]\s*([^;\n]{1,100})$/i.exec(line);
    if(d){
      const value=norm(d[3]); const k=norm(d[1])+' / '+norm(d[2]);
      if(/^(?:tbc|tbd|not specified|unknown|to be confirmed|by others)$/.test(value)){
        issues.push(issue('missing:'+k,'missing_information','high','Confirm stated open requirement',`Source identifies an unresolved or externally assigned requirement for roof ${k}.`,'Confirm scope and specification before pricing.',[e.id]));
      }else if(!/\b(?:or|option|alternate|alternative|if|unless|existing|proposed)\b/.test(value)){
        const entry=declarations.get(k)??{values:new Set<string>(),evidence:[]};entry.values.add(value);entry.evidence.push(e);declarations.set(k,entry);
      }
    }
  }
  for(const [k,v] of declarations){if(v.values.size>1){const ids=sortedIds(v.evidence); // do not discard provenance on a large group
    for(let i=0;i<ids.length;i+=100)issues.push(issue('conflict:'+k+':'+i,'revision_conflict','high','Compare differing roof requirements',`Different stated values for roof ${k}; verify applicability, units, revision and alternatives. No precedence has been chosen.`,'May change the roof system, material quantities or installation scope.',ids.slice(i,i+100)));
  }}
  for(const [k,es] of references){if(!sheets.has(k)){const ids=sortedIds(es);for(let i=0;i<ids.length;i+=100)issues.push(issue('ref:'+k+':'+i,'missing_information','high','Referenced sheet not located',`Explicit reference to sheet ${k}; no matching explicit sheet identifier found in analyzed text. It may exist on an unread page or under another label.`,'Obtain or identify the detail before relying on affected scope.',ids.slice(i,i+100)));}}
  // Identical stated quantity records may be duplicates, not additive. No conversion or summation.
  const groups=new Map<string,FactCandidate[]>();
  for(const f of facts){if(f.basis==='explicit'&&f.quantity){const k=digest({title:norm(f.title),finding:norm(f.finding),quantity:f.quantity});groups.set(k,[...(groups.get(k)??[]),f]);}}
  for(const [k,fs] of groups){if(fs.length>1){const ids=Array.from(new Set(fs.flatMap(f=>f.evidenceIds))).sort(cmp);for(let i=0;i<ids.length;i+=100)issues.push(issue('quantity:'+k+':'+i,'quantity','high','Check repeated stated quantity','Identical stated quantity proposals occur more than once. They may describe the same scope or separate locations; do not add them automatically.','Verify scope and duplication before measurement import.',ids.slice(i,i+100)));}}
  return issues;
}
/** Trusted persisted run only, never arbitrary browser or provider JSON. Validate output
 * linkage and exact page coverage before compiling. Never infer approval or select a winner. */
export function compileRoofingBrief(run:DocumentRun,revision:number):JobBrief {
  integer(revision,'brief revision',1);id(run.taskId,'run task');hash(run.inputHash,'run input');integer(run.policyVersion,'run policy',1);
  const manifest=parseManifest(run.manifest);ensure(!run.intent,'in-flight document call');
  const active=manifest.documents.filter(d=>d.status==='active');
  ensure(active.length<=LIMITS.files&&active.reduce((n,d)=>n+d.pageCount,0)<=LIMITS.pages,'run bounds');
  const analyzed=new Set(active.flatMap(d=>d.pages.filter(p=>p.status==='analyzed').map(p=>`${d.revisionId}:${p.index}`)));
  ensure(run.outputs.length===analyzed.size,'analyzed output count');unique(run.outputs,o=>`${o.revisionId}:${o.index}`,'page output identity');
  const evidence:EvidenceRef[]=[],facts:FactCandidate[]=[],issues:IssueCandidate[]=[];
  const selectedPages:JobBrief['selectedPages']=[];
  for(const o of run.outputs){
    const page=active.find(d=>d.revisionId===o.revisionId)?.pages.find(p=>p.index===o.index);
    ensure(analyzed.has(`${o.revisionId}:${o.index}`)&&page?.relevance===o.candidates.relevance,'output page/relevance');
    hash(o.inputHash,'page input');id(o.requestId,'request');id(o.modelId,'model');
    ensure(o.evidence.length<=LIMITS.regions,'page evidence bounds');
    const es=o.evidence.map(e=>parseEvidence(e));unique(es,e=>e.id,'page evidence IDs');
    ensure(es.every(e=>e.runId===run.taskId&&e.documentRevisionId===o.revisionId&&e.pageIndex===o.index&&evidenceIsCurrent(e,manifest)),'output evidence binding');
    const known=new Set(es.map(e=>e.id));const cs=parseCandidates({facts:o.candidates.facts,issues:o.candidates.issues});
    ensure([...cs.facts,...cs.issues].every(x=>x.evidenceIds.length>0&&x.evidenceIds.every(e=>known.has(e))),'output candidate evidence');
    ensure(o.candidates.relevance==='relevant'||(!cs.facts.length&&!cs.issues.length),'irrelevant output proposals');
    evidence.push(...es);facts.push(...cs.facts);issues.push(...cs.issues);
    if(o.candidates.relevance==='relevant')selectedPages.push({revisionId:o.revisionId,pageIndex:o.index});
  }
  unique(evidence,e=>e.id,'run evidence IDs');unique([...facts,...issues],x=>x.id,'run candidate IDs');
  const c=coverage(manifest);
  if(!c.complete)issues.push(issue('coverage','missing_information','critical','Incomplete document review',`${c.analyzed}/${c.expected} active pages analyzed; ${c.failed} failed, ${c.screened} screened only, ${c.pending} pending, ${c.missing} missing.`,'Unreviewed material may change scope, quantities or pricing. Complete analysis or continue manually.',[]));
  issues.push(...reconcile(evidence,facts));
  if(!facts.length)issues.push(issue('no-facts','missing_information','high','No supported roof facts extracted','No candidate facts were extracted from the analyzed source pages.','Confirm scope manually; absence of findings is not proof of no work.',[]));
  // Strict contract bounds: fail explicitly, never silently truncate. Large briefs need pagination/versioning.
  return parseBrief({manifest,revision,evidence:evidence.sort((a,b)=>cmp(a.id,b.id)),facts:facts.sort((a,b)=>cmp(a.id,b.id)).map(f=>({...f,version:1,state:'proposed'})),issues:issues.sort((a,b)=>cmp(a.id,b.id)).map(i=>({...i,version:1,state:'open'})),selectedPages:selectedPages.sort((a,b)=>cmp(a.revisionId,b.revisionId)||a.pageIndex-b.pageIndex)});
}
