/** Executable SOURCE tests with explicit Next/Supabase mocks. Not a live browser
 * or Supabase test, not proof of cookie persistence on a real iPhone. */
const { mocks, root } = require('../sa-speed-test-loader.cjs');
const assert = require('node:assert/strict'), test = require('node:test');
const path = require('node:path');
const load = f => require(path.join(root, f));
const contract = load('app/lib/auth/resume-contract.ts');
const { safeReturnPath, loginReturnPath, workspaceResumeDestination, parseResumeResult, suppressAutomaticResume, markResumeDestination } = contract;
const { probeSessionDestination, authFailureCategory } = load('app/lib/auth/session-probe.server.ts');
const { createLoginRecovery } = load('app/lib/auth/login-recovery.ts');
const { createAuthCookieBatch } = load('app/lib/supabase/cookie-batch.ts');
const { authCookieInventory, createSessionTrace } = load('app/lib/auth/session-trace.ts');
const delivery = '12345678-1234-4234-9234-123456789abc';

for (const value of ['//evil.example', '/\\evil.example', '/%5cevil.example', '/%2f%2fevil.example', '/%252f%252fevil.example', '/foo\nbar','https://evil.example','javascript:alert(1)', '/auth/signout', '/api/admin/run', '/demo-one/assistant', '/login?redirect=/login', '/2fa?redirect=//evil', '/a/../login', '/%61uth/callback', '/foo%00bar', '/foo%ZZ', ' /assistant']) {
 test(`return path refuses ${JSON.stringify(value)}`,()=>assert.equal(safeReturnPath(value), null));
}
for(const value of ['/assistant','/acme/assistant','/acme/quotes/123?tab=lines',`/pwa/open?delivery=${delivery}`,'/acme/quotes?q=Jim%20Smith']) {
 test(`return path keeps ${value}`,()=>assert.equal(safeReturnPath(value),value));
}
test('redirect preferred; legacy next supported; invalid values fall back',()=>{
 assert.equal(loginReturnPath(new URLSearchParams('next=/assistant')), '/assistant');
 assert.equal(loginReturnPath(new URLSearchParams('redirect=/acme&next=/assistant')), '/acme');
 assert.equal(loginReturnPath(new URLSearchParams('redirect=//evil')), '/');
});
test('workspace destination never trusts a slug supplied by client',()=>{
 assert.equal(workspaceResumeDestination('/other-company/quotes/1','acme'),'/acme');
 assert.equal(workspaceResumeDestination('/acme-two/assistant','acme'),'/acme');
 assert.equal(workspaceResumeDestination('/pricing','acme'),'/acme');
 assert.equal(workspaceResumeDestination('/assistant','acme'),'/acme/assistant');
 assert.equal(workspaceResumeDestination('/','acme'),'/acme');
 assert.equal(workspaceResumeDestination(`/pwa/open?delivery=${delivery}&company=other`,'acme'),`/pwa/open?delivery=${delivery}`);
 assert.equal(workspaceResumeDestination('/pwa/open?delivery=garbage','acme'),'/acme');
 assert.equal(workspaceResumeDestination('/assistant','../../evil'),null);
});
test('malformed response/foreign redirect cannot navigate; MFA is bounded separately',()=>{
 for(const x of [null,'<html>',{status:'authenticated',destination:'//evil'},{status:'mfa_required',destination:'/2fa?redirect=//evil'},{status:'authenticated',destination:'/auth/verify?token=x'}])assert.equal(parseResumeResult(x),null);
 assert.deepEqual(parseResumeResult({status:'mfa_required',destination:'/2fa?redirect=%2Facme%2Fassistant'}),{status:'mfa_required',destination:'/2fa?redirect=%2Facme%2Fassistant'});
});
test('logout/errors/signup/credential callbacks suppress automatic recovery',()=>{
 for(const query of ['signedOut=1','error=auth_failed','signup=pending','code=sensitive','token_hash=sensitive'])assert.equal(suppressAutomaticResume(new URLSearchParams(query)),true);
 assert.equal(suppressAutomaticResume(new URLSearchParams(), '#access_token=secret'),true);
 assert.equal(suppressAutomaticResume(new URLSearchParams('redirect='+encodeURIComponent(markResumeDestination('/acme/assistant')))),true);
});

