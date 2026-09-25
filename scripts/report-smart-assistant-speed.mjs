/** Offline report of actual sa_turn_performance / sa_request_performance logs.
 * No external calls or hard-coded model prices. Accepts JSONL or lines prefixed
 * with [smart-assistant:...], including JSON envelopes with a message string. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function percentile(values,p){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);return sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]:null;}
export function decode(line){
  try{const start=line.indexOf('{');if(start<0)return null;const value=JSON.parse(line.slice(start));if(['sa_turn_performance','sa_request_performance'].includes(value.event))return value;if(typeof value.message==='string')return decode(value.message);}catch{/* unrelated/invalid log line */}return null;
}
export function summarize(text){
  const turns=new Map(),requests=new Map();let ignoredLines=0;
  for(const line of text.split(/\r?\n/).filter(Boolean)){const row=decode(line);if(!row||typeof row.runId!=='string'){ignoredLines++;continue;}(row.event==='sa_turn_performance'?turns:requests).set(row.runId,row);}
  const groups=new Map();
  for(const turn of turns.values()){
    const key=`${turn.path}|${turn.modelCalls===0?'no-model':turn.model}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({turn,request:requests.get(turn.runId)});
  }
  const stats=values=>({samples:values.filter(Number.isFinite).length,p50:percentile(values,0.5),p95:percentile(values,0.95)});
  return {note:'No quality scoring or causal speedup is inferred. First model token is backend-only, NOT first useful browser output. Missing request logs do not prove trusted finish succeeded.',ignoredLines,orphanRequestLogs:[...requests.keys()].filter(id=>!turns.has(id)).length,groups:[...groups].map(([key,rows])=>{
    const successful=rows.filter(r=>r.turn.status==='completed');
    const confirmed=rows.filter(r=>r.request?.status==='completed');
    const sum=field=>rows.reduce((n,r)=>n+(Number.isFinite(r.turn[field])?r.turn[field]:0),0);
    return {key,attempts:rows.length,pipelineCompleted:successful.length,confirmedCompleted:confirmed.length,finishUncertain:rows.filter(r=>r.request?.status==='finish_uncertain').length,missingRequestLogs:rows.filter(r=>!r.request).length,pipelineFailed:rows.length-successful.length,
      completedPipelineMs:stats(successful.map(r=>r.turn.pipelineMs)),confirmedRequestMs:stats(confirmed.map(r=>r.request.requestMs)),backendFirstModelTokenMs:stats(successful.map(r=>r.turn.firstModelTokenMs)),modelCalls:sum('modelCalls'),toolCalls:sum('toolCalls'),repeatSuppressions:sum('repeatedCalls'),tokensIn:sum('tokensIn'),tokensOut:sum('tokensOut')};})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv[2]){console.error('Usage: node scripts/report-smart-assistant-speed.mjs server-log.jsonl');process.exitCode=2;}
  else console.log(JSON.stringify(summarize(readFileSync(process.argv[2],'utf8')),null,2));
}
