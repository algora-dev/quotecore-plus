/** Offline diagnostics of REAL logged events. No network, model price assumptions,
 * or invented latency data. Rows from partial logs are explicitly incomplete. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {summarize as summarizeTurns,percentile} from './report-smart-assistant-speed.mjs';
const kinds=new Set(['sa_retrieval','sa_retrieval_capabilities','sa_turn_performance','sa_request_performance']);
export function decodeRetrieval(line){
 try{const start=line.indexOf('{');if(start<0)return null;const value=JSON.parse(line.slice(start));if(kinds.has(value.event))return value;if(typeof value.message==='string')return decodeRetrieval(value.message);}catch{/* unrelated */}return null;
}
const stats=values=>({samples:values.filter(Number.isFinite).length,p50:percentile(values,.5),p95:percentile(values,.95)});
export function summarizeRetrieval(text){
 const events=text.split(/\r?\n/).map(decodeRetrieval).filter(Boolean),caps=new Map(),turns=new Map(),requests=new Map(),queries=[];
 for(const e of events){if(typeof e.runId!=='string')continue;if(e.event==='sa_retrieval')queries.push(e);if(e.event==='sa_retrieval_capabilities')caps.set(e.runId,e);if(e.event==='sa_turn_performance')turns.set(e.runId,e);if(e.event==='sa_request_performance')requests.set(e.runId,e);}
 const bySource=new Map();for(const q of queries){const key=`${q.source??'rejected'}|${q.mode??'none'}|${q.state}`;const rows=bySource.get(key)??[];rows.push(q);bySource.set(key,rows);}
 const successful=[...turns.values()].filter(t=>t.path==='retrieval'&&requests.get(t.runId)?.status==='completed');
 return {note:'Observed events only. RPC includes network and database time, not isolated SQL executor time. Source-query events have no call ID and are not deduplicated; deduplicate exported log transport first. Browser first-useful-output and correctness are not measured. No price or causal speedup is inferred.',turns:summarizeTurns(text),
  retrieval:{recordedQueries:queries.length,capabilityRuns:caps.size,queryRunsMissingCapabilities:new Set(queries.filter(q=>!caps.has(q.runId)).map(q=>q.runId)).size,terminalCompletions:successful.length,oneModelTerminalCompletions:successful.filter(t=>t.modelCalls===1).length,confirmedTerminalRequestMs:stats(successful.map(t=>requests.get(t.runId).requestMs)),
   capabilityStates:[...caps.values()].reduce((a,c)=>{const key=`${c.state}|server=${c.enabledByServer}|workspace=${c.enabledByWorkspace}|queryTool=${c.tools?.includes('query_workspace')===true}`;a[key]=(a[key]??0)+1;return a;},{}),
   groups:[...bySource].map(([key,rows])=>({key,calls:rows.length,truncated:rows.filter(r=>r.truncated).length,rpcMs:stats(rows.map(r=>r.rpcMs)),engineMs:stats(rows.map(r=>r.engineMs)),renderMs:stats(rows.map(r=>r.renderMs)),totalMs:stats(rows.map(r=>r.totalMs))}))}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(!process.argv[2]){console.error('Usage: node scripts/report-smart-assistant-retrieval.mjs server-log.jsonl');process.exitCode=2;}else console.log(JSON.stringify(summarizeRetrieval(readFileSync(process.argv[2],'utf8')),null,2));}