function clientFixture(overrides={}) {
 const calls=[];
 const data = { user:{id:'USER-A',is_anonymous:false}, authError:null,
  profile:{company_id:'COMPANY-A',mfa_required:false},profileError:null,
  company:{slug:'acme',onboarding_completed_at:'2026-01-01'},companyError:null,
  aal:{currentLevel:'aal1',nextLevel:'aal1'},aalError:null,...overrides };
 const client={auth:{getUser:async()=>{calls.push(['getUser']);return {data:{user:data.user},error:data.authError};},
  mfa:{getAuthenticatorAssuranceLevel:async()=>{calls.push(['mfa']);return {data:data.aal,error:data.aalError};}}},
  from(table){const q={select(fields){calls.push(['select',table,fields]);return q;},eq(field,value){calls.push(['eq',table,field,value]);return q;},async maybeSingle(){return table==='users'?{data:data.profile,error:data.profileError}:{data:data.company,error:data.companyError};}};return q;}};
 return {client,calls,data};
}
test('verified normal session resolves once through user + tenant predicates',async()=>{
 const {client,calls}=clientFixture();
 assert.deepEqual(await probeSessionDestination(client,'/assistant'),{status:'authenticated',destination:'/acme/assistant'});
 assert.equal(calls.filter(x=>x[0]==='getUser').length,1);
 assert.ok(calls.some(x=>JSON.stringify(x)===JSON.stringify(['eq','users','id','USER-A'])));
 assert.ok(calls.some(x=>JSON.stringify(x)===JSON.stringify(['eq','companies','id','COMPANY-A'])));
});
test('notification resumes via the protected resolver, never a payload-auth shortcut',async()=>{
 const {client}=clientFixture();assert.deepEqual(await probeSessionDestination(client,`/pwa/open?delivery=${delivery}`),{status:'authenticated',destination:`/pwa/open?delivery=${delivery}`});
});
for(const err of [{name:'AuthSessionMissingError'}, {code:'refresh_token_not_found'}, {code:'session_expired'}, {status:401}]) {
 test(`invalid session never resumes ${JSON.stringify(err)}`,async()=>{const {client,calls}=clientFixture({user:null,authError:err});const result=await probeSessionDestination(client,'/assistant');assert.equal(result.status,'anonymous');assert.equal(calls.length,1);});
}
for(const err of [{name:'AuthRetryableFetchError'}, {status:429}, {status:503}, {name:'UnknownProviderError',message:'SECRET'}]) {
 test(`unverified error is not logout ${JSON.stringify(err)}`,async()=>{const {client}=clientFixture({user:null,authError:err});assert.deepEqual(await probeSessionDestination(client,'/assistant'),{status:'unavailable'});});
}
test('demo/anonymous Auth user never resumes paid namespace',async()=>{const {client,calls}=clientFixture({user:{id:'DEMO',is_anonymous:true}});assert.equal((await probeSessionDestination(client,'/assistant')).status,'anonymous');assert.equal(calls.length,1);});
test('MFA not completed returns challenge with exact intended destination',async()=>{const {client}=clientFixture({profile:{company_id:'COMPANY-A',mfa_required:true},aal:{currentLevel:'aal1',nextLevel:'aal2'}});assert.deepEqual(await probeSessionDestination(client,`/pwa/open?delivery=${delivery}`),{status:'mfa_required',destination:'/2fa?redirect='+encodeURIComponent(`/pwa/open?delivery=${delivery}`)});});
test('completed MFA resumes; missing MFA data/config fails closed',async()=>{for(const aal of [null,{currentLevel:'aal1',nextLevel:'aal1'}]){const {client}=clientFixture({profile:{company_id:'COMPANY-A',mfa_required:true},aal});assert.equal((await probeSessionDestination(client,'/assistant')).status,'unavailable');}const {client}=clientFixture({profile:{company_id:'COMPANY-A',mfa_required:true},aal:{currentLevel:'aal2',nextLevel:'aal2'}});assert.equal((await probeSessionDestination(client,'/assistant')).status,'authenticated');});
test('profile/company/MFA errors never become false unauthenticated results',async()=>{for(const o of [{profileError:{message:'x'}},{companyError:{message:'x'}},{company:null},{aalError:{message:'x'}}]){const {client}=clientFixture(o);assert.equal((await probeSessionDestination(client,'/assistant')).status,'unavailable');}});
test('verified user without onboarded membership goes to existing onboarding, not login',async()=>{for(const o of [{profile:null},{company:{slug:'acme',onboarding_completed_at:null}}]){const {client}=clientFixture(o);assert.deepEqual(await probeSessionDestination(client,'/assistant'),{status:'onboarding',destination:'/onboarding'});}});

