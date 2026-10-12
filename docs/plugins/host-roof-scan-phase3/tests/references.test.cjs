const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createHash } = require('node:crypto');
const out = path.resolve(process.env.QC_TEST_OUT || '.host-outline-test');
const load = n => require(path.join(out, 'app/lib/free-tools/host-roof-scan', n));
const { References, REFERENCE_BYTES } = load('references');
const { MemoryReferenceStore, SupabaseReferenceStore } = load('reference-store');
const { Tickets } = load('tokens');
const { LIMITS, VERSION } = load('types');
const { referenceMode } = load('config');
const secret = 'unit-test-secret-only-0123456789abcdefghijklmnopqrstuvwxyz';
const now = Date.UTC(2026, 9, 11, 18);
function ticket(kind='plan') { return { v: VERSION, kind, expiresAt: now+LIMITS.ttlSeconds*1000,
  objectKey: 'host-outline-v1/2026-10-11/1791741600000-00000000-0000-0000-0000-000000000000',
  frame: { imageId:'image-unit-test', sha256:'a'.repeat(64), width:800, height:600, mimeType:'image/png', coordinateFrame:'qc-analysis-raster-v1' } }; }
const rejects = (p, code) => assert.rejects(p, e => e.code === code);
function memory(clock=()=>now) { const store=new MemoryReferenceStore(clock); return { store, refs:new References(secret,store,'opaque',clock) }; }

