#!/usr/bin/env node
// Performs actual HTTPS RPC requests. Logs safe summaries only, never signed refs or raw images.
// Read-only by default. --exercise requires explicit --confirm-staging and deletes the fixture.
import fs from 'node:fs/promises';import path from 'node:path';
import {stagingOrigin,checkedFetch} from '../host-roof-scan-phase1b/ops.mjs';
import {decodeRpc,inspectResult,MAX_RPC_BYTES} from './inspect-response.mjs';
const a=process.argv.slice(2),args={};
for(let i=0;i<a.length;i++){if(['--out','--plan-token-file'].includes(a[i])){if(!a[i+1]||a[i+1].startsWith('--'))throw Error('Missing option value');args[a[i]]=a[++i];}else if(['--exercise','--confirm-staging'].includes(a[i]))args[a[i]]=true;else throw Error('Unknown diagnostic option');}
if(args['--exercise']&&(!args['--confirm-staging']||args['--plan-token-file']))throw Error('Use --exercise --confirm-staging OR --plan-token-file, not both');
const origin=stagingOrigin(process.env.QC_STAGE_ORIGIN,true),url=origin+'/mcp';
const extra=process.env.QC_STAGE_PROTECTION_BYPASS?{'x-vercel-protection-bypass':process.env.QC_STAGE_PROTECTION_BYPASS}:{};
let id=0,protocol='2025-03-26',temporaryToken=null;const report={version:'qc-image-delivery-v2',mode:args['--exercise']?'synthetic-fixture':args['--plan-token-file']?'provided-plan-token':'discovery-only',hostVisibility:'NOT_TESTED',checks:[]};
async function body(r){const reader=r.body?.getReader();if(!reader)throw Error('Missing response body');let size=0;const chunks=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_RPC_BYTES)throw Error('Response exceeds budget');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks).toString('utf8');}
async function rpc(method,params={}){const requestId=++id;const r=await checkedFetch(url,{method:'POST',headers:{...extra,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':protocol},body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params})});if(!r.ok)throw Error('MCP HTTP '+r.status);return decodeRpc(await body(r),requestId);}
async function tool(name,arguments_){return rpc('tools/call',{name,arguments:arguments_});}
try{
 const init=await rpc('initialize',{protocolVersion:protocol,capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}},clientInfo:{name:'quotecore-image-delivery-diagnostic',version:'2.0'}});protocol=init.protocolVersion;
 const notified=await checkedFetch(url,{method:'POST',headers:{...extra,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':protocol},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});if(!notified.ok)throw Error('MCP initialize notification failed');
 const list=await rpc('tools/list');const reader=list.tools?.find(t=>t.name==='qc_get_roof_outline_image');
 if(!reader||reader.outputSchema)throw Error('Content-only image reader missing or has an outputSchema. Deploy Phase 2 and refresh connector.');
 const resources=await rpc('resources/list');if(!resources.resources?.some(r=>r.uri==='ui://quotecore/host-roof-outline-v2-image-delivery.html'))throw Error('Stale review resource');
 const blank=await tool('qc_open_roof_outline_review',{});if(!blank.content?.some(c=>c.type==='text'&&c.text.includes(origin+'/mcp/host-scan/review')))throw Error('Blank review fallback link missing');
 report.checks.push({check:'discovery',pass:true,toolCount:list.tools.length,toolNames:list.tools.map(t=>t.name),versionedUi:true,blankReviewLinkInText:true});
 let planToken=args['--plan-token-file']?(await fs.readFile(args['--plan-token-file'],'utf8')).trim():null;
 if(args['--exercise']){const bytes=await fs.readFile(new URL('../host-roof-scan-phase1b/fixtures/synthetic-roof.png',import.meta.url));const r=await checkedFetch(origin+'/api/public/host-roof-scan',{method:'POST',headers:{...extra,'Content-Type':'image/png'},body:bytes});if(!r.ok)throw Error('Synthetic upload HTTP '+r.status);const u=JSON.parse(await body(r));temporaryToken=u.structuredContent?.planToken;planToken=temporaryToken;if(!planToken)throw Error('Upload did not produce a reference');}
 if(planToken){const p=await tool('qc_prepare_roof_outline',{planToken});const r=await tool('qc_get_roof_outline_image',{planToken});
   const left=inspectResult(p),right=inspectResult(r);if(right.hasStructuredContent)throw Error('Reader unexpectedly has structuredContent');if(left.sha256!==right.sha256)throw Error('Delivery paths returned different rasters');
   report.checks.push({check:'structured-prepare-image',pass:true,...left},{check:'content-only-image',pass:true,...right});
 }
}catch(e){report.error=e instanceof Error?e.message:'Diagnostic failed';process.exitCode=1;}
finally{if(temporaryToken){try{const r=await checkedFetch(origin+'/api/public/host-roof-scan',{method:'POST',headers:{...extra,'Content-Type':'application/json'},body:JSON.stringify({action:'delete',args:{planToken:temporaryToken}})});if(!r.ok)throw Error('Synthetic cleanup HTTP '+r.status);report.checks.push({check:'synthetic-cleanup',pass:true});}catch(e){report.cleanupError=e.message;process.exitCode=1;}}}
report.note='Serialization verified only. A real model must still see the image and propose a reviewed outline. Do not paste private tokens or raw responses in logs.';
if(Object.keys(extra).length)report.protectionBypassUsed=true;
if(args['--out']){await fs.mkdir(path.resolve(args['--out']),{recursive:true});await fs.writeFile(path.join(path.resolve(args['--out']),'image-delivery-diagnostic.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