function browserFixture(overrides={}) {
 let search=new URLSearchParams(), now=100000, visible=true, online=true;
 const states=[], navigations=[], probes=[], store=new Map();
 const env={search:()=>search,hash:()=>'',visible:()=>visible,online:()=>online,now:()=>now,
  readStorage:k=>store.get(k)??null,writeStorage:(k,v)=>store.set(k,v),
  probe:async(...args)=>{probes.push(args);return {status:'authenticated',destination:'/acme/assistant'};},
  navigate:p=>navigations.push(p),state:s=>states.push(s),...overrides};
 const controller=createLoginRecovery(env);
 return {env,controller,states,navigations,probes,store,setSearch:s=>{search=new URLSearchParams(s);},advance:n=>{now+=n;},hide:()=>{visible=false;},show:()=>{visible=true;},offline:()=>{online=false;},online:()=>{online=true;}};
}
test('restored login with a valid session opens workspace without signIn or push',async()=>{const b=browserFixture();await b.controller.start('pageshow');assert.equal(b.probes.length,1);assert.deepEqual(b.states,['checking','navigating']);assert.deepEqual(b.navigations,[markResumeDestination('/acme/assistant')]);b.controller.dispose();});
test('anonymous login stays form; later foreground can verify newly available cookies',async()=>{let n=0;const b=browserFixture({probe:async()=>++n===1?{status:'anonymous',reason:'missing'}:{status:'authenticated',destination:'/acme/assistant'}});await b.controller.start();assert.equal(b.states.at(-1),'form');b.advance(3000);await b.controller.start('foreground');assert.equal(b.navigations.length,1);b.controller.dispose();});
test('explicit logout does not get undone by resume, including manual',async()=>{const b=browserFixture();b.setSearch('signedOut=1');await b.controller.start();await b.controller.start('manual');assert.equal(b.probes.length,0);assert.equal(b.navigations.length,0);b.controller.dispose();});
test('no storage access is required to recover a valid existing session',async()=>{const b=browserFixture({readStorage:()=>{throw Error('denied');},writeStorage:()=>{throw Error('denied');}});await b.controller.start();assert.equal(b.navigations.length,1);b.controller.dispose();});
test('loop guard survives unavailable storage via redirect query marker',async()=>{const b=browserFixture({readStorage:()=>{throw Error('denied');}});b.setSearch('redirect='+encodeURIComponent(markResumeDestination('/acme/assistant')));await b.controller.start();assert.deepEqual(b.states,['loop']);assert.equal(b.probes.length,0);b.controller.dispose();});
test('storage-based loop guard applies even if a page dropped the return query',async()=>{const b=browserFixture();b.store.set(contract.RESUME_STORAGE_KEY,'99900');await b.controller.start();assert.equal(b.states.at(-1),'loop');assert.equal(b.probes.length,0);await b.controller.start('manual');assert.equal(b.probes.length,1);b.controller.dispose();});
test('network failure/offline state never pretends the session has expired',async()=>{const b=browserFixture({probe:async()=>{throw Error('offline');}});b.offline();await b.controller.start();assert.deepEqual(b.states,['unavailable']);b.online();await b.controller.start('online');assert.equal(b.states.at(-1),'unavailable');assert.equal(b.navigations.length,0);b.controller.dispose();});
test('duplicate lifecycle events do not start concurrent session refreshes',async()=>{let resolve;const b=browserFixture({probe:()=>new Promise(r=>{resolve=r;})});const a=b.controller.start();const count=b.states.length;await b.controller.start('pageshow');await b.controller.start('foreground');assert.equal(b.states.length,count);resolve({status:'anonymous',reason:'missing'});await a;b.controller.dispose();});
test('credential entry fences late verification and later auto recovery',async()=>{let resolve;const b=browserFixture({probe:()=>new Promise(r=>{resolve=r;})});const work=b.controller.start();b.controller.enteringCredentials();resolve({status:'authenticated',destination:'/acme/assistant'});await work;assert.equal(b.navigations.length,0);b.advance(5000);await b.controller.start('foreground');assert.equal(b.navigations.length,0);b.controller.dispose();});
test('hidden or unmounted page cannot navigate from late response',async()=>{for(const teardown of ['hide','dispose']){let resolve;const b=browserFixture({probe:()=>new Promise(r=>{resolve=r;})});const work=b.controller.start();if(teardown==='hide'){b.hide();b.controller.suspend();}else b.controller.dispose();resolve({status:'authenticated',destination:'/acme/assistant'});await work;assert.equal(b.navigations.length,0);b.controller.dispose();}});
test('feature-disabled response stops repeated checks for the mounted login document',async()=>{let count=0;const b=browserFixture({probe:async()=>{count++;return {status:'disabled'};}});await b.controller.start();b.advance(5000);await b.controller.start('foreground');assert.equal(count,1);b.controller.dispose();});