test('opaque reference has a 128-bit nonce, bounded length and exact round trip', async()=>{
 const {refs}=memory(), payload=ticket(), ref=await refs.issue(payload);
 assert.match(ref,/^qcr1p_[0-9a-z]+_[A-Za-z0-9_-]{22}$/); assert.ok(ref.length<50);
 assert.deepEqual(await refs.read(ref,'plan'),payload); assert.equal(Buffer.from(ref.split('_').slice(2).join('_'),'base64url').length,16);
});
test('same payload gets independent immutable capabilities, not a guessable session code',async()=>{
 const {refs}=memory(); const all=await Promise.all(Array.from({length:64},()=>refs.issue(ticket())));
 assert.equal(new Set(all).size,64);
});
test('reference works on another service instance using shared storage and secret',async()=>{
 const {refs,store}=memory(), ref=await refs.issue(ticket());
 assert.deepEqual(await new References(secret,store,'opaque',()=>now).read(ref,'plan'),ticket());
});
test('wrong purpose is rejected before a storage read',async()=>{
 const {refs}=memory(), ref=await refs.issue(ticket()); await rejects(refs.read(ref,'proposal'),'INVALID_REFERENCE');
});
test('truncation, whitespace, appended text and noncanonical encoding are not repaired',async()=>{
 const {refs}=memory(), ref=await refs.issue(ticket());
 for(const bad of [ref.slice(0,-1),ref+' extra',ref+'\n',ref.replace('qcr1p_','qcr1p_0'),ref.slice(0,-1)+'!'])
  await rejects(refs.read(bad,'plan'),'INVALID_REFERENCE');
});
test('well-formed but mistyped nonce is unavailable, never guessed',async()=>{
 const {refs}=memory(), ref=await refs.issue(ticket()), i=ref.length-4;
 const bad=ref.slice(0,i)+(ref[i]==='A'?'B':'A')+ref.slice(i+1); await rejects(refs.read(bad,'plan'),'REFERENCE_NOT_FOUND');
});
test('expiry is enforced before storage access and not extended by reads',async()=>{
 let clock=now, gets=0; const base=new MemoryReferenceStore(()=>clock);
 const store={put:(...a)=>base.put(...a),get:(...a)=>{gets++;return base.get(...a);}};
 const refs=new References(secret,store,'opaque',()=>clock), ref=await refs.issue(ticket());
 clock=ticket().expiresAt; await rejects(refs.read(ref,'plan'),'EXPIRED'); assert.equal(gets,0);
});
test('issuing opaque references cannot extend the original maximum TTL',async()=>{
 const {refs}=memory(); await rejects(refs.issue({...ticket(),expiresAt:now+LIMITS.ttlSeconds*1000+1}),'INVALID_REFERENCE_LIFETIME');
});
test('legacy signed inputs still work in opaque mode',async()=>{
 const {refs}=memory(); const signed=new Tickets(secret,()=>now).issue(ticket()); assert.deepEqual(await refs.read(signed,'plan'),ticket());
});
test('rollback to signed issuance retains read access to already issued opaque references',async()=>{
 const {refs,store}=memory(), ref=await refs.issue(ticket()), rolled=new References(secret,store,'signed',()=>now);
 assert.deepEqual(await rolled.read(ref,'plan'),ticket()); assert.ok(!(await rolled.issue(ticket())).startsWith('qcr1'));
});
test('opaque mode fails closed without shared storage',()=>{
 assert.throws(()=>new References(secret,undefined,'opaque',()=>now),e=>e.code==='REFERENCE_STORE_REQUIRED');
});
test('a deployment lacking the reference bucket does not reinterpret an opaque token as signed',async()=>{
 const {refs}=memory(), ref=await refs.issue(ticket()); await rejects(new References(secret,undefined,'signed',()=>now).read(ref,'plan'),'REFERENCE_STORE_REQUIRED');
});
test('private storage uses hashed keys rather than raw bearer references',async()=>{
 let key; const base=new MemoryReferenceStore(()=>now);const store={put:(k,...a)=>{key=k;return base.put(k,...a);},get:k=>base.get(k)};
 const ref=await new References(secret,store,'opaque',()=>now).issue(ticket());
 assert.match(key,/^host-outline-refs-v1\/2026-10-11\/\d+-[a-f0-9]{64}\.json$/);
 assert.ok(!key.includes(ref)); assert.ok(key.includes(createHash('sha256').update(ref).digest('hex')));
});
test('signed record is bound to the exact opaque reference, defeating cross-record swaps',async()=>{
 const saved=[]; let substitute;
 const store={put:async(k,b)=>{saved.push(Buffer.from(b));},get:async()=>substitute};
 const refs=new References(secret,store,'opaque',()=>now), a=await refs.issue(ticket()); await refs.issue(ticket());
 substitute=saved[1]; await rejects(refs.read(a,'plan'),'INVALID_REFERENCE');
 substitute=saved[0]; assert.deepEqual(await refs.read(a,'plan'),ticket());
});
test('wrong deployment secret cannot read opaque or signed capability records',async()=>{
 const {refs,store}=memory(), ref=await refs.issue(ticket());
 await rejects(new References(secret+'different',store,'opaque',()=>now).read(ref,'plan'),'INVALID_REFERENCE');
});
test('malformed and oversized stored references fail closed without echoing contents',async()=>{
 let bytes; const store={put:async()=>{},get:async()=>bytes};const refs=new References(secret,store,'opaque',()=>now), ref=await refs.issue(ticket());
 for(const b of [Buffer.from('private malformed document'),Buffer.from('null'),Buffer.from('{}'),Buffer.alloc(REFERENCE_BYTES+1)]){
  bytes=b; await rejects(refs.read(ref,'plan'),'INVALID_REFERENCE');
 }
});
test('memory reference store bounds capacity, enforces immutability, copies buffers and expires',async()=>{
 let clock=now;const store=new MemoryReferenceStore(()=>clock,3), b=Buffer.from('abc');
 await store.put('k',b,now+100);b.fill(0);assert.equal((await store.get('k')).toString(),'abc');
 await rejects(store.put('k',Buffer.from('x'),now+100),'REFERENCE_COLLISION');
 await rejects(store.put('other',Buffer.from('x'),now+100),'CAPACITY');clock+=100;
 await rejects(store.get('k'),'REFERENCE_NOT_FOUND');await store.put('other',Buffer.from('x'),now+200);
});
test('invalid reference mode is a configuration failure, never a silent downgrade',()=>{
 assert.equal(referenceMode({}),'signed');assert.equal(referenceMode({QC_HOST_SCAN_REFERENCE_MODE:'opaque'}),'opaque');
 assert.throws(()=>referenceMode({QC_HOST_SCAN_REFERENCE_MODE:'invalid'}),e=>e.code==='CONFIGURATION_REQUIRED');
});

