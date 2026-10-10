require('../../tools/billing-p2/ts-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const originalLoad=Module._load;
let state;
const scope={accountId:'acct_fixture',mode:'test'};
const snap={kind:'custom',available:true,reason:'available',accountId:scope.accountId,mode:'test',subscriptionId:'sub_fixture',
 periodStart:'2026-10-05T10:30:00Z',periodEnd:'2026-11-05T10:30:00Z',quotesUsed:2,scanTokensUsed:12,assistantTasksUsed:3,storageUsedBytes:80,storagePendingBytes:10};
function reset(overrides={}) { state={model:'custom_setup',companyId:'11111111-1111-4111-8111-111111111111',calls:[],rpcResults:[],removeError:null,session:{user:{id:'user'}},quoteExists:true,
 ent:{billingModel:'custom_setup',isActive:true,customAccessStatus:'paid_period',customTools:{roofScan:true,offcuts:true,smartAssistant:true}},...overrides}; }
function builder(table,admin) {
 const chain={};for(const op of ['select','eq','limit'])chain[op]=(...a)=>{state.calls.push([table,op,...a]);return chain;};
 chain.maybeSingle=async()=>table==='companies'?{data:{billing_model:state.model},error:state.companyError??null}:
   {data:state.quoteExists?{id:'quote'}:null,error:null};return chain;
}
const admin={from:t=>builder(t,true),rpc:async(name,args)=>{state.calls.push(['rpc',name,args]);const r=state.rpcResults.shift();if(r instanceof Error)throw r;return r??{data:null,error:{code:'TEST_UNEXPECTED_RPC'}};},
 storage:{from:bucket=>({remove:async(paths)=>{state.calls.push(['remove',bucket,paths]);return {error:state.removeError};},list:async()=>({data:[{name:'plan.pdf',metadata:{size:60,mimetype:'application/pdf'}}],error:null})})}};
const user={auth:{getSession:async()=>({data:{session:state.session}})},from:t=>builder(t,false)};
Module._load=function(name,parent,main){
 if(name==='server-only')return {};
 if(name==='@/app/lib/supabase/admin')return {createAdminClient:()=>admin};
 if(name==='@/app/lib/supabase/server')return {createSupabaseServerClient:async()=>user,requireCompanyContext:async()=>({company_id:state.companyId})};
 if(name==='@/app/lib/storage/buckets')return {BUCKETS:{QUOTE_DOCUMENTS:'docs',COMPANY_LOGOS:'logos'}};
 if(name==='@/app/lib/data/ensure-company-has-collection')return {ensureCompanyHasCollection:async()=>null};
 if(name==='../environment'&&parent?.filename.replace(/\\/g,'/').includes('/custom/usage/'))return {customScope:()=>scope};
 if(name==='@/app/lib/billing/entitlements'||(name==='./entitlements'&&parent?.filename.endsWith('quote-creation.ts')))
 return {loadCompanyEntitlements:async()=>state.ent,assertCanUseStorage:async()=>{state.calls.push(['legacy-storage-check']);if(state.legacyQuotaError)throw state.legacyQuotaError;}};
 return originalLoad.call(this,name,parent,main);
};
const store=require('../../app/lib/billing/custom/usage/store.ts');
const storage=require('../../app/lib/billing/custom/usage/storage.ts');
const tools=require('../../app/lib/billing/custom/usage/tool-access.ts');
const quotes=require('../../app/lib/billing/quote-creation.ts');
const {finaliseUpload}=require('../../app/lib/files/upload-finaliser.ts');
const {withPurchasedScan}=require('../../app/lib/billing/custom/usage/scan-server.ts');
const {StorageQuotaExceededError,QuoteLimitReachedError,SubscriptionInactiveError}=require('../../app/lib/billing/errors.ts');
const ok=data=>({data,error:null});
const file=()=>({companyId:state.companyId,bucket:'docs',path:state.companyId+'/plan.pdf',size:60,kind:'document'});
test('legacy storage does not reserve purchased capacity',async()=>{reset({model:'legacy'});assert.equal(await storage.reservePurchasedStorage(file()),false);assert.equal(state.calls.filter(x=>x[0]==='rpc').length,0)});
test('custom storage uses server scope and measured bytes',async()=>{reset({rpcResults:[ok({kind:'custom'})]});assert.equal(await storage.reservePurchasedStorage(file()),true);const x=state.calls.find(x=>x[0]==='rpc');assert.equal(x[2].p_size,60);assert.equal(x[2].p_account_id,scope.accountId)});
test('storage SQL refusal becomes existing typed billing error',async()=>{reset({rpcResults:[{data:null,error:{code:'QCP06',details:JSON.stringify({usedBytes:80,limitBytes:100,attemptedBytes:60})}}]});await assert.rejects(storage.reservePurchasedStorage(file()),StorageQuotaExceededError)});
test('storage kind/scope transition is not accepted silently',async()=>{reset({rpcResults:[ok({kind:'legacy'})]});await assert.rejects(storage.reservePurchasedStorage(file()),/changed/)});
test('cleanup refuses referenced file without calling Storage API',async()=>{reset({rpcResults:[ok(false)]});assert.equal(await storage.cleanupUnregisteredCustomObject(file()),false);assert.equal(state.calls.filter(x=>x[0]==='remove').length,0)});
test('cleanup claims tombstone then removes object then acknowledges absence',async()=>{reset({rpcResults:[ok(true),ok(true)]});assert.equal(await storage.cleanupUnregisteredCustomObject(file()),true);assert.deepEqual(state.calls.filter(x=>['rpc','remove'].includes(x[0])).map(x=>x[0]==='rpc'?x[1]:'remove'),['qcp_claim_storage_cleanup','remove','qcp_ack_storage_removed'])});
test('failed Storage API removal never releases held capacity',async()=>{reset({rpcResults:[ok(true)],removeError:{message:'offline'}});await assert.rejects(storage.cleanupUnregisteredCustomObject(file()),/remains accounted/);assert.equal(state.calls.filter(x=>x[0]==='rpc').length,1)});
test('false removal acknowledgement remains false, not fabricated success',async()=>{reset({rpcResults:[ok(false)]});assert.equal(await storage.releaseRemovedCustomObject(file()),false)});
test('unknown company model fails instead of falling back to legacy',async()=>{reset({model:'typo'});await assert.rejects(store.isCustomUsageCompany(state.companyId),/not recognised/)});
test('database identity read failure fails closed',async()=>{reset({companyError:{message:'offline'}});await assert.rejects(store.isCustomUsageCompany(state.companyId),/could not/)});
test('usage read rejects wrong billing mode',async()=>{reset({rpcResults:[ok({...snap,mode:'live'})]});await assert.rejects(store.loadCustomUsage(state.companyId),/environment/)});
test('usage read keeps exact purchased-period timestamps',async()=>{reset({rpcResults:[ok(snap)]});assert.equal((await store.loadCustomUsage(state.companyId)).periodStart,snap.periodStart)});
test('legacy quote gateway does not use custom ledger RPCs',async()=>{reset({model:'legacy',rpcResults:[ok('new-quote')]});assert.equal(await quotes.createQuoteAtomic(state.companyId,'user',{customerName:'Legacy'}),'new-quote');assert.deepEqual(state.calls.filter(x=>x[0]==='rpc').map(x=>x[1]),['create_quote_atomic'])});
test('custom quote verifies environment, then leaves quota decision to atomic RPC',async()=>{reset({rpcResults:[ok({...snap,quotesUsed:10000}),ok('new-quote')]});assert.equal(await quotes.createQuoteAtomic(state.companyId,'user',{customerName:'Custom'}),'new-quote');assert.deepEqual(state.calls.filter(x=>x[0]==='rpc').map(x=>x[1]),['qcp_usage_snapshot','create_quote_atomic'])});
test('wrong environment stops quote before insertion',async()=>{reset({rpcResults:[ok({...snap,mode:'live'})]});await assert.rejects(quotes.createQuoteAtomic(state.companyId,'user',{customerName:'x'}));assert.equal(state.calls.filter(x=>x[0]==='rpc').length,1)});
test('quote cap maps exact paid-period detail to typed error',async()=>{reset({model:'legacy',rpcResults:[{data:null,error:{code:'P0002',details:'used=5 limit=5 period_start=2026-10-05T10:30:00+00:00 plan=custom_setup'}}]});await assert.rejects(quotes.createQuoteAtomic(state.companyId,'user',{customerName:'x'}),e=>e instanceof QuoteLimitReachedError&&e.used===5&&e.periodStart==='2026-10-05T10:30:00+00:00')});
test('inactive custom SQL maps to subscription error',async()=>{reset({rpcResults:[ok(snap),{data:null,error:{code:'QCP01'}}]});await assert.rejects(quotes.createQuoteAtomic(state.companyId,'user',{customerName:'x'}),SubscriptionInactiveError)});
test('quote payload cannot override company or server user id',async()=>{reset({model:'legacy',rpcResults:[ok('q')]});await quotes.createQuoteAtomic(state.companyId,'server-user',{customerName:'x',company_id:'attacker',created_by_user_id:'attacker'});const args=state.calls.find(x=>x[0]==='rpc')[2];assert.equal(args.p_company_id,state.companyId);assert.equal(args.p_user_id,'server-user');assert.equal(args.p_payload.company_id,undefined)});
test('legacy feature helper leaves original legacy checks to caller',async()=>{reset({ent:{billingModel:'legacy',isActive:false}});await tools.requirePurchasedTool(state.companyId,'offcuts')});
test('custom unpaid feature refused even if flag is true',async()=>{reset();state.ent.customAccessStatus='expired';await assert.rejects(tools.requirePurchasedTool(state.companyId,'offcuts'),/not available/)});
test('custom unpurchased Offcuts refused',async()=>{reset();state.ent.customTools.offcuts=false;await assert.rejects(tools.requirePurchasedTool(state.companyId,'offcuts'),/not available/)});
test('custom purchased active feature permitted',async()=>{reset();await tools.requirePurchasedTool(state.companyId,'offcuts')});
test('actual upload finalizer reserves actual file size for custom account',async()=>{reset({rpcResults:[ok({kind:'custom'})]});const f=file();const result=await finaliseUpload({companyId:f.companyId,bucket:f.bucket,storagePath:f.path,adminClient:admin});assert.equal(result.size,60);assert.equal(state.calls.some(x=>x[0]==='legacy-storage-check'),false);assert.equal(state.calls.find(x=>x[0]==='rpc')[2].p_size,60)});
test('legacy finalizer keeps old quota check',async()=>{reset({model:'legacy'});const f=file();await finaliseUpload({companyId:f.companyId,bucket:f.bucket,storagePath:f.path,adminClient:admin});assert.ok(state.calls.some(x=>x[0]==='legacy-storage-check'));assert.equal(state.calls.filter(x=>x[0]==='rpc').length,0)});
test('unauthenticated scan fails before billing/provider access',async()=>{reset({session:null});let n=0;const r=await withPurchasedScan(new Request('https://example.test/scan'),async()=>{n++;return new Response()});assert.equal(r.status,401);assert.equal(n,0);assert.equal(state.calls.length,0)});
test('legacy scan routes to original handler without custom protocol changes',async()=>{reset({model:'legacy'});let metered;const r=await withPurchasedScan(new Request('https://example.test/scan'),async(_,v)=>{metered=v;return Response.json({legacy:true})});assert.equal(metered,false);assert.deepEqual(await r.json(),{legacy:true});assert.equal(state.calls.filter(x=>x[0]==='rpc').length,0)});
test('custom malformed scan rejected before reservation',async()=>{reset();const req=new Request('https://example.test/scan',{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}});const r=await withPurchasedScan(req,async()=>new Response());assert.equal(r.status,400);assert.equal(state.calls.filter(x=>x[0]==='rpc').length,0)});
test('foreign quote cannot start a custom scan',async()=>{reset({quoteExists:false});const req=new Request('https://example.test/scan',{method:'POST',body:JSON.stringify({stage:'scan1',quoteId:state.companyId,image:'image',clientRequestId:'attempt_0001'})});const r=await withPurchasedScan(req,async()=>new Response());assert.equal(r.status,404);assert.equal(state.calls.filter(x=>x[0]==='rpc').length,0)});
