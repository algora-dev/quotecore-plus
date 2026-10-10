#!/usr/bin/env node
// Real HTTP discovery, legacy regression and optional synthetic workflow. This does NOT test AI vision.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stagingOrigin, checkedFetch } from './ops.mjs';
const flags=new Set(process.argv.slice(2));
for (const f of flags) if (!['--expect-enabled','--expect-disabled','--exercise','--confirm-staging','--isolated'].includes(f)) throw new Error('Unknown option '+f);
if (flags.has('--expect-enabled')===flags.has('--expect-disabled')) throw new Error('Specify exactly one of --expect-enabled or --expect-disabled.');
if (flags.has('--exercise')&&(!flags.has('--expect-enabled')||!flags.has('--confirm-staging'))) throw new Error('Synthetic upload requires --expect-enabled --exercise --confirm-staging.');
const origin=stagingOrigin(process.env.QC_STAGE_ORIGIN,true);
const isolated=flags.has('--isolated'),enabled=flags.has('--expect-enabled');
if (isolated&&!enabled) throw new Error('For flag-off tests use the existing main endpoint.');
const endpoint=origin+(isolated?'/mcp/host-scan':'/mcp');
const resource='ui://quotecore/host-roof-outline-v1b.html';
const extra=process.env.QC_STAGE_PROTECTION_BYPASS?{'x-vercel-protection-bypass':process.env.QC_STAGE_PROTECTION_BYPASS}:{};
let id=0,protocol='2025-03-26';
async function call(method,params={},notification=false) {
  const r=await checkedFetch(endpoint,{method:'POST',headers:{...extra,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':protocol},body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id:++id}),method,params})});
  if (!r.ok) throw new Error('HTTP '+r.status+' for '+method+'. Check deployment protection, redirects and the server logs.');
  if(notification){assert.equal(r.status,202);return;}
  const text=await r.text();let j;try{j=JSON.parse(text);}catch{throw new Error('Expected JSON from MCP, not a login page or HTML redirect.');}
  if(j.error)throw new Error('MCP '+method+' failed: '+j.error.message);
  assert.ok(j.result);return j.result;
}
async function tool(name,args){const r=await call('tools/call',{name,arguments:args});assert.ok(!r.isError,'Tool failed: '+name+' '+(r.structuredContent?.code||''));return r;}
async function api(action,args){const r=await checkedFetch(origin+'/api/public/host-roof-scan',{method:'POST',headers:{...extra,'Content-Type':'application/json'},body:JSON.stringify({action,args})});const j=await r.json();assert.ok(r.ok&&!j.isError,'Review action failed: '+action+' HTTP '+r.status);return j;}
const options=await checkedFetch(endpoint,{method:'OPTIONS',headers:extra});assert.equal(options.status,204);assert.ok(options.headers.get('access-control-allow-headers').toLowerCase().includes('accept'));console.log('PASS MCP preflight');
const get=await checkedFetch(endpoint,{method:'GET',headers:extra});assert.equal(get.status,405);console.log('PASS GET 405 for stateless POST endpoint, not a webpage');
const init=await call('initialize',{protocolVersion:protocol,capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}},clientInfo:{name:'quotecore-phase1b-staging-smoke',version:'1.0.0'}});protocol=init.protocolVersion;
console.log('PASS initialize:',init.serverInfo.name,'protocol',protocol);await call('notifications/initialized',{},true);
const list=await call('tools/list');const names=list.tools.map(t=>t.name);assert.equal(new Set(names).size,names.length);
const legacy=['get_roof_takeoff_schema','calculate_roof_takeoff','get_calculation_result'];
const host=['qc_prepare_roof_outline','qc_submit_roof_outline','qc_open_roof_outline_review','qc_export_reviewed_roof_outline'];
const expected=isolated?host:enabled?[...legacy,...host]:legacy;assert.deepEqual([...names].sort(),expected.sort());console.log('PASS tools/list:',names.join(', '));
if(!isolated){
 const schema=await tool('get_roof_takeoff_schema',{});assert.ok(schema.structuredContent.calculationVersion);
 const input={mode:'actual',units:'metric',area:100,ridges:[10],spouting:[20]};
 const calculation=await tool('calculate_roof_takeoff',input);assert.equal(calculation.structuredContent.status,'complete');
 const resultUrl=calculation.structuredContent.resultUrl;assert.equal(new URL(resultUrl).origin,origin);
 const reread=await tool('get_calculation_result',{resultUrl});assert.deepEqual(reread.structuredContent,calculation.structuredContent);
 const foreign=await call('tools/call',{name:'get_calculation_result',arguments:{resultUrl:'https://other.example/free-roofing-takeoff-builder/calculate?area=100'}});assert.equal(foreign.isError,true);
 console.log('PASS original three tools, deterministic result URL round-trip and foreign-URL rejection');
}
if(enabled){
 const prep=list.tools.find(t=>t.name===host[0]);assert.deepEqual([...prep._meta['openai/fileParams']],['plan']);assert.ok(prep.outputSchema);
 const resources=await call('resources/list');assert.ok(resources.resources.some(r=>r.uri===resource));
 const r=await call('resources/read',{uri:resource});assert.equal(r.contents[0].mimeType,'text/html;profile=mcp-app');assert.match(r.contents[0].text,/Review your roof outline/);assert.ok(r.contents[0]._meta.ui.csp.connectDomains.includes(origin));
 const blank=await tool('qc_open_roof_outline_review',{});assert.equal(blank.structuredContent.status,'awaiting_image');assert.equal(blank.structuredContent.resultUrl,origin+'/mcp/host-scan/review');
 const page=await checkedFetch(blank.structuredContent.resultUrl,{headers:extra});assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 console.log('PASS interactive resource, CSP and browser fallback');
}
if(flags.has('--exercise')){
 const fixture=await fs.readFile(new URL('./fixtures/synthetic-roof.png',import.meta.url));
 const shape=JSON.parse(await fs.readFile(new URL('./fixtures/outline.json',import.meta.url),'utf8'));
 const upload=await checkedFetch(origin+'/api/public/host-roof-scan',{method:'POST',headers:{...extra,'Content-Type':'image/png'},body:fixture});
 assert.equal(upload.status,200);const u=await upload.json(),planToken=u.structuredContent.planToken;assert.ok(planToken);
 try{
  const prepared=await tool(host[0],{planToken});const image=prepared.content.find(x=>x.type==='image');assert.ok(image);assert.equal(createHash('sha256').update(Buffer.from(image.data,'base64')).digest('hex'),prepared.structuredContent.plan.sha256);
  const submitted=await tool(host[1],{planToken,observedImageId:prepared.structuredContent.plan.imageId,outcome:'proposed',roof_areas:[shape],notes:['Synthetic software test. No model analysis.']});
  const proposalToken=submitted.structuredContent.proposalToken;
  const opened=await tool(host[2],{planToken,proposalToken});assert.ok(opened._meta.reviewGate);assert.equal(opened.structuredContent.reviewGate,undefined);
  const denied=await call('tools/call',{name:host[3],arguments:{reviewToken:proposalToken}});assert.equal(denied.isError,true);
  const confirmation=await api('confirm',{planToken,proposalToken,reviewGate:opened._meta.reviewGate,outline:shape,calibration:null,confirmed:true});
  const exported=await tool(host[3],{reviewToken:confirmation.structuredContent.reviewToken});assert.deepEqual(exported.structuredContent.export.scanData.roof_areas[0].points,shape.points);assert.equal(exported.structuredContent.measurements,null);
  console.log('PASS full synthetic prepare/submit/review/export, model-visible image hash, unreviewed-export rejection');
 } finally {await api('delete',{planToken});console.log('PASS synthetic image deleted');}
}
console.log('Software smoke completed. Live host vision, real human review and measurement accuracy are NOT proven by this test.');
if(extra['x-vercel-protection-bypass'])console.log('WARNING: smoke used a deployment-protection bypass header. ChatGPT does not automatically inherit it. Test normal host access separately.');