test('inventory has no values or arbitrary client-supplied cookie names',()=>{const result=authCookieInventory('sb-qcp-auth.0=VERYSECRET; sb-qcp-auth.2=X; sb-qcp-auth.0=Y; sb-qcp-demo-auth=DEMO; sb-mysecret-name=NO');assert.equal(result.normalCount,3);assert.equal(result.duplicateNames,true);assert.equal(result.chunkGap,true);assert.equal(result.demoCount,1);assert.ok(!JSON.stringify(result).includes('SECRET'));assert.ok(!JSON.stringify(result).includes('mysecret'));});
test('trace captures ORIGINAL cookies, not mutated refresh jar; no tokens/URLs/user IDs',()=>{process.env.PWA_SESSION_DIAGNOSTICS_ENABLED='true';const req=new Request('https://app.quote-core.com/assistant?token=SECRET',{headers:{cookie:'sb-qcp-auth.0=SECRET'}});const seen=[],old=console.info;console.info=(...v)=>seen.push(v);try{const trace=createSessionTrace(req,'middleware');req.headers.set('cookie','');trace.finish('verified',{names:['sb-qcp-auth.0'],deletions:0});assert.equal(seen[0][1].received.normalCount,1);assert.ok(!JSON.stringify(seen).includes('SECRET'));assert.equal(seen[0][1].entry,'assistant_entry');}finally{console.info=old;delete process.env.PWA_SESSION_DIAGNOSTICS_ENABLED;}});

