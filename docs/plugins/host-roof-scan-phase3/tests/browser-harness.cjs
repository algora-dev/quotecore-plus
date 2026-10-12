// Loopback-only test harness. Uses real service + widget; NOT Next, SDK or ChatGPT.
// In a source-slice run, QC_TEST_OUT may contain explicitly labelled geometry adapters.
const http=require('node:http');const path=require('node:path');
const {fixture,points,out}=require('../../host-roof-scan-phase1/tests/fixture.cjs');
const load=n=>require(path.join(out,'app/lib/free-tools/host-roof-scan',n));
const {HostOutlineService}=load('service'),{MemoryImageStore}=load('store'),{MemoryReferenceStore}=load('reference-store');
const {widgetHtml,widgetCsp}=load('widget');
const port=Number(process.env.QC_BROWSER_PORT||4770),origin=`http://127.0.0.1:${port}`;
let offset=0,nextError=null;const now=()=>Date.now()+offset,counts={upload:0,open:0,confirm:0,export:0,submit:0};
const service=new HostOutlineService({origin,secret:'local-browser-test-only-not-a-deployment-secret-0123456789',store:new MemoryImageStore(now),referenceStore:new MemoryReferenceStore(now),referenceMode:'opaque',now,allowedFileOrigins:[]});
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);
 if(req.method==='GET'&&url.pathname==='/seed'){
  const u=await service.upload(await fixture()),d=u.structuredContent;counts.submit++;
  const r=await service.submit({planToken:d.planToken,observedImageId:d.plan.imageId,outcome:'proposed',roof_areas:[{name:'Browser test fixture',points,pitch_degrees:null}],notes:['Synthetic software fixture. Not a vision test.']});return json(res,200,r.structuredContent);
 }
 if(req.method==='GET'&&url.pathname==='/counts')return json(res,200,counts);
 if(req.method==='GET'&&url.pathname==='/fixture.png'){res.writeHead(200,{'Content-Type':'image/png'});return res.end(await fixture());}
 if(req.method==='GET'&&url.pathname==='/mcp/host-scan/review'){res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':widgetCsp(origin),'Referrer-Policy':'no-referrer'});return res.end(widgetHtml(origin));}
 if(req.method==='POST'){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>6*1024*1024)throw Error('Harness body limit');chunks.push(chunk);}const bytes=Buffer.concat(chunks);
  if(url.pathname==='/control'){const c=JSON.parse(bytes);if('nextError'in c)nextError=c.nextError;if('offset'in c)offset=c.offset;return json(res,200,{ok:true});}
  if(url.pathname==='/api/public/host-roof-scan'){
   const raw=req.headers['content-type']==='application/octet-stream',input=raw?{action:'upload'}:JSON.parse(bytes),action=input.action;
   if(action in counts)counts[action]++;
   if(nextError?.action===action){const e=nextError;nextError=null;if(e.html){res.writeHead(e.status,{'Content-Type':'text/html'});return res.end('<h1>Test deployment protection</h1>');}return json(res,e.status,{isError:true,structuredContent:{version:'qc-host-outline-v1',status:'error',code:e.code,message:'Injected test failure'}});}
   if(!['upload','open','confirm','export','delete'].includes(action))return json(res,400,{error:'Invalid harness action'});
   const r=action==='upload'?await service.upload(bytes):action==='delete'?await service.remove(input.args):await service[action](input.args);return json(res,200,r);
  }
 }
 res.writeHead(404);res.end('Not found');
}catch(e){json(res,e.status||400,{isError:true,structuredContent:{version:'qc-host-outline-v1',status:'error',code:e.code||'HARNESS_ERROR',message:e.message}});}});
server.listen(port,'127.0.0.1',()=>console.log('Loopback browser harness ready at '+origin));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
