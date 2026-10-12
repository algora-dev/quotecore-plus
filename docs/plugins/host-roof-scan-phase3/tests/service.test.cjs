const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {fixture,points,out}=require('../../host-roof-scan-phase1/tests/fixture.cjs');
const load=n=>require(path.join(out,'app/lib/free-tools/host-roof-scan',n));
const {HostOutlineService}=load('service');const {MemoryImageStore}=load('store');
const {MemoryReferenceStore}=load('reference-store');const {References}=load('references');
const {LIMITS,ScanError,RESOURCE_URI}=load('types');const {mcpWireResult}=load('image-delivery');
const {HOST_OUTLINE_TOOLS,OUTPUT_SCHEMA}=load('contract');
const secret='service-test-only-secret-do-not-deploy-0123456789';
const outline={name:'Synthetic test roof',points,pitch_degrees:null};
const now=Date.UTC(2026,9,11,18),clock=()=>now;
function make(opts={}){const store=opts.store||new MemoryImageStore(opts.now||clock),referenceStore=opts.referenceStore||new MemoryReferenceStore(opts.now||clock);return {store,referenceStore,service:new HostOutlineService({origin:'https://stage.example.test',secret,store,referenceStore,referenceMode:'opaque',now:clock,allowedFileOrigins:[],...opts})};}
async function setup(opts={}){const x=make(opts),u=await x.service.upload(await fixture());return {...x,planToken:u.structuredContent.planToken,frame:u.structuredContent.plan};}
async function submit(x,o=outline){return x.service.submit({planToken:x.planToken,observedImageId:x.frame.imageId,outcome:'proposed',roof_areas:[o],notes:['Synthetic software fixture; not a vision test.']});}
async function ready(x){const proposal=(await submit(x)).structuredContent;const opened=await x.service.open({planToken:x.planToken,proposalToken:proposal.proposalToken});return {proposal,opened,args:{planToken:x.planToken,proposalToken:proposal.proposalToken,reviewGate:opened._meta.reviewGate,outline,calibration:null,confirmed:true}};}
const rejects=(p,c)=>assert.rejects(p,e=>e.code===c);