// Minimal framework adapter: response serialization is asserted here, but only
// the live Next build/device tests can establish real framework cookie behavior.
class MockResponse extends Response {
 constructor(body=null,init={}){super(body,init);this.cookieRows=[];this.cookies={set:c=>{this.cookieRows.push(c);this.headers.append('set-cookie',`${c.name}=${c.value}; Path=${c.path??'/'}${c.maxAge!==undefined?`; Max-Age=${c.maxAge}`:''}`);}};}
 static json(value,init={}){return new MockResponse(JSON.stringify(value),{...init,headers:{'content-type':'application/json',...init.headers}});}
 static redirect(url,status=307){return new MockResponse(null,{status,headers:{location:String(url)}});}
 static next(options={}){const r=new MockResponse();r.forwarded=options.request;return r;}
}
function request(url,extra={}) {
 const req=new Request(url,{headers:{cookie:'sb-qcp-auth.0=OLD; sb-qcp-auth.1=OLD2',...extra}});
 const cookieMap=new Map((req.headers.get('cookie')??'').split(';').filter(Boolean).map(c=>c.trim().split('=')));
 req.cookies={getAll:()=>[...cookieMap].map(([name,value])=>({name,value})),set(name,value){cookieMap.set(name,value);req.headers.set('cookie',[...cookieMap].map(([n,v])=>`${n}=${v}`).join('; '));}};
 const parsed=new URL(req.url);parsed.clone=()=>new URL(req.url);req.nextUrl=parsed;return req;
}
let factory=()=>clientFixture().client;
mocks.set('next/server',{NextResponse:MockResponse});
mocks.set('@supabase/ssr',{createServerClient:(url,key,options)=>factory(options)});
mocks.set('@/app/lib/demo/request-gate',{guardDemoRequest:async()=>new MockResponse('demo-guard')});
const { GET:resume }=load('app/api/auth/resume/route.ts');
const { middleware }=load('middleware.ts');
function enabled(){process.env.PWA_SESSION_RECOVERY_ENABLED='true';process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-public-key';}

test('resume flag off, cross-origin and demo namespace cannot query Auth',async()=>{factory=()=>{throw Error('should not be called');};delete process.env.PWA_SESSION_RECOVERY_ENABLED;assert.equal((await (await resume(request('https://app.quote-core.com/api/auth/resume'))).json()).status,'disabled');enabled();assert.equal((await resume(request('https://app.quote-core.com/api/auth/resume',{origin:'https://evil.example'}))).status,403);assert.equal((await resume(request('https://app.quote-core.com/api/auth/resume',{'x-qcp-auth-namespace':'demo'}))).status,403);});
test('resume with no normal cookies does not contact provider or accept bearer auth',async()=>{enabled();factory=()=>{throw Error('must not query');};const r=await resume(request('https://app.quote-core.com/api/auth/resume',{cookie:'sb-qcp-demo-auth=DEMO',authorization:'Bearer ABC'}));assert.equal(r.status,401);assert.deepEqual(await r.json(),{status:'anonymous',reason:'missing'});assert.match(r.headers.get('cache-control'),/no-store/);});
test('resume preserves all refresh chunks/deletions on final response after profile failure',async()=>{enabled();factory=o=>{const f=clientFixture({profileError:{message:'offline'}});const get=f.client.auth.getUser;f.client.auth.getUser=async()=>{o.cookies.setAll([{name:'sb-qcp-auth.0',value:'NEW0',options:{path:'/',maxAge:15552000}},{name:'sb-qcp-auth.1',value:'NEW1',options:{path:'/',maxAge:15552000}}]);o.cookies.setAll([{name:'sb-qcp-auth.2',value:'',options:{path:'/',maxAge:0}}]);return get();};return f.client;};const r=await resume(request('https://app.quote-core.com/api/auth/resume'));assert.equal(r.status,503);assert.equal(r.cookieRows.length,3);assert.equal(r.cookieRows[2].maxAge,0);assert.equal(r.headers.get('vary'),'Cookie');assert.deepEqual(await r.json(),{status:'unavailable'});});
test('real route callback uses host/domain normal-cookie configuration and strips other tenant',async()=>{enabled();let options;factory=o=>{options=o;return clientFixture().client;};const r=await resume(request('https://app.quote-core.com/api/auth/resume?redirect=%2Fother%2Fquotes'));assert.equal(options.cookieOptions.name,'sb-qcp-auth');assert.equal(options.cookieOptions.domain,'.quote-core.com');assert.deepEqual(await r.json(),{status:'authenticated',destination:'/acme'});});
test('middleware no-user redirect is private/no-store even without a cookie write',async()=>{factory=()=>clientFixture({user:null,authError:{name:'AuthSessionMissingError'}}).client;const r=await middleware(request('https://quotecore-plus-testing.vercel.app/assistant',{cookie:''}));assert.equal(r.status,307);assert.match(r.headers.get('location'),/login\?redirect=%2Fassistant/);assert.match(r.headers.get('cache-control'),/private, no-store/);assert.equal(r.cookieRows.length,0);});
test('middleware login document is not evidence of logout and is not cacheable',async()=>{factory=()=>{throw Error('public login should not use provider in middleware');};const r=await middleware(request('https://quotecore-plus-testing.vercel.app/login'));assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);});
test('middleware passes refreshed cookies upstream and to final response; legacy removal survives',async()=>{factory=o=>{const f=clientFixture();const get=f.client.auth.getUser;f.client.auth.getUser=async()=>{o.cookies.setAll([{name:'sb-qcp-auth.0',value:'REFRESH',options:{maxAge:100}},{name:'sb-qcp-auth.1',value:'REFRESH1',options:{maxAge:100}}]);return get();};return f.client;};const req=request('https://app.quote-core.com/assistant',{cookie:'sb-qcp-auth.0=OLD; sb-fixture-auth-token=LEGACY'});const r=await middleware(req);assert.equal(r.status,200);assert.ok(r.cookieRows.some(c=>c.name==='sb-qcp-auth.0'&&c.value==='REFRESH'));assert.ok(req.cookies.getAll().some(c=>c.name==='sb-qcp-auth.1'));assert.ok(r.cookieRows.some(c=>c.name==='sb-fixture-auth-token'&&c.maxAge===0));});
test('middleware MFA redirect preserves refresh cookies',async()=>{factory=o=>{const f=clientFixture({profile:{company_id:'COMPANY-A',mfa_required:true},aal:{currentLevel:'aal1',nextLevel:'aal2'}});const get=f.client.auth.getUser;f.client.auth.getUser=async()=>{o.cookies.setAll([{name:'sb-qcp-auth.0',value:'REFRESH',options:{maxAge:100}}]);return get();};return f.client;};const r=await middleware(request('https://app.quote-core.com/assistant'));assert.match(r.headers.get('location'),/\/2fa\?/);assert.ok(r.cookieRows.some(c=>c.value==='REFRESH'));assert.match(r.headers.get('cache-control'),/no-store/);});
test('middleware network exception does not clear auth or present login',async()=>{factory=()=>({auth:{getUser:async()=>{throw Error('network');}}});const r=await middleware(request('https://app.quote-core.com/assistant'));assert.equal(r.status,503);assert.equal(r.headers.get('location'),null);assert.equal(r.cookieRows.length,0);});
test('middleware discards forged namespace headers; demo route remains on demo guard',async()=>{factory=()=>clientFixture().client;let req=request('https://app.quote-core.com/assistant',{'x-qcp-auth-namespace':'demo'});const r=await middleware(req);assert.equal(r.status,200);assert.equal(req.headers.get('x-qcp-auth-namespace'),'normal');req=request('https://quotecore-plus-testing.vercel.app/demo-foo/assistant');assert.equal(await (await middleware(req)).text(),'demo-guard');});

