/** Opt-in REAL HTTP benchmark, not a mock benchmark. Default --plan is offline.
 * Sends paid/reserved user turns and stores normal conversation history. NEVER
 * seeds/deletes fixtures, changes permissions, applies SQL or uses service keys.
 * Read docs/SMART_ASSISTANT_RETRIEVAL_HANDOFF_2026-09-26.md before --run.
 */
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const corpus=JSON.parse(readFileSync(new URL('../docs/sa-retrieval-2026-09-26/EVALUATION_CASES.json',import.meta.url),'utf8'));
const mode=process.argv[2]??'--plan';
if(mode==='--plan'){
  console.log('OFFLINE PLAN ONLY. No requests, quota use, database writes or model calls.');
  console.table(corpus.cases.map(({id,category,execution,requiresPage})=>({id,category,execution,currentPage:!!requiresPage})));
}else if(mode==='--run'){
  await run().catch(error=>{console.error('Benchmark stopped:',error.message);process.exitCode=2;});
}else{console.error('Usage: node scripts/benchmark-smart-assistant-retrieval.mjs [--plan|--run]');process.exitCode=2;}
async function run(){
  if(process.env.SA_RETRIEVAL_BENCH_ACK!=='paid-turns-preview-is-not-isolated')throw Error('Explicit SA_RETRIEVAL_BENCH_ACK is required. This sends reserved/possibly paid turns.');
  const required=name=>{const value=process.env[name];if(!value)throw Error(`Missing ${name}`);return value;};
  const base=new URL(required('SA_RETRIEVAL_BENCH_BASE_URL'));
  if(base.host!==required('SA_RETRIEVAL_BENCH_ALLOWED_HOST')||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Use an exact allowlisted origin, without credentials, path, query or fragment.');
  if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw Error('HTTPS required except localhost.');
  const cookie=readFileSync(required('SA_RETRIEVAL_BENCH_COOKIE_FILE'),'utf8').trim();
  if(!cookie||/[\r\n]/.test(cookie))throw Error('Cookie file must contain a single HTTP Cookie header value, not JSON or a header name.');
  const conversationId=required('SA_RETRIEVAL_BENCH_CONVERSATION_ID');
  const companyId=required('SA_RETRIEVAL_BENCH_COMPANY_ID');
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if(!uuid.test(conversationId)||!uuid.test(companyId))throw Error('Supply an existing owned test conversation/company UUID.');
  const selected=required('SA_RETRIEVAL_BENCH_CASES').split(',').map(s=>s.trim());
  if(new Set(selected).size!==selected.length||selected.length>50)throw Error('Select at most 50 unique case IDs.');
  const rows=selected.map(id=>{const row=corpus.cases.find(c=>c.id===id);if(!row||row.execution!=='automated-read')throw Error(`Case ${id} is unknown or manual-only.`);return row;});
  const pathname=process.env.SA_RETRIEVAL_BENCH_PATHNAME??null;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(row.requiresPage&&!pathname)throw Error(`${row.id} requires SA_RETRIEVAL_BENCH_PATHNAME.`);
    if(row.requiresPrevious&&rows[i-1]?.id!==row.requiresPrevious)throw Error(`${row.id} must immediately follow ${row.requiresPrevious}.`);
    row.resolvedPrompt=row.prompt.replace(/\{\{([A-Z_]+)\}\}/g,(_match,key)=>{
      const value=required('SA_RETRIEVAL_BENCH_'+key);
      if(value.length>120||/[\r\n\u0000-\u001f]/.test(value))throw Error(`Invalid ${key} fixture value.`);
      if(key==='QUOTE_NUMBER'&&!/^\d{1,12}$/.test(value))throw Error('QUOTE_NUMBER must be numeric.');
      if(key==='CURRENCY'&&!/^[A-Z]{3}$/.test(value))throw Error('CURRENCY must be a three-letter code.');
      return value;
    });
  }
  const repeats=Number(process.env.SA_RETRIEVAL_BENCH_REPEATS??1);
  if(!Number.isInteger(repeats)||repeats<1||repeats>3)throw Error('Repeats must be 1, 2 or 3.');
  const out=required('SA_RETRIEVAL_BENCH_OUTPUT');
  const label=required('SA_RETRIEVAL_BENCH_LABEL'); // e.g. baseline-luna or speed-only; not an assertion about deployed flags
  writeFileSync(out,JSON.stringify({event:'sa_benchmark_metadata',version:1,label,phase:'P1.6',cases:selected,repeats,createdAt:new Date().toISOString(),note:'Operator-supplied deployment label. Timings are real HTTP turn duration, not browser rendering or accuracy scores.'})+'\n',{flag:'wx',mode:0o600});
  const headers={Cookie:cookie,Origin:base.origin,'Content-Type':'application/json'};
  const call=async(path,body)=>{
    const response=await fetch(new URL(path,base),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(120_000)});
    return {response,body:await response.json().catch(()=>null)};
  };
  for(let repetition=1;repetition<=repeats;repetition++)for(const row of rows){
    // Preflight deliberately outside the measured turn; never bypass actual turn admission.
    const preflight=await call('/api/smart-assistant/v2/session?conversationId='+encodeURIComponent(conversationId));
    const s=preflight.body;
    if(preflight.response.status!==200||s?.enabled!==true||s.access?.companyId!==companyId||s.activeRunId||!s.access?.phases?.p1||s.access.phases.p4!==false||(s.access.phases.p3===true&&s.access.writePolicy!=='propose_then_confirm'))throw Error('Preflight failed: owned idle conversation, same company, P1 on, P4 off and P3 (if enabled) propose_then_confirm are required. P2/P3 may remain live; this harness never presses confirmation buttons.');
    const clientRequestId=randomUUID();
    const start=performance.now();
    let result;
    try{result=await call('/api/smart-assistant/turn',{conversationId,message:row.resolvedPrompt,clientRequestId,pageContext:{companyId,pathname:row.nullPage?null:pathname}});}
    catch{
      appendFileSync(out,JSON.stringify({event:'sa_benchmark_turn',caseId:row.id,repetition,clientRequestId,status:'transport_uncertain',wallMs:Math.round(performance.now()-start)})+'\n');
      throw Error('Turn transport failed or timed out. The server may still be working; reconcile its original request before continuing. No retry was sent.');
    }
    const b=result.body;
    const entry={event:'sa_benchmark_turn',caseId:row.id,repetition,clientRequestId,runId:b?.run_id??null,status:b?.status??'http_error',httpStatus:result.response.status,wallMs:Math.round(performance.now()-start),serverTiming:result.response.headers.get('server-timing'),errorCode:b?.error_code??null,replyCharacters:typeof b?.reply==='string'?b.reply.length:null};
    appendFileSync(out,JSON.stringify(entry)+'\n');
    console.log(row.id,entry.httpStatus,entry.status,entry.wallMs+'ms');
    if(result.response.status!==200||b?.status!=='completed')throw Error('Turn did not complete canonically. Stop and reconcile; never convert a retry into a new logical request.');
  }
  console.log('Recorded real turn timings. Check sa_retrieval_capabilities to prove which deployed tools/flags were active; the deployment label alone is not proof. Review correctness/cards in the test conversation and join runId to server telemetry; latency alone is not a pass.');
}
