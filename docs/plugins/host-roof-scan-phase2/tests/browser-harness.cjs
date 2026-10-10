#!/usr/bin/env node
// LOCAL HTTP ADAPTER + MOCK HOSTS ONLY. Not Next.js, actual MCP SDK, ChatGPT or vision.
const http=require('node:http'),path=require('node:path');
const {fixture,points,out}=require('../../host-roof-scan-phase1/tests/fixture.cjs');
const load=n=>require(path.join(out,'app/lib/free-tools/host-roof-scan',n));
const {HostOutlineService,toolError}=load('service');const {MemoryImageStore}=load('store');
const {widgetHtml,widgetCsp}=load('widget');const {mcpWireResult}=load('image-delivery');
const {HOST_OUTLINE_TOOLS,SERVER_INSTRUCTIONS}=load('contract');const {RESOURCE_URI}=load('types');
const port=+(process.env.PORT||4768),origin='http://127.0.0.1:'+port;
const service=new HostOutlineService({origin,secret:'phase2-local-test-secret-never-deploy-12345678',store:new MemoryImageStore(),allowedFileOrigins:[]});
async function read(req){const parts=[];let total=0;for await(const p of req){total+=p.length;if(total>4*1024*1024)throw new Error('Test request too large');parts.push(p);}return Buffer.concat(parts);}
function send(res,result,status=200){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*'});res.end(JSON.stringify(result));}
async function seed(proposal=false){const u=await service.upload(await fixture());return proposal?propose(u.structuredContent.planToken):service.open({planToken:u.structuredContent.planToken});}
async function propose(planToken){const p=await service.prepare({planToken});const r=await service.submit({planToken,observedImageId:p.structuredContent.plan.imageId,outcome:'proposed',roof_areas:[{name:'SYNTHETIC HOST FIXTURE',points,pitch_degrees:null}],notes:['Synthetic coordinates. Not an AI accuracy test.']});return service.open({planToken,proposalToken:r.structuredContent.proposalToken});}
const js=x=>JSON.stringify(x).replace(/</g,'\\u003c');
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);
 if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,accept,mcp-protocol-version'});return res.end();}
 if(url.pathname==='/fixture.png'){res.writeHead(200,{'content-type':'image/png'});return res.end(await fixture());}
 if(url.pathname==='/seed')return send(res,await seed(url.searchParams.has('proposal')));
 if(url.pathname==='/simulate')return send(res,await propose(JSON.parse(await read(req)).planToken));
 if(url.pathname==='/api/public/host-roof-scan'){
   const body=await read(req);if(!String(req.headers['content-type']).includes('application/json'))return send(res,await service.upload(body));
   const {action,args}=JSON.parse(body);const fn={open:'open',confirm:'confirm',export:'export',delete:'remove'}[action];if(!fn)return send(res,{error:'unknown test action'},400);return send(res,await service[fn](args));
 }
 if(url.pathname==='/mcp'){
   if(req.method==='GET'){res.writeHead(405);return res.end();}
   const {id,method,params}=JSON.parse(await read(req));let result;
   if(method==='notifications/initialized'){res.writeHead(202);return res.end();}
   if(method==='initialize')result={protocolVersion:'2025-03-26',serverInfo:{name:'LOCAL ADAPTER NOT SDK',version:'0.2'},capabilities:{tools:{},resources:{}},instructions:SERVER_INSTRUCTIONS};
   else if(method==='tools/list')result={tools:HOST_OUTLINE_TOOLS};
   else if(method==='resources/list')result={contents:[],resources:[{uri:RESOURCE_URI,mimeType:'text/html;profile=mcp-app'}]};
   else if(method==='resources/read')result={contents:[{uri:RESOURCE_URI,mimeType:'text/html;profile=mcp-app',text:widgetHtml(origin)}]};
   else if(method==='tools/call')result=mcpWireResult(params.name,await service.call(params.name,params.arguments));
   else return send(res,{jsonrpc:'2.0',id,error:{code:-32601,message:'Unknown test method'}});
   return send(res,{jsonrpc:'2.0',id,result});
 }
 if(url.pathname==='/mcp/host-scan/review'){res.writeHead(200,{'content-type':'text/html','content-security-policy':widgetCsp(origin),'referrer-policy':'no-referrer'});return res.end(widgetHtml(origin));}
 if(url.pathname==='/host'){
   const mode=url.searchParams.get('mode')||'standard';const initial=await seed(url.searchParams.has('proposal'));
   if(url.searchParams.has('corrupt'))initial._meta.imageDataUrl=initial._meta.imageDataUrl.replace(/base64,./,'base64,X');
   const boot=`window.__test={uploads:[],states:[],messages:[]};const mockInitial=${js(initial)};
   ${mode==='openai'?`window.openai={toolOutput:mockInitial.structuredContent,toolResponseMetadata:{status:'complete',call_tool_result:mockInitial},uploadFile:async(file)=>{if(window.__test.rejectUpload)throw Error('Rejected');const b=await file.arrayBuffer();window.__test.uploads.push({name:file.name,mimeType:file.type,size:b.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),b=>b.toString(16).padStart(2,'0')).join('')});return {fileId:'file-mock-'+window.__test.uploads.length};},setWidgetState:async(s)=>{if(window.__test.rejectState)throw Error('State rejected');window.__test.states.push(s);},sendFollowUpMessage:async(p)=>{window.__test.messages.push(p);}};`:''}`;
   const html=widgetHtml(origin).replace('<script>','<script>'+boot);
   res.writeHead(200,{'content-type':'text/html'});
   return res.end(`<!doctype html><html><body style="margin:0"><div style="font:13px Arial;padding:6px">LOCAL MOCK HOST. No AI analysis.</div><iframe id="view" sandbox="allow-scripts allow-downloads" style="width:100%;height:1550px;border:0"></iframe><script>
   const frame=document.getElementById('view');const initial=${js(initial)};window.calls=[];window.contexts=[];window.messages=[];
   window.addEventListener('message',async e=>{if(e.source!==frame.contentWindow||e.data?.jsonrpc!=='2.0')return;const m=e.data;window.calls.push(m.method);let result={};
     if(m.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostContext:{availableDisplayModes:['inline','fullscreen']},hostCapabilities:{message:{text:{}},updateModelContext:{}}};
     if(m.method==='ui/notifications/initialized'){${mode==='standard'?`frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:initial},'*');`:''}return;}
     if(m.method==='ui/update-model-context'){window.contexts.push(m.params);if(window.rejectContext)result={isError:true};}
     if(m.method==='ui/message'){window.messages.push(m.params);if(window.rejectMessage)result={isError:true};else if(!window.noProposal)setTimeout(async()=>{const r=await fetch('/simulate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({planToken:initial.structuredContent.planToken})}).then(r=>r.json());frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:r},'*');},200);}
     if(m.method==='ui/request-display-mode')result={mode:m.params.mode};
     if(m.id!==undefined)frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result},'*');
   });frame.srcdoc=${js(html)};</script></body></html>`);
 }
 send(res,{error:'test endpoint not found'},404);
}catch(e){send(res,toolError(e),e.status||500);}}).listen(port,'127.0.0.1',()=>console.log('LOCAL Phase2 core/UI HTTP adapter at '+origin+'; not MCP SDK or AI inference'));