test('middleware MFA status/profile lookup failure is a 503, never bypass',async()=>{for(const overrides of [{aalError:{status:500}},{profileError:{message:'database unavailable'},aal:{currentLevel:'aal1',nextLevel:'aal2'}}]){factory=()=>clientFixture(overrides).client;const r=await middleware(request('https://app.quote-core.com/assistant'));assert.equal(r.status,503);assert.equal(r.headers.get('location'),null);assert.match(r.headers.get('cache-control'),/no-store/);}});
test('provider throttling/unknown error is unavailable, not an anonymous redirect',async()=>{for(const authError of [{status:429},{name:'NewErrorKind',status:400}]){factory=()=>clientFixture({user:null,authError}).client;const r=await middleware(request('https://app.quote-core.com/assistant'));assert.equal(r.status,503);assert.equal(r.headers.get('location'),null);}});
test('malformed SDK setup returns bounded unavailable JSON rather than a login guess',async()=>{enabled();factory=()=>{throw Error('bad config');};const r=await resume(request('https://app.quote-core.com/api/auth/resume'));assert.equal(r.status,503);assert.deepEqual(await r.json(),{status:'unavailable'});});
test('resume deadline/abort/cache policy applied to real fetch adapter arguments',async()=>{enabled();let opts;factory=o=>{opts=o;return clientFixture().client;};const old=global.fetch;let received;global.fetch=async(i,init)=>{received=init;return new Response('{}');};try{await resume(request('https://app.quote-core.com/api/auth/resume'));await opts.global.fetch('https://fixture.supabase.co/auth/v1/user');assert.equal(received.cache,'no-store');assert.ok(received.signal instanceof AbortSignal);}finally{global.fetch=old;}});
test('login recovery timeout exposes fallback and rejects late completion',async()=>{const realSet=global.setTimeout,realClear=global.clearTimeout;let expire,resolve;global.setTimeout=fn=>{expire=fn;return 999;};global.clearTimeout=()=>{};try{const b=browserFixture({probe:()=>new Promise(r=>{resolve=r;})});const work=b.controller.start();expire();assert.equal(b.states.at(-1),'unavailable');resolve({status:'authenticated',destination:'/acme/assistant'});await work;assert.equal(b.navigations.length,0);b.controller.dispose();}finally{global.setTimeout=realSet;global.clearTimeout=realClear;}});
test('pause/reopen can start a new check; old pre-suspend result cannot redirect',async()=>{let resolves=[];const b=browserFixture({probe:()=>new Promise(r=>resolves.push(r))});const first=b.controller.start();b.controller.suspend();b.advance(3000);const second=b.controller.start('foreground');resolves[0]({status:'authenticated',destination:'/wrong/assistant'});await first;assert.equal(b.navigations.length,0);resolves[1]({status:'authenticated',destination:'/acme/assistant'});await second;assert.deepEqual(b.navigations,[markResumeDestination('/acme/assistant')]);b.controller.dispose();});

