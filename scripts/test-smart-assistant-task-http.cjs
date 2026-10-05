/* Real task route and request-body validation; explicit Next/auth/RPC transports.
 * Does NOT prove Postgres ownership/RLS, a browser build, or a live session. */
const {root,mocks}=require('./sa-speed-test-loader.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
class AssistantV2Error extends Error{constructor(code,message,status=400){super(message);this.code=code;this.status=status;}}
let calls=[],authError=null,rpcError=null,accessCount=0;
const access={companyId:uuid(1),userId:uuid(2)},client={rpc(name,args){calls.push({name,args});assert.equal(name,'sa_v2_task_close');return Promise.resolve({data:view(),error:rpcError});}};
const view=()=>({id:uuid(3),version:2,status:'closed',label:'Finding: quotes',lastRunId:uuid(4),startedAt:'2026-09-28T12:00:00Z',updatedAt:'2026-09-28T12:01:00Z',expiresAt:'2026-09-28T12:15:00Z',closure:'solved',boundary:false});
const runtime={AssistantV2Error,requestAccess:async()=>{accessCount++;if(authError)throw authError;return {client,access};}};
mocks.set('next/server',{NextResponse:{json:(body,init={})=>new Response(JSON.stringify(body),{...init,headers:{'content-type':'application/json',...init.headers}})}});
mocks.set('./runtime.server',runtime);mocks.set('../v2/runtime.server',runtime);mocks.set('@/app/lib/smart-assistant/v2/runtime.server',runtime);
mocks.set('../v2/database',{batchClient:x=>x});
const {POST}=require(path.join(root,'app/api/smart-assistant/v2/task/route.ts'));
function reset(){calls=[];authError=null;rpcError=null;accessCount=0;process.env.SMART_ASSISTANT_TASK_CONTEXT_ENABLED='true';process.env.SMART_ASSISTANT_RESOLVER_ENABLED='true';}
function payload(extra={}){return {companyId:uuid(1),conversationId:uuid(5),taskId:uuid(3),version:1,command:'done',...extra};}
function request(body=payload(),headers={}){const req=new Request('https://example.test/api/smart-assistant/v2/task',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});req.nextUrl=new URL(req.url);return req;}
for(const [command,closure] of [['done','solved'],['move_on','abandoned']])test(command+' sends ONLY authenticated metadata close',async()=>{reset();const res=await POST(request(payload({command})));assert.equal(res.status,200);assert.equal((await res.json()).task.status,'closed');assert.equal(calls.length,1);assert.equal(calls[0].args.p_closure,closure);assert.equal(res.headers.get('cache-control'),'private, no-store');});
for(const [body,headers,status] of [
 [payload(),{origin:'https://attacker.test'},403],[payload(),{origin:''},403],[payload(),{'content-type':'text/plain'},400],
 ['{broken',{},400],['[]',{},400],[payload({version:0}),{},400],[payload({version:'1'}),{},400],[payload({command:['done']}),{},400],
 [payload({taskId:'not-uuid'}),{},400],[payload({entityId:uuid(99)}),{},400],[payload({command:'confirm'}),{},400],['"'+'x'.repeat(8300)+'"',{},413],
])test('invalid control rejected before auth/write: '+JSON.stringify([body,headers]).slice(0,90),async()=>{reset();const r=await POST(request(body,headers));assert.equal(r.status,status);assert.equal(calls.length,0);assert.equal(accessCount,0);});
test('cross-company body cannot pass the server account fence',async()=>{reset();const r=await POST(request(payload({companyId:uuid(8)})));assert.equal(r.status,403);assert.equal(calls.length,0);});
test('signed-out user cannot close a task',async()=>{reset();authError=new AssistantV2Error('unauthenticated','Sign in',401);assert.equal((await POST(request())).status,401);assert.equal(calls.length,0);});
test('disabled feature does not mutate task metadata',async()=>{reset();process.env.SMART_ASSISTANT_TASK_CONTEXT_ENABLED='false';const r=await POST(request());assert.equal(r.status,409);assert.equal(calls.length,0);});
for(const [code,status]of [['P1721',409],['P1722',409],['42501',403],['PGRST202',503]])test('database gate remains explicit: '+code,async()=>{reset();rpcError={code};const r=await POST(request());assert.equal(r.status,status);assert.equal(calls.length,1);assert.equal((await r.json()).ok,false);});