const objectKey='host-outline-refs-v1/2026-10-11/'+(now+1800000)+'-'+'a'.repeat(64)+'.json';
function bucket(){return {public:false,file_size_limit:REFERENCE_BYTES,allowed_mime_types:['application/json']};}
async function mocked(fn,handler){const original=global.fetch;global.fetch=handler;try{return await fn();}finally{global.fetch=original;}}
const remote=()=>new SupabaseReferenceStore('https://unit-test.supabase.co','test-service-key','qc-host-refs-unit-test');
test('Supabase reference storage refuses insecure URLs, unsafe bucket names and public buckets',async()=>{
 assert.throws(()=>new SupabaseReferenceStore('http://example.test','key','qc-host-refs-test'));
 assert.throws(()=>new SupabaseReferenceStore('https://example.test','key','../images'));
 await mocked(()=>rejects(remote().get(objectKey),'UNSAFE_REFERENCE_STORAGE'),async()=>Response.json({...bucket(),public:true}));
});
test('separate reference bucket must be JSON-only and exactly size capped',async()=>{
 for(const b of [{...bucket(),allowed_mime_types:['image/png','application/json']},{...bucket(),file_size_limit:null},{...bucket(),file_size_limit:REFERENCE_BYTES*2}])
  await mocked(()=>rejects(remote().get(objectKey),'UNSAFE_REFERENCE_STORAGE'),async()=>Response.json(b));
});
test('Supabase reference writes are immutable and use service auth without public links',async()=>{
 let wrote=false;
 await mocked(async()=>{const store=remote();await store.put(objectKey,Buffer.from('{}'),now+100);assert.equal((await store.get(objectKey)).toString(),'{}');},async(url,init)=>{
  assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.headers.Authorization,'Bearer test-service-key');
  if(url.includes('/bucket/'))return Response.json(bucket());
  assert.ok(url.includes('/object/qc-host-refs-unit-test/host-outline-refs-v1/'));
  if(init.method==='POST'){wrote=true;assert.equal(init.headers['x-upsert'],'false');assert.equal(init.headers['Content-Type'],'application/json');return Response.json({});}
  return new Response('{}');
 });assert.equal(wrote,true);
});
test('missing references and storage outages have distinct recoverable errors',async()=>{
 for(const [response,code] of [[new Response('',{status:404}),'REFERENCE_NOT_FOUND'],[Response.json({code:'NoSuchKey'},{status:400}),'REFERENCE_NOT_FOUND'],[new Response('',{status:503}),'REFERENCE_STORAGE_UNAVAILABLE'],[new Response('',{status:403}),'REFERENCE_STORAGE_UNAVAILABLE']])
  await mocked(()=>rejects(remote().get(objectKey),code),async url=>url.includes('/bucket/')?Response.json(bucket()):response);
});
test('reference fetches reject traversal and oversize responses without trusting Content-Length',async()=>{
 await rejects(remote().get('../image.png'),'INVALID_REFERENCE');
 for(const response of [new Response(Buffer.alloc(1),{headers:{'Content-Length':String(REFERENCE_BYTES+1)}}),new Response(Buffer.alloc(REFERENCE_BYTES+1))])
  await mocked(()=>rejects(remote().get(objectKey),'REFERENCE_TOO_LARGE'),async url=>url.includes('/bucket/')?Response.json(bucket()):response);
});
test('reference put validates key and size before any network request',async()=>{
 await mocked(async()=>{await rejects(remote().put('../bad',Buffer.from('{}'),now),'INVALID_REFERENCE');await rejects(remote().put(objectKey,Buffer.alloc(REFERENCE_BYTES+1),now),'REFERENCE_TOO_LARGE');},async()=>{throw new Error('must not fetch');});
});