let callbackClient;
mocks.set('@/app/lib/supabase/server',{createSupabaseServerClient:async()=>callbackClient});
mocks.set('@/app/lib/supabase/admin',{createAdminClient:()=>({})});
mocks.set('@/app/(auth)/[workspaceSlug]/settings/email-change-actions',{syncEmailChangeFromAuth:async()=>{}});
mocks.set('@/app/lib/data/ensure-company-has-collection',{ensureCompanyHasCollection:async()=>{}});
const { GET:callback }=load('app/auth/callback/route.ts');
test('existing OAuth callback preserves requested notification destination after verified exchange',async()=>{const f=clientFixture();callbackClient=f.client;callbackClient.auth.exchangeCodeForSession=async()=>({error:null});const r=await callback(new Request('https://app.quote-core.com/auth/callback?code=FIXTURE&redirect='+encodeURIComponent(`/pwa/open?delivery=${delivery}`)));assert.equal(r.headers.get('location'),`https://app.quote-core.com/pwa/open?delivery=${delivery}`);assert.match(r.headers.get('cache-control'),/no-store/);});
test('OAuth malicious return is ignored; normal existing-account destination retained',async()=>{callbackClient=clientFixture().client;callbackClient.auth.exchangeCodeForSession=async()=>({error:null});const r=await callback(new Request('https://app.quote-core.com/auth/callback?code=FIXTURE&redirect='+encodeURIComponent('//evil.example')));assert.equal(r.headers.get('location'),'https://app.quote-core.com/acme');});
test('OAuth existing free-tool draft handoff outranks generic requested assistant destination',async()=>{callbackClient=clientFixture().client;callbackClient.auth.exchangeCodeForSession=async()=>({error:null});const r=await callback(new Request('https://app.quote-core.com/auth/callback?code=FIXTURE&redirect=/assistant',{headers:{cookie:'qcp_doc_draft=example-draft'}}));assert.equal(r.headers.get('location'),'https://app.quote-core.com/acme?restore_doc=example-draft');});
test('OAuth unsuccessful exchange does not use requested destination',async()=>{callbackClient=clientFixture().client;callbackClient.auth.exchangeCodeForSession=async()=>({error:{status:400}});const r=await callback(new Request('https://app.quote-core.com/auth/callback?code=FIXTURE&redirect=/assistant'));assert.equal(r.headers.get('location'),'https://app.quote-core.com/login?error=auth_failed');});
const {POST:oldDebug}=load('app/api/auth-session-debug/route.ts');
test('legacy debug handler off by default and cross-origin requests cannot log or write DB',async()=>{let writes=0;const old=console.info;console.info=()=>{writes++;};try{delete process.env.PWA_SESSION_DIAGNOSTICS_ENABLED;await oldDebug(new Request('https://app.quote-core.com/api/auth-session-debug',{method:'POST',body:'sensitive'}));process.env.PWA_SESSION_DIAGNOSTICS_ENABLED='true';await oldDebug(new Request('https://app.quote-core.com/api/auth-session-debug',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{"referer":"sensitive"}'}));assert.equal(writes,0);}finally{console.info=old;delete process.env.PWA_SESSION_DIAGNOSTICS_ENABLED;}});
test('legacy diagnostic body is bounded and never logged even when enabled',async()=>{const seen=[],old=console.info;console.info=(...x)=>seen.push(x);process.env.PWA_SESSION_DIAGNOSTICS_ENABLED='true';try{for(const body of ['{"referer":"SECRET"}','X'.repeat(1025)])await oldDebug(new Request('https://app.quote-core.com/api/auth-session-debug',{method:'POST',headers:{origin:'https://app.quote-core.com','content-type':'application/json'},body}));assert.equal(seen.length,1);assert.ok(!JSON.stringify(seen).includes('SECRET'));}finally{console.info=old;delete process.env.PWA_SESSION_DIAGNOSTICS_ENABLED;}});


test('immediate hide/show bypasses throttle only for the cancelled probe',async()=>{
 const resolves=[];const b=browserFixture({probe:()=>new Promise(r=>resolves.push(r))});
 const first=b.controller.start();b.controller.suspend();
 const second=b.controller.start('foreground');assert.equal(resolves.length,2);
 resolves[0]({status:'authenticated',destination:'/wrong/assistant'});await first;
 assert.equal(b.navigations.length,0);resolves[1]({status:'anonymous',reason:'missing'});
 await second;assert.equal(b.states.at(-1),'form');b.controller.dispose();
});
test('restored pre-navigation login cannot remain stuck in navigating state',async()=>{
 const b=browserFixture();await b.controller.start();assert.equal(b.states.at(-1),'navigating');
 b.controller.suspend();await b.controller.start('pageshow');
 assert.equal(b.states.at(-1),'loop');assert.equal(b.navigations.length,1);b.controller.dispose();
});
test('credential interaction remains protected after quick hide/show',async()=>{
 const b=browserFixture();b.controller.enteringCredentials();b.controller.suspend();
 await b.controller.start('foreground');assert.equal(b.probes.length,0);
 assert.equal(b.states.at(-1),'form');b.controller.dispose();
});


test('probe records only bounded stage outcomes; no profile/token identity in observations',async()=>{
 const observations=[];const {client}=clientFixture();
 await probeSessionDestination(client,'/assistant',(stage,outcome)=>observations.push([stage,outcome]));
 assert.deepEqual(observations,[['auth','verified'],['profile','found'],['mfa','satisfied'],['company','ready']]);
 assert.ok(!JSON.stringify(observations).includes('USER-A'));
});
