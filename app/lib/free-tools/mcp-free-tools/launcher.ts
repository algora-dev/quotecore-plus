export const FREE_TOOLS_LAUNCHER_URI = 'ui://quotecore/free-tools-launcher-v2.html';

/** Small MCP Apps surface. The real workflow always opens in the existing
 * QuoteCore+ free-tool UX; this card is intentionally only a launcher. */
export function freeToolsLauncherHtml(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:14px system-ui;margin:0;padding:14px;color:#0f172a}.card{border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#fff}.eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;color:#9a3412;text-transform:uppercase}.title{font-size:16px;font-weight:700;margin:4px 0 6px}.copy{color:#475569;line-height:1.45}.open{display:inline-block;margin-top:12px;border:0;border-radius:999px;background:#ff6b35;color:#fff;font-weight:700;padding:9px 14px;text-decoration:none;cursor:pointer}.open[hidden]{display:none}</style></head>
<body><div class="card"><div class="eyebrow">QuoteCore+ Free Tools</div><div class="title" id="title">Workflow ready</div><div class="copy" id="copy">Review the prepared workflow in QuoteCore+.</div><a class="open" id="open" hidden target="_blank" rel="noreferrer">Open QuoteCore+</a></div>
<script>
(function(){
  function render(value){
    var data=value&&value.structuredContent?value.structuredContent:value;
    if(!data||typeof data!=='object') return;
    var firstTool=Array.isArray(data.tools)&&data.tools.length?data.tools[0]:null;
    var link=typeof data.resultUrl==='string'?data.resultUrl:(firstTool&&typeof firstTool.url==='string'?firstTool.url:null);
    var a=document.getElementById('open');
    if(link){a.href=link;a.hidden=false;}
    var title=data.workflow==='measurements_to_pricing'?'Measurements to Pricing':data.trade?String(data.trade).replace(/^./,function(c){return c.toUpperCase();})+' takeoff':firstTool&&firstTool.name?String(firstTool.name):'Workflow ready';
    document.getElementById('title').textContent=title;
    if(data.hasSuggestedOutline) document.getElementById('copy').textContent='The exterior outline is a suggestion. Calibrate, check and correct it; then scan components or continue manually.';
    else if(data.measurementCount) document.getElementById('copy').textContent=String(data.measurementCount)+' measurements are ready to review with your pricing inputs.';
    else if(firstTool) document.getElementById('copy').textContent=typeof data.message==='string'?data.message:'Open the matching QuoteCore+ Free Tool.';
  }
  try{render(window.openai&&window.openai.toolOutput);}catch(e){}
  window.addEventListener('message',function(e){try{render(e.data);}catch(_){}});
})();
</script></body></html>`;
}
