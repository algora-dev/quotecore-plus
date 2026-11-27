import { assessBrief } from './readiness';
import { coverage } from './coverage';

/** Render data as escaped literal text. Consumers must still disable raw HTML/remote content. */
export function literal(value:string):string {
  return value.replace(/[\r\n\t]+/g,' ').replace(/[\u202a-\u202e\u2066-\u2069]/g,'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!)).replace(/[\\`*_[\]{}()#+!|~.\-]/g,'\\$&');
}
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
const rank={critical:0,high:1,medium:2,low:3};
/** Internal projection only. No customer-facing projection until scope and disclosure rules exist. */
export function briefMarkdown(raw:unknown):string {
  const {brief,ready,blockers}=assessBrief(raw);const c=coverage(brief.manifest);
  const out=['# Roofing Job Brief (internal)','',`Revision: ${brief.revision}; source manifest: ${brief.manifest.revision}`,`Coverage: ${c.analyzed}/${c.expected} pages analyzed; ${c.failed} failed; ${c.missing} missing; ${c.screened} screened only; ${c.pending} pending.`,`Brief review: ${ready?'complete':'required'} (not quote approval).`,'','## Review items'];
  for(const i of [...brief.issues].sort((a,b)=>rank[a.priority]-rank[b.priority]||cmp(a.id,b.id))) {
    out.push(`- ${i.priority.toUpperCase()} | ${literal(i.title)} | ${i.state}`,`  - Finding: ${literal(i.finding)}`,`  - Pricing consideration: ${literal(i.pricingImpact)}`,`  - Evidence IDs: ${i.evidenceIds.slice().sort(cmp).map(literal).join(', ')||'None (missing information)'}`);
    if(i.decision) out.push(`  - Recorded decision: ${i.decision.outcome}; ${literal(i.decision.reason)}`);
  }
  out.push('','## Findings');
  for(const f of [...brief.facts].sort((a,b)=>cmp(a.id,b.id))) {
    out.push(`- ${literal(f.title)} | ${f.basis} | ${f.state}`,`  - ${literal(f.finding)}`,`  - Evidence IDs: ${f.evidenceIds.slice().sort(cmp).map(literal).join(', ')}`);
    if(f.quantity) out.push(`  - Quantity: ${f.quantity.value} ${literal(f.quantity.unit)} (${f.quantity.basis}); source: ${literal(f.quantity.sourceText)} [${literal(f.quantity.sourceUnit??"not stated")}]`);
  }
  out.push('','## Evidence index');
  for(const e of [...brief.evidence].sort((a,b)=>cmp(a.id,b.id))) out.push(`- ${literal(e.id)}: source revision ${literal(e.documentRevisionId)}, page ${e.pageIndex+1}; ${literal(e.excerpt)}`);
  out.push('','## Source documents');
  for(const d of [...brief.manifest.documents].sort((a,b)=>cmp(a.revisionId,b.revisionId))) out.push(`- ${literal(d.filename)} | ${literal(d.revisionId)} | ${d.status} | ${d.pageCount} pages`);
  out.push('','## Selected working pages');
  for(const p of [...brief.selectedPages].sort((a,b)=>cmp(a.revisionId,b.revisionId)||a.pageIndex-b.pageIndex)) out.push(`- ${literal(p.revisionId)}: page ${p.pageIndex+1}`);
  out.push('','## Blocking checks');
  for(const b of blockers.sort((a,b)=>cmp(a.code,b.code)||cmp(a.recordId||'',b.recordId||''))) out.push(`- ${b.code}${b.recordId?' — '+literal(b.recordId):''}`);
  return out.join('\n')+'\n';
}