test('panel upload and prepare use a short plan reference and unchanged canonical image bytes',async()=>{
 const x=await setup();assert.match(x.planToken,/^qcr1p_/);const r=await x.service.prepare({planToken:x.planToken});
 assert.equal(r.structuredContent.planToken,x.planToken);assert.deepEqual(r.structuredContent.plan,x.frame);
 const image=r.content.find(c=>c.type==='image');assert.equal(createHash('sha256').update(Buffer.from(image.data,'base64')).digest('hex'),x.frame.sha256);
});
test('reader still emits identical image content without structuredContent',async()=>{
 const x=await setup(),p=await x.service.prepare({planToken:x.planToken});const r=mcpWireResult('qc_get_roof_outline_image',await x.service.getImage({planToken:x.planToken}));
 assert.equal('structuredContent' in r,false);assert.equal(r.content.find(c=>c.type==='image').data,p.content.find(c=>c.type==='image').data);
});
test('submission returns a complete short review link, with no required follow-on open call',async()=>{
 const x=await setup(),r=await submit(x),d=r.structuredContent;
 assert.match(d.proposalToken,/^qcr1o_/);assert.ok(d.resultUrl.length<250);
 const h=new URLSearchParams(new URL(d.resultUrl).hash.slice(1));assert.equal(h.get('plan'),x.planToken);assert.equal(h.get('proposal'),d.proposalToken);
 assert.ok(r.content.some(c=>c.type==='text'&&c.text.includes(d.resultUrl)));assert.match(d.message,/exact resultUrl/);
 assert.equal(d.reviewToken,undefined);assert.equal(r._meta?.reviewGate,undefined);
});
test('open resolves references across service restarts sharing the same backing stores',async()=>{
 const x=await setup(),r=await submit(x);const restarted=make({store:x.store,referenceStore:x.referenceStore}).service;
 const o=await restarted.open({planToken:x.planToken,proposalToken:r.structuredContent.proposalToken});assert.deepEqual(o.structuredContent.outline,outline);
});
test('wrong image IDs and cross-image proposals fail closed',async()=>{
 const x=await setup();await rejects(x.service.submit({planToken:x.planToken,observedImageId:'wrong',outcome:'proposed',roof_areas:[outline],notes:[]}),'STALE_IMAGE');
 const p=await submit(x),other=await x.service.upload(await fixture());await rejects(x.service.open({planToken:other.structuredContent.planToken,proposalToken:p.structuredContent.proposalToken}),'STALE_IMAGE');
});
test('service enforces null model pitch independently of the MCP schema',async()=>{
 const x=await setup();for(const pitch of [25,0,89,undefined,'25'])await rejects(submit(x,{...outline,pitch_degrees:pitch}),'PITCH_NOT_SUPPORTED');
 const r=await submit(x);assert.equal(r.structuredContent.outline.pitch_degrees,null);
});
test('unreadable images do not create guessed geometry or a proposal reference',async()=>{
 const x=await setup();const r=await x.service.submit({planToken:x.planToken,observedImageId:x.frame.imageId,outcome:'unable_to_identify',roof_areas:[],notes:['Matching pixels not visible.']});
 assert.equal(r.structuredContent.status,'cannot_identify');assert.equal(r.structuredContent.proposalToken,undefined);assert.equal(r.structuredContent.outline,undefined);
});
test('UI-only gate remains out of model-visible content; confirm is not an MCP tool',async()=>{
 const x=await setup(),{opened}=await ready(x);assert.ok(opened._meta.reviewGate);assert.equal(opened.structuredContent.reviewGate,undefined);
 assert.ok(!JSON.stringify(opened.content).includes(opened._meta.reviewGate));assert.equal((await x.service.call('confirm',{})).structuredContent.code,'UNKNOWN_TOOL');
 assert.ok(!HOST_OUTLINE_TOOLS.some(t=>/confirm/.test(t.name)));
});
test('a proposal cannot masquerade as a reviewed reference; explicit confirmation is mandatory',async()=>{
 const x=await setup(),{proposal,args}=await ready(x);await rejects(x.service.export({reviewToken:proposal.proposalToken}),'INVALID_REFERENCE');
 await rejects(x.service.confirm({...args,confirmed:false}),'REVIEW_REQUIRED');await rejects(x.service.confirm({...args,reviewGate:'invalid'}),'INVALID_TOKEN');
});
test('reviewer pitch and calibration round-trip through confirm, export and reopening',async()=>{
 const x=await setup(),{proposal,args}=await ready(x),calibration={start:{x:100,y:100},end:{x:700,y:100},realLength:30,unit:'m'};
 const c=(await x.service.confirm({...args,outline:{...outline,pitch_degrees:25},calibration})).structuredContent;
 assert.match(c.reviewToken,/^qcr1r_/);assert.equal(new URLSearchParams(new URL(c.resultUrl).hash.slice(1)).get('review'),c.reviewToken);
 const e=(await x.service.export({reviewToken:c.reviewToken})).structuredContent;
 assert.equal(e.outline.pitch_degrees,25);assert.equal(e.measurements.pitchApplied,true);assert.ok(Math.abs(e.measurements.surfaceArea/e.measurements.planArea-1/Math.cos(25*Math.PI/180))<1e-12);
 const o=(await x.service.open({planToken:x.planToken,proposalToken:proposal.proposalToken,reviewToken:c.reviewToken})).structuredContent;
 assert.deepEqual(o.outline,c.outline);assert.deepEqual(o.calibration,calibration);assert.equal(o.reviewToken,c.reviewToken);
 for(const result of [c,e,o])for(const key of Object.keys(result))assert.ok(key in OUTPUT_SCHEMA.properties,'Output key missing schema: '+key);
});
test('recalibration creates an immutable new snapshot without changing the roof boundary',async()=>{
 const x=await setup(),{args}=await ready(x);const first=(await x.service.confirm(args)).structuredContent;
 const second=(await x.service.confirm({...args,outline:{...outline,pitch_degrees:30},calibration:{start:points[0],end:points[1],realLength:13.7,unit:'m'}})).structuredContent;
 assert.notEqual(first.reviewToken,second.reviewToken);const a=(await x.service.export({reviewToken:first.reviewToken})).structuredContent,b=(await x.service.export({reviewToken:second.reviewToken})).structuredContent;
 assert.deepEqual(a.outline.points,b.outline.points);assert.equal(a.measurements,null);assert.equal(a.outline.pitch_degrees,null);assert.equal(b.outline.pitch_degrees,30);
});
test('review snapshots cannot be reopened with another proposal even on the same image',async()=>{
 const x=await setup(),{args}=await ready(x),reviewToken=(await x.service.confirm(args)).structuredContent.reviewToken;
 const other=(await submit(x,{...outline,name:'Different proposal'})).structuredContent;
 await rejects(x.service.open({planToken:x.planToken,proposalToken:other.proposalToken,reviewToken}),'STALE_REVIEW');
 await rejects(x.service.open({reviewToken}),'INVALID_INPUT');
});
test('session expiry is inherited by proposal and review references without renewal',async()=>{
 let time=now;const x=await setup({now:()=>time}),{args,proposal}=await ready(x),c=(await x.service.confirm(args)).structuredContent;
 time+=LIMITS.ttlSeconds*1000;
 await rejects(x.service.prepare({planToken:x.planToken}),'EXPIRED');await rejects(x.service.open({planToken:x.planToken,proposalToken:proposal.proposalToken}),'EXPIRED');await rejects(x.service.export({reviewToken:c.reviewToken}),'EXPIRED');
});
test('failed upload reference allocation cleans up the just-written temporary image',async()=>{
 const base=new MemoryImageStore(clock);let written,removed;const store={put:async(k,...a)=>{written=k;return base.put(k,...a);},get:k=>base.get(k),remove:async k=>{removed=k;return base.remove(k);}};
 const refs={put:async()=>{throw new ScanError('REFERENCE_STORAGE_UNAVAILABLE','Test outage',503);},get:async()=>{throw Error('unused');}};
 const x=make({store,referenceStore:refs});await rejects(x.service.upload(await fixture()),'REFERENCE_STORAGE_UNAVAILABLE');assert.equal(removed,written);assert.ok(written);
});
test('image-integrity verification remains enforced with opaque references',async()=>{
 const x=await setup(),ticket=await new References(secret,x.referenceStore,'opaque',clock).read(x.planToken,'plan');await x.store.put(ticket.objectKey,Buffer.from('changed'),'image/png');
 await rejects(x.service.prepare({planToken:x.planToken}),'IMAGE_CHANGED');
});
test('legacy signed mode remains usable when the reliability option is disabled',async()=>{
 const x=await setup({referenceMode:'signed'});assert.ok(!x.planToken.startsWith('qcr1'));const {args}=await ready(x);
 const c=await x.service.confirm(args);assert.equal((await x.service.export({reviewToken:c.structuredContent.reviewToken})).structuredContent.status,'exported');
});
test('tool set stays five outline tools; resource version changes; model pitch schema remains null',()=>{
 assert.equal(HOST_OUTLINE_TOOLS.length,5);assert.match(RESOURCE_URI,/v3-session-reliability/);
 const submit=HOST_OUTLINE_TOOLS.find(t=>t.name==='qc_submit_roof_outline');assert.equal(submit.inputSchema.properties.roof_areas.items.properties.pitch_degrees.type,'null');
 assert.equal(submit.annotations.readOnlyHint,false);assert.equal(submit.annotations.idempotentHint,false);
 assert.ok(OUTPUT_SCHEMA.properties.outline.anyOf[0].properties.pitch_degrees.anyOf.some(s=>s.type==='number'));
});
