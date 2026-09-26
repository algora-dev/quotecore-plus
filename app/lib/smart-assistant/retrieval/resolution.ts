import type { QueryPlan, QueryRow, Resolution } from './contracts';
import { isRecord } from '../section-permissions';
/** Confidence is an explainable selection rule, NOT a model probability. */
export function resolveRows(rows: QueryRow[], plan: QueryPlan, truncated: boolean): Resolution {
  const signals=rows.map(row=>({
    tier:isRecord(row._rank)&&typeof row._rank.tier==='number'?row._rank.tier:0,
    score:isRecord(row._rank)&&typeof row._rank.score==='number'?row._rank.score:0,
    recency:typeof row._touched==='string'?row._touched:null,
  }));
  const selected=(reason:Resolution['reason']):Resolution=>({state:'selected',reason,selectedIndex:0,signals});
  if(!rows.length)return {state:'empty',reason:'none',selectedIndex:null,signals};
  // IDs/numbers must have been validated by the executor; never interpret a
  // fuzzy first result as an exact record-number match.
  const exactIdentity=plan.filters.some(f=>f.op==='eq'&&['id','quote_number','invoice_number','order_number'].includes(f.field));
  if(rows.length===1&&!truncated&&exactIdentity)return selected('exact_identity');
  if(!plan.search){
    if(rows.length===1&&!truncated)return selected('single_match');
    if(plan.orderBy.length&&!plan.resolve)return selected('ordered_selection');
    return {state:truncated?'broad':'candidates',reason:truncated?'too_many':'near_tie',selectedIndex:null,signals};
  }
  const first=signals[0],second=signals[1];
  if(first.tier===4&&(!second||second.tier<4))return selected('exact_name');
  // A unique whole-name phrase is actionable only against lower tiers. Dates
  // break list ordering, never a genuine identity tie.
  if(first.tier===3&&(!second||second.tier<2)&&(!second||first.score-second.score>=20))return selected('strong_phrase');
  if(rows.length===1&&!truncated&&first.tier>=2)return selected('single_match');
  return {state:truncated&&first.tier<2?'broad':'candidates',reason:first.tier<2?'weak_match':'near_tie',selectedIndex:null,signals};
}
export function clarificationFor(rows: QueryRow[], broad: boolean): string {
  for(const [key,label] of [['job_name','job'],['customer_name','customer'],['supplier_name','supplier'],['quote_status','draft or non-draft quote'],['status','status']] as const){
    const values=new Set(rows.map(r=>r[key]).filter(v=>typeof v==='string'&&v.trim()));
    if(values.size>1)return broad?`Several records match. Which ${label} should I narrow this to?`:`Which ${label} do you mean? Choose a matching record below.`;
  }
  return broad?'Several records match. Do you remember the job name or approximately when it was created?':'These records are too similar to choose safely. Which one do you mean?';
}
