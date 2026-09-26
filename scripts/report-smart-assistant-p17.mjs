/** Observed logs only. No network, estimated price, or inferred quality pass. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {summarizeRetrieval} from './report-smart-assistant-retrieval.mjs';
import {percentile} from './report-smart-assistant-speed.mjs';
const kinds=new Set(['sa_retrieval_capabilities','sa_turn_performance','sa_request_performance','sa_composite_resolution']);
export function decodeP17(line,depth=0){
 if(depth>4||typeof line!=='string')return null;
 try{const start=line.indexOf('{');if(start<0)return null;const e=JSON.parse(line.slice(start));if(kinds.has(e?.event))return e;if(typeof e?.message==='string')return decodeP17(e.message,depth+1);}catch{/* unrelated or malformed log */}return null;
}
const stats=values=>({samples:values.filter(Number.isFinite).length,p50:percentile(values,.5),p95:percentile(values,.95)});
export function summarizeP17(text){
 const events=text.split(/\r?\n/).map(line=>decodeP17(line)).filter(Boolean);
 const caps=new Map(),turns=new Map(),requests=new Map(),composites=[];
 for(const e of events){if(typeof e.runId!=='string')continue;if(e.event==='sa_retrieval_capabilities')caps.set(e.runId,e);if(e.event==='sa_turn_performance')turns.set(e.runId,e);if(e.event==='sa_request_performance')requests.set(e.runId,e);if(e.event==='sa_composite_resolution')composites.push(e);}
 const active=[...caps].filter(([,e])=>e.intelligenceActive===true&&e.intelligenceVersion===1).map(([id])=>id);
 const complete=active.filter(id=>requests.get(id)?.status==='completed'&&turns.get(id)?.status==='completed');
 const t=complete.map(id=>turns.get(id));
 const sum=field=>t.reduce((n,e)=>n+(Number.isFinite(e[field])?e[field]:0),0);
 return {note:'Observed events, not accuracy, isolated SQL cost or a causal speedup. Composite query logs lack call IDs: deduplicate exported transport before reporting. Absent events are unknown, not zero. HTTP benchmark labels alone do not prove active flags. retrievalRepairs counts one-repair allowances offered, not necessarily a successful repair.',baselineReport:summarizeRetrieval(text),p17:{capabilityVerifiedRuns:active.length,completedWithTiming:complete.length,missingFinalTiming:active.length-complete.length,requestMs:stats(complete.map(id=>requests.get(id).requestMs)),modelCalls:t.map(e=>e.modelCalls),repairRoundsObserved:sum('retrievalPlanFailures'),repairAllowancesOffered:sum('retrievalRepairs'),repairStopsObserved:sum('repairBudgetStops'),oneModelCompletions:t.filter(e=>e.modelCalls===1).length,compositeCalls:composites.length,compositeMs:stats(composites.map(e=>e.totalMs))}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(!process.argv[2]){console.error('Usage: node scripts/report-smart-assistant-p17.mjs <exported-log.jsonl>');process.exitCode=2;}else console.log(JSON.stringify(summarizeP17(readFileSync(process.argv[2],'utf8')),null,2));}
