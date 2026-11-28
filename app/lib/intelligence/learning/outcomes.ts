import { ensure,id,integer,choice,list,record,text,unique } from '../contracts/validation';
import { digest } from '../policy/approval';
/** Read-only company outcome projection. Server adapter must authorize company-wide
 * analytics, enforce retention, join canonical quote events and exclude demo data.
 * Never infer a reason, customer response or causal relationship from silence. */
export type Outcome={companyId:string;quoteId:string;sentAtMs:number;responseAtMs:number|null;status:'awaiting_response'|'accepted'|'declined'|'revision_requested'|'withdrawn'|'unknown';declineReason:string|null};
export function summarizeOutcomes(companyId:string,raw:unknown,fromMs:number,toMs:number,nowMs:number){
 id(companyId,'company');integer(fromMs,'from',1);integer(toMs,'to',fromMs+1);integer(nowMs,'now',toMs);
 const rows=list(raw,'outcomes',(v,f):Outcome=>{
  const r=record(v,f,['companyId','quoteId','sentAtMs','responseAtMs','status','declineReason']);ensure(r.companyId===companyId,'outcome scope');
  const sentAtMs=integer(r.sentAtMs,f,1,nowMs),responseAtMs=r.responseAtMs===null?null:integer(r.responseAtMs,f,sentAtMs,nowMs);
  const status=choice(r.status,f,['awaiting_response','accepted','declined','revision_requested','withdrawn','unknown'] as const);
  ensure(responseAtMs===null||['accepted','declined','revision_requested'].includes(status),'response status');
  const declineReason=r.declineReason===null?null:text(r.declineReason,f,500);ensure(declineReason===null||status==='declined','reason status');
  return {companyId,quoteId:id(r.quoteId,f),sentAtMs,responseAtMs,status,declineReason};
 },10000);unique(rows,r=>r.quoteId,'outcome quote');
 const cohort=rows.filter(r=>r.sentAtMs>=fromMs&&r.sentAtMs<toMs);const counts={awaiting_response:0,accepted:0,declined:0,revision_requested:0,withdrawn:0,unknown:0};
 for(const r of cohort)counts[r.status]++;
 const response=cohort.flatMap(r=>r.responseAtMs===null?[]:[r.responseAtMs-r.sentAtMs]).sort((a,b)=>a-b);
 const mid=Math.floor(response.length/2);const medianResponseMs=response.length===0?null:response.length%2?response[mid]:(response[mid-1]+response[mid])/2;
 const declineReasonsRecorded=cohort.filter(r=>r.status==='declined'&&r.declineReason!==null).length;
 const decided=counts.accepted+counts.declined;
 // Counts are aggregate; never return raw customer feedback or identifying text.
 return {companyId,fromMs,toMs,asOfMs:nowMs,sent:cohort.length,counts,decided,acceptanceAmongDecided:decided?counts.accepted/decided:null,responseSample:response.length,medianResponseMs,declineReasonsRecorded,declinesWithoutRecordedReason:counts.declined-declineReasonsRecorded,sourceDigest:digest(cohort.sort((a,b)=>a.quoteId.localeCompare(b.quoteId))),recommendations:[...(counts.awaiting_response?['Review outstanding quotes under approved contact policy.']:[]),...(counts.declined>declineReasonsRecorded?['Collect decline feedback where appropriate; reasons are currently unknown.']:[])],advisoryOnly:true as const};
}
