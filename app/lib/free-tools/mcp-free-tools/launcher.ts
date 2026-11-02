export const FREE_TOOLS_LAUNCHER_VERSION = '4.0.1';
export const FREE_TOOLS_LAUNCHER_URI = 'ui://quotecore/free-tools-launcher-v4-0-1.html';

/** Small MCP Apps surface. The real workflow always opens in the existing
 * QuoteCore+ free-tool UX; this card is intentionally only a launcher.
 *
 * The resource URI is intentionally versioned. ChatGPT/MCP Apps hosts may cache
 * UI resources by URI, so incompatible HTML/JS changes must publish a new URI.
 *
 * Bridge protocol (MCP Apps standard, protocolVersion 2026-01-26): the widget
 * calls ui/initialize over postMessage JSON-RPC, confirms with
 * ui/notifications/initialized, and renders ui/notifications/tool-result.
 * External navigation uses the standard ui/open-link request first, then the
 * ChatGPT-specific window.openai.openExternal compatibility API, then a normal
 * browser open as a final fallback. */
export function freeToolsLauncherHtml(): string {
  return `<!doctype html>
<html data-qcp-launcher-version="${FREE_TOOLS_LAUNCHER_VERSION}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="qcp-launcher-version" content="${FREE_TOOLS_LAUNCHER_VERSION}">
<style>body{font:14px system-ui;margin:0;padding:14px;color:#0f172a}.card{border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#fff}.eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;color:#9a3412;text-transform:uppercase}.title{font-size:16px;font-weight:700;margin:4px 0 6px}.copy{color:#475569;line-height:1.45}.open{display:inline-block;margin-top:12px;border:0;border-radius:999px;background:#ff6b35;color:#fff;font:inherit;font-weight:700;padding:9px 14px;cursor:pointer}.open[hidden]{display:none}.url{display:block;margin-top:8px;font-size:11px;color:#64748b;word-break:break-all}.url[hidden]{display:none}.version{margin-top:10px;font-size:10px;color:#94a3b8}</style></head>
<body><div class="card"><div class="eyebrow">QuoteCore+ Free Tools</div><div class="title" id="title">Workflow ready</div><div class="copy" id="copy">Review the prepared workflow in QuoteCore+.</div><button class="open" id="open" hidden type="button">Open QuoteCore+</button><code class="url" id="url" hidden></code><div class="version">Launcher v${FREE_TOOLS_LAUNCHER_VERSION}</div></div>
<script>
(function(){
  var currentLink=null;
  var rpcId=0;
  var pending={};
  var initialized=false;
  var bridgeReady=null;
  function post(m){try{window.parent.postMessage(m,'*');}catch(e){console.error('QuoteCore+ launcher postMessage failed',e);}}
  function notify(method,params){post({jsonrpc:'2.0',method:method,params:params||{}});}
  function request(method,params,timeoutMs){return new Promise(function(resolve,reject){
    var id=++rpcId;
    var timer=window.setTimeout(function(){if(!pending[id])return;delete pending[id];reject(new Error(method+' timed out'));},typeof timeoutMs==='number'?timeoutMs:5000);
    pending[id]={resolve:function(value){window.clearTimeout(timer);resolve(value);},reject:function(error){window.clearTimeout(timer);reject(error);}};
    post({jsonrpc:'2.0',id:id,method:method,params:params||{}});
  });}
  function render(value){
    var data=value&&value.structuredContent?value.structuredContent:value;
    if(!data||typeof data!=='object') return;
    if(typeof data.status!=='string'&&typeof data.resultUrl!=='string'&&!Array.isArray(data.tools)&&typeof data.workflow!=='string'&&typeof data.kind!=='string'&&typeof data.trade!=='string') return;
    var firstTool=Array.isArray(data.tools)&&data.tools.length?data.tools[0]:null;
    var link=typeof data.resultUrl==='string'?data.resultUrl:(firstTool&&typeof firstTool.url==='string'?firstTool.url:null);
    var button=document.getElementById('open');
    var u=document.getElementById('url');
    currentLink=link||null;
    if(link){button.hidden=false;u.textContent=link;u.hidden=false;}else{button.hidden=true;u.textContent='';u.hidden=true;}
    var title=data.workflow==='measurements_to_pricing'?'Measurements to Pricing':data.trade?String(data.trade).replace(/^./,function(c){return c.toUpperCase();})+' takeoff':firstTool&&firstTool.name?String(firstTool.name):data.kind==='quote'?'Quote draft':data.kind==='invoice'?'Invoice draft':data.kind==='order'?'Purchase order draft':'Workflow ready';
    document.getElementById('title').textContent=title;
    if(data.status==='error'&&typeof data.message==='string') document.getElementById('copy').textContent=data.message;
    else if(data.hasSuggestedOutline) document.getElementById('copy').textContent='The exterior outline is a suggestion. Calibrate, check and correct it; then scan components or continue manually.';
    else if(typeof data.measurementCount==='number'&&data.measurementCount>0) document.getElementById('copy').textContent=String(data.measurementCount)+' measurements are ready to review with your pricing inputs.';
    else if(firstTool) document.getElementById('copy').textContent=typeof data.message==='string'?data.message:'Open the matching QuoteCore+ Free Tool.';
  }
  function browserFallback(url){
    try{var w=window.open(url,'_blank','noopener,noreferrer');if(w) return true;}catch(e){console.error('QuoteCore+ launcher browser fallback failed',e);}
    return false;
  }
  function openExternalFallback(url){
    try{
      if(window.openai&&typeof window.openai.openExternal==='function'){
        return Promise.resolve(window.openai.openExternal({href:url,redirectUrl:false})).catch(function(){browserFallback(url);});
      }
    }catch(e){console.error('QuoteCore+ launcher openExternal failed',e);}
    browserFallback(url);
    return Promise.resolve();
  }
  function openCurrentLink(){
    if(!currentLink) return;
    var url=currentLink;
    if(window.parent===window){browserFallback(url);return;}
    Promise.resolve(bridgeReady).then(function(){return request('ui/open-link',{url:url},2500);}).catch(function(){return openExternalFallback(url);});
  }
  document.getElementById('open').addEventListener('click',openCurrentLink);
  window.addEventListener('message',function(e){
    if(e.source!==window.parent)return;
    var m=e.data;
    if(m&&m.jsonrpc==='2.0'){
      if((typeof m.id==='number'||typeof m.id==='string')&&pending[m.id]){var p=pending[m.id];delete pending[m.id];if(m.error)p.reject(m.error);else p.resolve(m.result);return;}
      if(m.method==='ui/notifications/tool-result'){try{render(m.params);}catch(err){console.error('QuoteCore+ launcher render failed',err);}}
      return;
    }
    try{render(m);}catch(err){console.error('QuoteCore+ launcher legacy render failed',err);}
  },{passive:true});
  console.info('QuoteCore+ MCP Apps launcher v${FREE_TOOLS_LAUNCHER_VERSION} boot');
  bridgeReady=request('ui/initialize',{appInfo:{name:'quotecore-free-tools-launcher',version:'${FREE_TOOLS_LAUNCHER_VERSION}'},appCapabilities:{availableDisplayModes:['inline']},protocolVersion:'2026-01-26'},5000).then(function(){initialized=true;notify('ui/notifications/initialized',{});console.info('QuoteCore+ MCP Apps launcher initialized');return true;},function(err){console.error('MCP Apps bridge init failed',err);throw err;});
  bridgeReady.catch(function(){});
  try{render(window.openai&&window.openai.toolOutput);}catch(e){console.error('QuoteCore+ launcher initial toolOutput render failed',e);}
  window.setTimeout(function(){if(!initialized)console.warn('QuoteCore+ MCP Apps launcher did not initialize within 5s');},5000);
})();
</script></body></html>`;
}
