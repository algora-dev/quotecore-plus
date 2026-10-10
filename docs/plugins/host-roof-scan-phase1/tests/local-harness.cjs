#!/usr/bin/env node
/** LOCAL SOFTWARE HARNESS, NOT CHATGPT OR AN AI ACCURACY TEST.
 * Uses real core and widget. Supplies explicitly synthetic host geometry.
 * Does not exercise production SDK transport, Next middleware or Supabase.
 */
const http=require('node:http'),path=require('node:path');
const {fixture,points,out}=require('./fixture.cjs');
const {HostOutlineService,toolError}=require(path.join(out,'app/lib/free-tools/host-roof-scan/service'));
const {MemoryImageStore}=require(path.join(out,'app/lib/free-tools/host-roof-scan/store'));
const {HOST_OUTLINE_TOOLS,SERVER_INSTRUCTIONS}=require(path.join(out,'app/lib/free-tools/host-roof-scan/contract'));
const {widgetHtml,widgetCsp}=require(path.join(out,'app/lib/free-tools/host-roof-scan/widget'));
const {RESOURCE_URI}=require(path.join(out,'app/lib/free-tools/host-roof-scan/types'));
const port=Number(process.env.PORT||4767),origin='http://127.0.0.1:'+port;
const service=new HostOutlineService({origin,secret:'local-harness-only-do-not-deploy-1234567890',store:new MemoryImageStore(),allowedFileOrigins:[]});
async function read(req){const b=[];let n=0;for await(const p of req){n+=p.length;if(n>4*1024*1024)throw new Error('Oversized test request');b.push(p);}return Buffer.concat(b);}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,accept,mcp-protocol-version'});res.end(JSON.stringify(data));}
async function seed(proposal=true){const u=await service.upload(await fixture());const d=u.structuredContent;const p=proposal?await service.submit({planToken:d.planToken,observedImageId:d.plan.imageId,outcome:'proposed',roof_areas:[{name:'Synthetic roof',points,pitch_degrees:null}],notes:['Software fixture only. Coordinates were supplied by the test harness.']}):null;return service.open({planToken:d.planToken,...(p?{proposalToken:p.structuredContent.proposalToken}:{})});}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin);
  if(req.method==='OPTIONS')return json(res,{});
  if(url.pathname==='/fixture.png'){res.writeHead(200,{'Content-Type':'image/png'});return res.end(await fixture());}
  if(url.pathname==='/seed')return json(res,await seed(url.searchParams.get('proposal')!=='false'));
  if(url.pathname==='/mcp/host-scan/review'){res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':widgetCsp(origin),'Referrer-Policy':'no-referrer'});return res.end(widgetHtml(origin));}
  if(url.pathname==='/api/public/host-roof-scan'){
   const buf=await read(req);if(!String(req.headers['content-type']).includes('application/json'))return json(res,await service.upload(buf));
   const {action,args}=JSON.parse(buf);const fn={open:'open',confirm:'confirm',export:'export',delete:'remove'}[action];if(!fn)return json(res,{error:'bad action'},400);return json(res,await service[fn](args));
  }
  if(url.pathname==='/rpc-harness'){
   const {id,method,params}=JSON.parse(await read(req));let result;
   if(method==='initialize')result={protocolVersion:'2025-03-26',serverInfo:{name:'LOCAL HARNESS NOT SDK',version:'0.1'},capabilities:{tools:{},resources:{}},instructions:SERVER_INSTRUCTIONS};
   else if(method==='notifications/initialized'){res.writeHead(202);return res.end();}
   else if(method==='tools/list')result={tools:HOST_OUTLINE_TOOLS};
   else if(method==='resources/list')result={resources:[{uri:RESOURCE_URI,mimeType:'text/html;profile=mcp-app'}]};
   else if(method==='resources/read')result={contents:[{uri:RESOURCE_URI,mimeType:'text/html;profile=mcp-app',text:widgetHtml(origin)}]};
   else if(method==='tools/call')result=await service.call(params.name,params.arguments);
   else return json(res,{jsonrpc:'2.0',id,error:{code:-32601,message:'Unknown test method'}},400);
   return json(res,{jsonrpc:'2.0',id,result});
  }
  if(url.pathname==='/test-host'){
   const initial=await seed(false),html=widgetHtml(origin);
   res.writeHead(200,{'Content-Type':'text/html'});
   return res.end(`<!doctype html><html><body style="margin:0"><div style="padding:8px;background:#fff7ed;font:12px Arial">LOCAL MOCK HOST. Synthetic coordinates, no AI inference.</div><iframe id="view" sandbox="allow-scripts allow-downloads" style="width:100%;height:1500px;border:0"></iframe><script>
const initial=${JSON.stringify(initial).replace(/</g,'\\u003c')};const iframe=document.getElementById('view');window.calls=[];window.reviewContext=null;
window.addEventListener('message',async e=>{if(e.source!==iframe.contentWindow||e.data?.jsonrpc!=='2.0')return;const m=e.data;window.calls.push(m.method);let result={};
if(m.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostInfo:{name:'LOCAL MOCK',version:'0.1'},hostCapabilities:{message:{text:{}},updateModelContext:{}},hostContext:{availableDisplayModes:['inline','fullscreen']}};
if(m.method==='ui/notifications/initialized'){iframe.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{}}},'*');iframe.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:initial},'*');return;}
if(m.method==='ui/message'){
if(window.rejectMessage||!Array.isArray(m.params.content)){
iframe.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result:{isError:true}},'*');return;}
window.lastMessage=m.params;const r=await fetch('/simulate-host',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({planToken:initial.structuredContent.planToken})}).then(r=>r.json());iframe.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:r},'*');}
if(m.method==='ui/update-model-context')window.reviewContext=m.params;
if(m.method==='ui/request-display-mode')result={mode:m.params.mode};
if(m.id!==undefined)iframe.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result},'*');});
iframe.srcdoc=${JSON.stringify(html).replace(/</g,'\\u003c')};</script></body></html>`);
  }
  if(url.pathname==='/simulate-host'){
   const {planToken}=JSON.parse(await read(req));const prepared=await service.prepare({planToken});const p=await service.submit({planToken,observedImageId:prepared.structuredContent.plan.imageId,outcome:'proposed',roof_areas:[{name:'Synthetic roof',points,pitch_degrees:null}],notes:['Mock host supplied fixture geometry. This did not test AI vision.']});return json(res,await service.open({planToken,proposalToken:p.structuredContent.proposalToken}));
  }
  json(res,{error:'not found'},404);
 }catch(e){json(res,toolError(e),e.status||500);}
});
server.listen(port,'127.0.0.1',()=>console.log('LOCAL CORE/UI HARNESS '+origin+' (NOT Next or real MCP SDK)'));
