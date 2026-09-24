/**
 * Real HTTP integration harness for the three new V2 route files.
 * Run on the integrator's preview, never from this static handoff environment.
 * No fake admission rows, auth changes, quota edits or database writes here.
 * Fixture conversations/cards/proposals MUST come from normal application flows.
 * Context POSTs write only the supplied test conversation. Action writes require
 * a separate explicit opt-in. Never print cookies, transcripts or response bodies.
 * See docs/SMART_ASSISTANT_P1_P4_ACCEPTANCE.md for fixture format and SQL checks.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const file=process.env.SA_V2_FIXTURES;
if(!file||process.env.SA_V2_TEST_ACK!=='preview-is-not-isolated'){
 console.error('Set SA_V2_FIXTURES to a local secret fixture file and SA_V2_TEST_ACK=preview-is-not-isolated. Read the acceptance guide first.');process.exit(2);
}
const f=JSON.parse(readFileSync(file,'utf8'));
const base=new URL(f.baseUrl);if(!['https:','http:'].includes(base.protocol))throw new Error('Invalid test URL');
if(base.protocol==='http:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw new Error('HTTPS is required outside localhost');
if(!f.a?.cookie||!f.a?.companyId||!f.a?.conversationId)throw new Error('Supply an authenticated fixture user and owned conversation.');
const writes=process.env.SA_V2_TEST_WRITES==='1',phase=Number(f.phase??1),results=[];
const api='/api/smart-assistant/v2';const fakeId='00000000-0000-4000-8000-000000000009';
async function call(path,actor=f.a,data,options={}){
 const headers={...(actor?.cookie?{Cookie:actor.cookie}:{}),...(data!==undefined?{'Content-Type':'application/json',Origin:base.origin}:{}),...options.headers};
 const response=await fetch(new URL(path,base),{method:options.method??(data===undefined?'GET':'POST'),headers,body:options.raw??(data===undefined?undefined:JSON.stringify(data)),redirect:'manual',signal:AbortSignal.timeout(120000)});
 const body=await response.json().catch(()=>null);return{status:response.status,body,headers:response.headers};
}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(error){results.push({name,status:'FAIL',detail:error instanceof Error?error.message:'Failure'});console.log('FAIL',name);}}
function skip(name){results.push({name,status:'BLOCKED',detail:'Required explicit fixture or write opt-in missing.'});console.log('BLOCKED',name);}
function denied(response){assert.ok([401,403,404].includes(response.status),`Expected a denial, received ${response.status}`);}
let session;
await check('P1 session: authenticated capability and no-store',async()=>{const r=await call(api+'/session');assert.equal(r.status,200);assert.equal(r.body.enabled,true);assert.equal(r.body.access.companyId,f.a.companyId);assert.match(r.headers.get('cache-control')??'',/no-store/);});
await check('P1 session: unauthenticated cannot read conversation',async()=>denied(await call(api+'/session?conversationId='+f.a.conversationId,null)));
await check('P1 session: owned conversation returns validated arrays',async()=>{const r=await call(api+'/session?conversationId='+f.a.conversationId);assert.equal(r.status,200);for(const k of ['messages','cards','actions','runs'])assert.ok(Array.isArray(r.body[k]));session=r.body;});
await check('P1 session: unknown conversation is not disclosed',async()=>denied(await call(api+'/session?conversationId='+fakeId)));
for(const who of ['b','foreign']){
 if(f[who]?.cookie)await check(`P1 session: ${who} cannot read A conversation`,async()=>denied(await call(api+'/session?conversationId='+f.a.conversationId,f[who])));else skip(`P1 session: ${who} isolation`);
}
const context={conversationId:f.a.conversationId,companyId:f.a.companyId,pathname:`/${f.workspaceSlug}/quotes`};
await check('P1 context: same-origin owned write',async()=>assert.equal((await call(api+'/session',f.a,context)).status,200));
await check('P1 context: wrong workspace body cannot switch account',async()=>denied(await call(api+'/session',f.a,{...context,companyId:fakeId})));
await check('P1 context: foreign Origin refused',async()=>denied(await call(api+'/session',f.a,context,{headers:{Origin:'https://example.invalid'}})));
await check('P1 context: missing Origin refused',async()=>denied(await call(api+'/session',f.a,undefined,{method:'POST',raw:JSON.stringify(context),headers:{'Content-Type':'application/json'}})));
await check('P1 context: extra fields refused',async()=>assert.equal((await call(api+'/session',f.a,{...context,role:'owner'})).status,400));
await check('P1 context: malformed JSON refused',async()=>assert.equal((await call(api+'/session',f.a,context,{raw:'{'})).status,400));
await check('P1 context: oversized actual bytes refused',async()=>assert.equal((await call(api+'/session',f.a,{...context,pathname:'x'.repeat(9000)})).status,413));
const recordCard=session?.cards.find(c=>c.id===f.a.recordCardId&&c.content.kind==='records');
if(recordCard){
 const target=recordCard.content.options.find(o=>o.id===f.a.targetId)??recordCard.content.options[0];
 const nav={conversationId:f.a.conversationId,companyId:f.a.companyId,cardId:recordCard.id,target:{kind:target.kind,id:target.id}};
 await check('P1 navigation: verified card resolves actual expected destination',async()=>{const r=await call(api+'/navigation',f.a,nav);assert.equal(r.status,200);assert.equal(r.body.destination,f.expectedDestination);});
 await check('P1 navigation: forged target refused',async()=>denied(await call(api+'/navigation',f.a,{...nav,target:{...nav.target,id:fakeId}})));
 await check('P1 navigation: forged card refused',async()=>denied(await call(api+'/navigation',f.a,{...nav,cardId:fakeId})));
 if(f.b?.cookie)await check('P1 navigation: another member cannot replay A card',async()=>denied(await call(api+'/navigation',f.b,nav)));else skip('P1 navigation: same-company replay');
 await check('P1 navigation: cross-origin refused',async()=>denied(await call(api+'/navigation',f.a,nav,{headers:{Origin:'https://example.invalid'}})));
}else skip('P1 navigation: successful owned record card');
if(phase>=2){
 const card=session?.cards.find(c=>c.id===f.a.attentionCardId&&c.content.kind==='attention');
 if(card&&f.expectedAttention){await check('P2 attention: fixture counts and hidden/unavailable states',async()=>{for(const [key,expected] of Object.entries(f.expectedAttention)){const group=card.content.groups.find(g=>g.key===key);assert.ok(group);assert.equal(group.state,expected.state);assert.equal(group.count,expected.count);assert.ok(group.items.length<=10);}});}else skip('P2 attention fixture counts');
}
const actionPayload={actionId:fakeId,command:'confirm',proofDigest:'0'.repeat(64),version:1,companyId:f.a.companyId};
await check('P3 actions: unauthenticated denied',async()=>denied(await call(api+'/actions',null,actionPayload)));
await check('P3 actions: wrong-origin denied',async()=>denied(await call(api+'/actions',f.a,actionPayload,{headers:{Origin:'https://example.invalid'}})));
await check('P3 actions: arbitrary patch fields rejected',async()=>assert.equal((await call(api+'/actions',f.a,{...actionPayload,patch:{status:'sent'}})).status,400));
await check('P3 actions: typed/voice approval is not a command',async()=>assert.equal((await call(api+'/actions',f.a,{...actionPayload,command:'yes'})).status,400));
await check('P3 actions: foreign workspace denied',async()=>denied(await call(api+'/actions',f.a,{...actionPayload,companyId:fakeId})));
if(phase<3)await check('P3 actions: phase-off denies writes',async()=>denied(await call(api+'/actions',f.a,actionPayload)));
if(phase>=3){
 const proposed=session?.actions.find(a=>a.id===f.a.confirmActionId&&a.status==='proposed');
 if(proposed){
  const payload={...actionPayload,actionId:proposed.id,proofDigest:proposed.proofDigest,version:proposed.version};
  await check('P3 proof: changed digest conflicts before execution',async()=>assert.equal((await call(api+'/actions',f.a,{...payload,proofDigest:'f'.repeat(64)})).status,409));
  if(f.b?.cookie)await check('P3 proof: same-company different requester denied',async()=>denied(await call(api+'/actions',f.b,payload)));else skip('P3 requester binding');
  if(writes){await check('P3 confirmation: duplicate requests do not reapply',async()=>{const responses=await Promise.all([call(api+'/actions',f.a,payload),call(api+'/actions',f.a,payload)]);for(const r of responses){assert.equal(r.status,200);assert.equal(r.body.action.status,'committed');assert.equal(r.body.action.id,proposed.id);} });}else skip('P3 confirm/replay write test');
 }else skip('P3 proposed action fixture');
 const cancelled=session?.actions.find(a=>a.id===f.a.cancelActionId&&a.status==='proposed');
 if(cancelled&&writes)await check('P3 cancellation remains terminal on late confirmation',async()=>{const payload={...actionPayload,actionId:cancelled.id,proofDigest:cancelled.proofDigest,version:cancelled.version};const c=await call(api+'/actions',f.a,{...payload,command:'cancel'});assert.equal(c.status,200);assert.equal(c.body.action.status,'cancelled');const late=await call(api+'/actions',f.a,payload);assert.equal(late.body.action.status,'cancelled');});else skip('P3 cancel/late-confirm test');
}
if(phase>=4){
 const create=session?.actions.find(a=>a.id===f.a.creationActionId&&a.actionKind==='draft_create'&&a.status==='proposed');
 if(create&&writes)await check('P4 draft: concurrent confirm has one parent identity',async()=>{
  const payload={...actionPayload,actionId:create.id,proofDigest:create.proofDigest,version:create.version};
  const outcomes=await Promise.all([call(api+'/actions',f.a,payload),call(api+'/actions',f.a,payload)]);
  for(const response of outcomes){assert.equal(response.status,200);assert.ok(['applying','committed'].includes(response.body.action.status));}
  const state=await call(api+'/session?conversationId='+f.a.conversationId);const result=state.body.actions.find(a=>a.id===create.id);assert.equal(result.status,'committed');assert.ok(result.target?.id);assert.equal(result.target.kind,'draft_quote');
  const again=await call(api+'/actions',f.a,payload);assert.equal(again.body.action.target.id,result.target.id);
 });else skip('P4 draft creation/replay test');
}
if(process.env.SA_V2_TEST_REPORT)writeFileSync(process.env.SA_V2_TEST_REPORT,JSON.stringify({phase,results,note:'PASS does not replace the separate SQL, pricing and device gates. No sensitive response bodies logged.'},null,2));
console.log(JSON.stringify({passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,blocked:results.filter(x=>x.status==='BLOCKED').length}));
process.exitCode=results.some(x=>x.status==='FAIL')?1:results.some(x=>x.status==='BLOCKED')?2:0;
