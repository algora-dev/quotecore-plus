// Requires the repository's actual locked MCP SDK, Zod, Sharp, Supabase SDK and tsx.
// Runs actual Next route handlers via Request/Response, not a mock MCP implementation.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

process.env.NODE_ENV='test';delete process.env.VERCEL;process.env.VERCEL_ENV='preview';
process.env.QC_HOST_SCAN_ORIGIN='http://127.0.0.1:3777';process.env.QC_HOST_SCAN_STORAGE='memory';
process.env.QC_HOST_SCAN_SECRET='sdk-software-test-only-secret-123456789-not-for-deployment';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://rate-limit.example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
const originalFetch=globalThis.fetch;const rateCalls=[];
let denyPrefix='';
globalThis.fetch=async(input,init={})=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url==='https://rate-limit.example.test/rest/v1/rpc/consume_rate_limit'){
  const body=typeof init.body==='string'?JSON.parse(init.body):JSON.parse(await input.text());rateCalls.push(body);
  return Response.json(!denyPrefix||!body.p_key.startsWith(denyPrefix));
 }
 throw new Error('Unexpected network request in SDK test; no external API allowed: '+new URL(url).origin);
};
after(()=>{globalThis.fetch=originalFetch;});
const root=await import('../../../../app/mcp/route.ts');
const isolated=await import('../../../../app/mcp/host-scan/route.ts');
const review=await import('../../../../app/api/public/host-roof-scan/route.ts');
const schemas=await import('../../../../app/lib/free-tools/host-roof-scan/schemas.ts');
const {z}=await import('zod');
let id=0;
function req(path,body,headers={}){return new Request('http://127.0.0.1:3777'+path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-03-26',...headers},body:JSON.stringify(body)});}
async function rpc(route,method,params={}){const r=await route.POST(req('/mcp',{jsonrpc:'2.0',id:++id,method,params}));assert.equal(r.status,200);const j=await r.json();assert.equal(j.error,undefined,JSON.stringify(j.error));return j.result;}
async function tool(name,args){return rpc(root,'tools/call',{name,arguments:args});}
test('actual SDK: flag-off initialize and three original tools only',async()=>{
 process.env.QC_HOST_SCAN_ENABLED='false';process.env.QC_HOST_SCAN_ON_MAIN_MCP='true';
 const i=await rpc(root,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}});assert.equal(i.serverInfo.name,'quotecore-roof-takeoff');
 const tools=await rpc(root,'tools/list');assert.equal(tools.tools.length,3);
 const s=await tool('get_roof_takeoff_schema',{});assert.ok(s.structuredContent.calculationVersion);
 const c=await tool('calculate_roof_takeoff',{mode:'actual',units:'metric',area:100,ridges:[10]});assert.equal(c.structuredContent.status,'complete');
 const r=await tool('get_calculation_result',{resultUrl:c.structuredContent.resultUrl});assert.deepEqual(r.structuredContent,c.structuredContent);
});
test('actual SDK: seven tools plus one versioned UI resource when opted in',async()=>{
 process.env.QC_HOST_SCAN_ENABLED='true';process.env.QC_HOST_SCAN_ON_MAIN_MCP='true';
 const list=await rpc(root,'tools/list');assert.equal(list.tools.length,7);assert.equal(new Set(list.tools.map(t=>t.name)).size,7);
 for(const t of list.tools.filter(t=>t.name.startsWith('qc_')))assert.ok(t.outputSchema);
 const file=list.tools.find(t=>t.name==='qc_prepare_roof_outline');assert.deepEqual(file._meta['openai/fileParams'],['plan']);
 const resources=await rpc(root,'resources/list');assert.equal(resources.resources.length,1);
 const html=await rpc(root,'resources/read',{uri:resources.resources[0].uri});assert.match(html.contents[0].text,/Review your roof outline/);
 const blank=await tool('qc_open_roof_outline_review',{});assert.equal(blank.structuredContent.status,'awaiting_image');assert.ok(blank.structuredContent.resultUrl);
});
test('actual SDK: original calculation remains unchanged with new tools enabled',async()=>{
 const c=await tool('calculate_roof_takeoff',{mode:'actual',units:'metric',area:100,ridges:[10]});const r=await tool('get_calculation_result',{resultUrl:c.structuredContent.resultUrl});assert.deepEqual(c.structuredContent,r.structuredContent);
 const bad=await tool('get_calculation_result',{resultUrl:'https://evil.test/free-roofing-takeoff-builder/calculate'});assert.equal(bad.isError,true);
});
test('actual SDK: standalone endpoint uses same four tools',async()=>{const a=await rpc(isolated,'tools/list'),b=await rpc(root,'tools/list');assert.deepEqual(a.tools,b.tools.filter(t=>t.name.startsWith('qc_')));});
test('actual SDK: notifications and method guards have proper HTTP status',async()=>{const n=await root.POST(req('/mcp',{jsonrpc:'2.0',method:'notifications/initialized'}));assert.equal(n.status,202);const g=await root.GET(new Request('http://127.0.0.1:3777/mcp'));assert.equal(g.status,405);assert.equal(root.OPTIONS().status,204);});
test('actual SDK: prepare/submit/open/export through combined endpoint with synthetic geometry',async()=>{
 const image=await fs.readFile(new URL('../fixtures/synthetic-roof.png',import.meta.url));const outline=JSON.parse(await fs.readFile(new URL('../fixtures/outline.json',import.meta.url),'utf8'));
 const up=await review.POST(new Request('http://127.0.0.1:3777/api/public/host-roof-scan',{method:'POST',headers:{'Content-Type':'image/png'},body:image}));assert.equal(up.status,200);const uploaded=await up.json();const planToken=uploaded.structuredContent.planToken;
 try{
  const p=await tool('qc_prepare_roof_outline',{planToken});assert.ok(!p.isError);assert.ok(p.content.some(c=>c.type==='image'));
  const s=await tool('qc_submit_roof_outline',{planToken,observedImageId:p.structuredContent.plan.imageId,outcome:'proposed',roof_areas:[outline],notes:['Synthetic, not AI.']});assert.ok(!s.isError);const proposalToken=s.structuredContent.proposalToken;
  const o=await tool('qc_open_roof_outline_review',{planToken,proposalToken});assert.ok(o._meta.reviewGate);
  const bad=await tool('qc_export_reviewed_roof_outline',{reviewToken:proposalToken});assert.equal(bad.isError,true);
  const c=await review.POST(req('/api/public/host-roof-scan',{action:'confirm',args:{planToken,proposalToken,reviewGate:o._meta.reviewGate,outline,confirmed:true,calibration:null}}));assert.equal(c.status,200);const confirmed=await c.json();
  const e=await tool('qc_export_reviewed_roof_outline',{reviewToken:confirmed.structuredContent.reviewToken});assert.equal(e.structuredContent.status,'exported');assert.equal(e.structuredContent.measurements,null);
  for(const result of [p,s,o,e])assert.equal(z.object(schemas.outputShape).strict().safeParse(result.structuredContent).success,true);
 }finally{const r=await review.POST(req('/api/public/host-roof-scan',{action:'delete',args:{planToken}}));assert.equal(r.status,200);}
});
test('actual SDK: native attachment through /mcp cannot bypass upload budget',async()=>{
 const before=rateCalls.length;const r=await tool('qc_prepare_roof_outline',{plan:{download_url:'https://not-allowlisted.example/plan.png',file_id:'test'}});assert.equal(r.isError,true);
 assert.ok(rateCalls.slice(before).some(b=>b.p_key.startsWith('qc-host-outline-v1:upload:')));assert.ok(rateCalls.slice(before).some(b=>b.p_key==='qc-host-outline-v1:uploads-global'));
});
test('actual SDK: main origin guard applies to host tools but does not alter legacy access',async()=>{
 const r=await root.POST(req('/mcp',{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name:'qc_open_roof_outline_review',arguments:{}}},{Origin:'https://evil.test'}));assert.equal(r.status,403);
 const old=await root.POST(req('/mcp',{jsonrpc:'2.0',id:++id,method:'tools/list'}, {Origin:'https://evil.test'}));assert.equal(old.status,200);
});
test('actual SDK: rollback removes host tools while retaining original tools',async()=>{process.env.QC_HOST_SCAN_ENABLED='false';assert.equal((await rpc(root,'tools/list')).tools.length,3);const r=await isolated.POST(req('/mcp/host-scan',{jsonrpc:'2.0',id:1,method:'tools/list'}));assert.equal(r.status,404);});
