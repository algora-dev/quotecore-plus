require('../../tools/billing-p2/ts-runtime.cjs');
const test = require('node:test'); const assert = require('node:assert/strict');
const c = require('../../app/lib/billing/custom/usage/contracts.ts');
const s = require('../../app/lib/billing/custom/usage/scan-contract.ts');
const ui = require('../../app/lib/billing/custom/usage/scan-client.ts');
const quoteId='11111111-1111-4111-8111-111111111111';
const parentId='22222222-2222-4222-8222-222222222222';
const outline=[{x:0,y:0},{x:8,y:0},{x:3,y:6}];
const input={stage:'scan1',quoteId,image:'base64image',qualityLevel:'high',canvasDimensions:{width:800,height:600}};
const snapshot={kind:'custom',available:true,reason:'available',accountId:'acct_fixture',mode:'test',subscriptionId:'sub_fixture',
 periodStart:'2026-10-05T10:30:00Z',periodEnd:'2026-11-05T10:30:00Z',quotesUsed:2,scanTokensUsed:12,assistantTasksUsed:3,storageUsedBytes:80,storagePendingBytes:10};
test('paid-period snapshot keeps exact timestamps and independently metered usage',()=>assert.deepEqual(c.parseUsageSnapshot(snapshot),snapshot));
for (const [k,v] of [['quotesUsed',null],['scanTokensUsed',-1],['assistantTasksUsed','200'],['storageUsedBytes',Number.MAX_SAFE_INTEGER+1],['storagePendingBytes',1.1],['accountId','missing'],['mode','production'],['periodEnd','2026-10-01'],['available',1]]) {
 test(`snapshot rejects invalid ${k}`,()=>assert.throws(()=>c.parseUsageSnapshot({...snapshot,[k]:v}),c.UsageError));
}
for (const [code,status] of [['QCP01',403],['QCP02',429],['QCP03',409],['QCP04',409],['QCP05',429],['QCP06',413],['QCP07',409],['QCP08',503],['42501',403],['22023',400],['unknown',503]]) {
 test(`${code} has stable user error status`,()=>assert.equal(c.usageError({code,details:'{"used":4}'}).httpStatus,status));
}
test('operational safety refusal does not tell customer to upgrade tasks',()=>assert.match(c.usageError({code:'QCP08'}).message,/not an instruction to buy/));
test('unknown DB errors do not expose raw SQL details',()=>assert.doesNotMatch(c.usageError({message:'secret sql password'}).message,/secret/));
test('canonical body hash ignores object order, not changed values',()=>{
 assert.equal(c.canonicalJson({z:[1,2],a:3}),c.canonicalJson({a:3,z:[1,2]}));assert.notEqual(s.digest({a:1}),s.digest({a:2}));
});
for (const bad of [NaN,Infinity,undefined,()=>0]) test(`non-JSON value ${String(bad)} rejected`,()=>assert.throws(()=>c.canonicalJson(bad)));
test('scan request normalizes default quality and page without retaining raw image in hash',()=>{
 const r=s.parseScanRequest({...input,qualityLevel:undefined},'attempt_0001');assert.equal(r.quality,'medium');assert.equal(r.pageId,null);assert.match(r.payloadHash,/^[a-f0-9]{64}$/);
});
for (const [k,v] of [['stage','scan4'],['quoteId','bad'],['pageId','bad'],['image',''],['qualityLevel','super'],['canvasDimensions',{width:0,height:3}],['pxPerMm',0]])
 test(`invalid scan ${k} refused before provider`,()=>assert.throws(()=>s.parseScanRequest({...input,[k]:v},'attempt_0001')));
test('new request key is not itself billable payload',()=>assert.equal(s.parseScanRequest({...input,clientRequestId:'attempt_0001'},null).payloadHash,s.parseScanRequest({...input,clientRequestId:'attempt_0002'},null).payloadHash));
test('header/body idempotency conflict is rejected',()=>assert.throws(()=>s.parseScanRequest({...input,clientRequestId:'attempt_0002'},'attempt_0001')));
test('changes to pitch/geometry invalidate same idempotency request',()=>assert.notEqual(s.parseScanRequest({...input,pxPerMm:2},'attempt_0001').payloadHash,s.parseScanRequest({...input,pxPerMm:3},'attempt_0001').payloadHash));
const two={...input,stage:'scan2',outlinePoints:outline,analysisDimensions:{width:800,height:600},pxPerMm:2};
const scan2Response={success:true,billingOperationId:parentId,data:{outlinePoints:outline,lines:[{id:'l1',p1:outline[0],p2:outline[1]}]},analysisDimensions:two.analysisDimensions,canvasDimensions:two.canvasDimensions};
test('free component tail proof matches exact paid response',()=>{
 const r2=s.parseScanRequest(two,'attempt_0002');
 const a3=ui.createComponentContinuation(ui.createCustomScanAttempt(two,'attempt_0002'),scan2Response,'attempt_0003');
 const r3=s.parseScanRequest(a3.body,a3.requestId);assert.equal(s.tailProof(r2,scan2Response),s.tailProof(r3));
});
test('tail cannot replace image or edit paid lines for a free new scan',()=>{
 const a=ui.createComponentContinuation(ui.createCustomScanAttempt(two,'attempt_0002'),scan2Response,'attempt_0003');
 const r=s.parseScanRequest(a.body,a.requestId);const r2=s.parseScanRequest({...a.body,image:'DIFFERENT'},a.requestId);assert.notEqual(s.tailProof(r),s.tailProof(r2));
 const r3=s.parseScanRequest({...a.body,lines:[]},a.requestId);assert.notEqual(s.tailProof(r),s.tailProof(r3));
});
test('tail without paid parent refused',()=>assert.throws(()=>s.parseScanRequest({...two,stage:'scan3',lines:[]},'attempt_0003')));
test('normal charged scan cannot attach a parent',()=>assert.throws(()=>s.parseScanRequest({...input,scanOperationId:parentId},'attempt_0003')));
test('client copies request body so UI mutations cannot alter retries',()=>{
 const b={...two,outlinePoints:structuredClone(outline)};const a=ui.createCustomScanAttempt(b,'attempt_0001');b.outlinePoints[0].x=900;assert.equal(a.body.outlinePoints[0].x,0);
});
test('client reuses stable id on transport retry and never adds automatic retry',async()=>{
 const calls=[];const fetch=async(...args)=>{calls.push(args);return new Response('{}')};const a=ui.createCustomScanAttempt(input,'attempt_0001');
 await ui.sendCustomScanAttempt(a,{fetch});await ui.sendCustomScanAttempt(a,{fetch});assert.equal(calls.length,2);assert.equal(calls[0][1].body,calls[1][1].body);assert.equal(calls[0][1].headers['Idempotency-Key'],'attempt_0001');
});
test('failed component response cannot create continuation',()=>assert.throws(()=>ui.createComponentContinuation(ui.createCustomScanAttempt(two),{...scan2Response,success:false})));
