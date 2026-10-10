#!/usr/bin/env node
/** Exercise the REAL deployed SDK route. Test-owned synthetic geometry, NOT AI accuracy.
 * Usage: QC_STAGE_ORIGIN=https://your-staging-site.example node .../staging-smoke.mjs
 * Requires the test fixture builder and installed dependencies (see QA).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {fixture,points}=require('./fixture.cjs');
const origin=process.env.QC_STAGE_ORIGIN;
if(!origin)throw new Error('Set QC_STAGE_ORIGIN explicitly. Never target production by accident.');
const url=new URL(origin);if(url.origin!==origin)throw new Error('Use an origin with no trailing slash or path.');
const endpoint=origin+(process.env.QC_RPC_PATH||'/mcp/host-scan');
let id=0,protocol='2025-03-26';
async function rpc(method,params){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':protocol},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params})});
 if(!r.ok)throw new Error('RPC HTTP status '+r.status+' for '+method);
 const j=await r.json();if(j.error)throw new Error('RPC error for '+method+': '+j.error.message);
 assert.ok(j.result);return j.result;
}
async function tool(name,args){const r=await rpc('tools/call',{name,arguments:args});assert.equal(r.isError,undefined,JSON.stringify(r.structuredContent));console.log('PASS tools/call',name,r.structuredContent.status);return r;}
async function review(action,args){const r=await fetch(origin+'/api/public/host-roof-scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args})});const j=await r.json();assert.ok(r.ok,JSON.stringify(j));assert.ok(!j.isError);return j;}
const init=await rpc('initialize',{protocolVersion:protocol,capabilities:{},clientInfo:{name:'quotecore-staging-smoke',version:'0.1'}});protocol=init.protocolVersion;
console.log('PASS initialize',init.serverInfo.name,protocol);
await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':protocol},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});
const listed=await rpc('tools/list',{});assert.equal(listed.tools.length,4);console.log('PASS tools/list',listed.tools.length);
const resource=await rpc('resources/read',{uri:'ui://quotecore/host-roof-outline-v1.html'});assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');assert.match(resource.contents[0].text,/Review your roof outline/);console.log('PASS resources/read');
const blank=await tool('qc_open_roof_outline_review',{});assert.equal(blank.structuredContent.status,'awaiting_image');
const up=await fetch(origin+'/api/public/host-roof-scan',{method:'POST',headers:{'Content-Type':'image/png'},body:new Uint8Array(await fixture())});assert.ok(up.ok,'upload');const u=await up.json();const {planToken}=u.structuredContent;
try{
 const prepared=await tool('qc_prepare_roof_outline',{planToken});assert.ok(prepared.content.some(c=>c.type==='image'));
 const submitted=await tool('qc_submit_roof_outline',{planToken,observedImageId:prepared.structuredContent.plan.imageId,outcome:'proposed',roof_areas:[{name:'STAGING SOFTWARE TEST',points,pitch_degrees:null}],notes:['Synthetic fixture. No model vision used.']});
 const proposalToken=submitted.structuredContent.proposalToken;
 const open=await tool('qc_open_roof_outline_review',{planToken,proposalToken});assert.ok(open._meta.reviewGate);assert.equal(open.structuredContent.reviewGate,undefined);
 const premature=await rpc('tools/call',{name:'qc_export_reviewed_roof_outline',arguments:{reviewToken:proposalToken}});assert.equal(premature.isError,true);console.log('PASS unreviewed export blocked');
 const confirmed=await review('confirm',{planToken,proposalToken,reviewGate:open._meta.reviewGate,outline:{name:'STAGING SOFTWARE TEST',points,pitch_degrees:null},calibration:null,confirmed:true});
 const exported=await tool('qc_export_reviewed_roof_outline',{reviewToken:confirmed.structuredContent.reviewToken});assert.deepEqual(exported.structuredContent.export.scanData.roof_areas[0].points,points);assert.equal(exported.structuredContent.measurements,null);
 console.log('PASS structured reviewed export; live host vision and human review are NOT tested by this script.');
}finally{await review('delete',{planToken});console.log('PASS temporary test image deleted');}
