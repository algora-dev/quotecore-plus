import { parseBrief, type Review, type JobBrief } from '../contracts/brief';
import { evidenceIsCurrent } from '../contracts/evidence';
import { coverage } from './coverage';

export type Blocker={code:'incomplete_coverage'|'no_confirmed_facts'|'stale_evidence'|'fact_review_required'|'unknown_quantity'|'issue_review_required';recordId?:string};
export function reviewIsCurrent(review:Review|undefined,version:number,manifestRevision:number):boolean {
  return !!review && review.recordVersion===version&&review.manifestRevision===manifestRevision;
}
/** This is document-brief readiness, NOT permission to measure, price, approve or send a quote. */
export function assessBrief(raw:unknown):{ready:boolean;blockers:Blocker[];brief:JobBrief} {
  const brief=parseBrief(raw); const blockers:Blocker[]=[];
  const m=brief.manifest;
  if(!coverage(m).complete) blockers.push({code:'incomplete_coverage'});
  if(!brief.facts.some(f=>f.state==='confirmed'&&reviewIsCurrent(f.review,f.version,m.revision))) blockers.push({code:'no_confirmed_facts'});
  const current=new Set(brief.evidence.filter(e=>evidenceIsCurrent(e,m)).map(e=>e.id));
  for(const f of brief.facts) {
    // Rejections and supersession cannot be used by a provider to skip review.
    // For 1A a trusted, current review is required to retire a fact.
    const reviewed=reviewIsCurrent(f.review,f.version,m.revision);
    if((f.state==='rejected'||f.state==='superseded') && reviewed) continue;
    if(!f.evidenceIds.every(e=>current.has(e))) blockers.push({code:'stale_evidence',recordId:f.id});
    if(f.state!=='confirmed'||!reviewed) blockers.push({code:'fact_review_required',recordId:f.id});
    if(f.quantity&&(f.quantity.unit==='unknown'||f.quantity.basis==='unknown'||f.quantity.unit==='rise_run')) blockers.push({code:'unknown_quantity',recordId:f.id});
  }
  for(const i of brief.issues) {
    const decided=reviewIsCurrent(i.decision,i.version,m.revision);
    // Replacing/retiring an issue needs a new current authorized decision; no AI-only close.
    if(i.state==='superseded'&&decided&&i.decision?.outcome==='not_applicable') continue;
    if(!i.evidenceIds.every(e=>current.has(e))) blockers.push({code:'stale_evidence',recordId:i.id});
    // Conservative initial policy: all issues require review, not only high-impact ones.
    if(i.state!=='closed'||!decided) blockers.push({code:'issue_review_required',recordId:i.id});
  }
  return {ready:blockers.length===0,blockers,brief};
}
