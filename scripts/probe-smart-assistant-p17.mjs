/** DEFAULT OFFLINE. Explicit read-only PostgREST probes. Never creates/finalizes
 * runs, seeds data, changes flags/permissions, or uses a service-role token.
 * Needs an existing legitimately admitted run in an isolated fixture company.
 */
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const corpus=JSON.parse(readFileSync(new URL('../docs/sa-p17-2026-09-26/DATABASE_PROBES.json',import.meta.url),'utf8'));
const mode=process.argv[2]??'--plan';
if(mode==='--plan'){console.log('OFFLINE PLAN ONLY. No SQL, network, fixtures or quota operations.');console.table(corpus.probes.map(p=>({id:p.id,source:p.plan.source,expect:p.expected.errorCode??p.expected.status??p.expected.mode})));}
else if(mode==='--probe')await run().catch(e=>{console.error('Probe stopped:',e.message);process.exitCode=2;});
else{console.error('Usage: node scripts/probe-smart-assistant-p17.mjs [--plan|--probe]');process.exitCode=2;}
async function run(){
 const need=k=>{const v=process.env['SA_P17_PROBE_'+k];if(!v)throw Error('Missing SA_P17_PROBE_'+k);return v;};
 if(need('ACK')!=='isolated-fixture-read-only')throw Error('Explicit isolated fixture acknowledgment required.');
 const origin=new URL(need('SUPABASE_URL'));
 if(origin.host!==need('ALLOWED_HOST')||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||(origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))))throw Error('Use an exact explicitly allowed HTTPS origin (localhost may use HTTP).');
 const token=readFileSync(need('USER_JWT_FILE'),'utf8').trim(),key=need('ANON_KEY');
 let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw Error('Use a real authenticated user JWT.');}
 if(claims.role!=='authenticated'||!claims.sub||/[\r\n]/.test(token))throw Error('Service-role/anonymous tokens are not allowed. Server still validates the JWT signature.');
 if(key.startsWith('eyJ')){let k;try{k=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());}catch{}if(k?.role!=='anon')throw Error('Use an anon/publishable API key, never a service-role key.');}
 else if(!key.startsWith('sb_publishable_'))throw Error('Use an anon/publishable API key.');
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const companyId=need('COMPANY_ID'),runId=need('ACTIVE_RUN_ID'),revision=Number(need('REVISION'));
 if(!uuid.test(companyId)||!uuid.test(runId)||!Number.isSafeInteger(revision)||revision<0)throw Error('Use valid fixture company/run UUIDs and permission revision.');
 // Owner's real testing account is never a scale-fixture destination.
 if(companyId==='dd3b3943-c760-4c21-9a9a-3a516d0c3356')throw Error('This probe refuses the owner account. Use isolated fixtures.');
 const rows=need('CASES').split(',').map(id=>{const p=corpus.probes.find(p=>p.id===id.trim());if(!p)throw Error('Unknown probe case.');return p;});
 if(rows.length>12||new Set(rows.map(p=>p.id)).size!==rows.length)throw Error('Choose at most 12 unique explicit probes.');
 const abortMs=Number(process.env.SA_P17_PROBE_ABORT_MS??15000);
 if(!Number.isInteger(abortMs)||abortMs<1||abortMs>20000)throw Error('Caller timeout must be 1–20000ms. A local abort is not proof of SQL cancellation.');
 const out=need('OUTPUT');
 const headers={apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const request=async(path,body,timeout=15000)=>{const r=await fetch(new URL(path,origin),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(timeout)});const data=await r.json().catch(()=>null);return {status:r.status,ok:r.ok,data:path.startsWith('/rest/v1/rpc/')&&Array.isArray(data)?data[0]??null:data};};
 const runtime=await request('/rest/v1/rpc/sa_v2_runtime',{});
 if(!runtime.ok||runtime.data?.company_id!==companyId||Number(runtime.data?.permission_revision)!==revision)throw Error('Authenticated runtime company/revision mismatch.');
 const co=await request('/rest/v1/companies?select=id,name,slug&id=eq.'+encodeURIComponent(companyId));
 if(!co.ok||co.data?.length!==1||!/^QCP P1[67] (?:E2E|Scale|Foreign)\b/.test(co.data[0].name)||!/^qcp-p1[67]-/.test(co.data[0].slug))throw Error('Only explicitly named disposable QCP P16/P17 fixture companies are allowed.');
 const cap=await request('/rest/v1/rpc/sa_v2_retrieval_capabilities',{p_run_id:runId,p_revision:revision});
 if(!cap.ok||cap.data?.intelligence_version!==1||cap.data.enabled!==true)throw Error('The existing admitted run or P1.7 capability is not active. Do not fabricate a run to bypass this gate.');
 writeFileSync(out,JSON.stringify({event:'p17_probe_metadata',createdAt:new Date().toISOString(),cases:rows.map(p=>p.id),note:'Real user-JWT RPC only. This probe does not prove SQL cancellation, full RLS matrix or model correctness.'})+'\n',{flag:'wx',mode:0o600});
 for(const row of rows){
  const plan=JSON.parse(JSON.stringify(row.plan).replace(/\{\{([A-Z_]+)\}\}/g,(_m,k)=>{const v=need(k);if(!uuid.test(v))throw Error('Fixture substitutions in probes must be UUIDs.');return v;}));
  const start=performance.now();let response;
  try{response=await request('/rest/v1/rpc/sa_v2_retrieval_query_v17',{p_run_id:runId,p_revision:revision,p_plan:plan},abortMs);}catch{
   appendFileSync(out,JSON.stringify({event:'p17_probe',id:row.id,status:'caller_transport_uncertain',wallMs:Math.round(performance.now()-start)})+'\n');
   throw Error('Caller timed out/transport failed. No retry sent. Separately inspect PostgreSQL activity/cancellation and reconcile the original run; a client abort is not a SQL cancellation pass.');
  }
  const d=response.data,e=row.expected;
  const entry={event:'p17_probe',id:row.id,httpStatus:response.status,wallMs:Math.round(performance.now()-start),mode:d?.mode,status:d?.status,errorCode:d?.code,rows:d?.rows?.length,complete:d?.complete,truncated:d?.truncated,coverage:d?.coverage??null};
  try{
   if(e.errorCode)assert.equal(d?.code,e.errorCode);
   else{
    assert.equal(response.ok,true,'RPC failure: run may have finished; no retry or synthetic admission is allowed');
    for(const k of ['mode','status','complete','truncated'])if(k in e)assert.equal(d?.[k],e[k],k);
    if('rowCount'in e)assert.equal(d.rows?.length,e.rowCount,'rowCount');
    if('metric0'in e)assert.equal(d.rows?.[0]?.metric_0,e.metric0,'metric0');
    if('tieCount'in e)assert.equal(d.rows?.[0]?._tie_count,e.tieCount,'tieCount');
    for(const k of ['matchedRows','missingValues','groupCount'])if(k in e)assert.equal(d.coverage?.[k],e[k],k);
   }
   entry.assertions='passed';
  }catch{entry.assertions='failed';appendFileSync(out,JSON.stringify(entry)+'\n');throw Error(`Probe ${row.id} failed; see bounded metadata. No source rows or credentials were logged.`);}
  appendFileSync(out,JSON.stringify(entry)+'\n');console.log(row.id,entry.assertions,entry.wallMs+'ms');
 }
 console.log('Probes finished. Preserve actual EXPLAIN/BUFFERS, isolation, timeout and application/engine evidence separately.');
}
