/** Isolated print window: no global header/section/footer hiding rules. */
export function printTakeoffReport(element:HTMLElement):boolean{
  const popup=window.open('','_blank');if(!popup)return false;
  popup.opener=null;
  const clone=element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('details').forEach(d=>d.open=true);
  clone.querySelectorAll('button,[data-print-hide]').forEach(el=>el.remove());
  clone.querySelectorAll('[data-print-group]').forEach(group=>{if(group.querySelectorAll('tbody tr').length<=8)group.setAttribute('data-print-keep','');});
  // Only safe DOM text and locally generated report markup are copied.
  const styles=Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map(el=>el.outerHTML).join('\n');
  popup.document.open();popup.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QuoteCore+ takeoff report</title>${styles}<style>
    @page{size:A4;margin:15mm 13mm}html,body{margin:0;background:white!important;color:black;font:12px Arial,sans-serif}
    [data-takeoff-paper]{max-width:none!important;border:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important}
    [data-takeoff-paper] [data-print-keep]{break-inside:avoid} [data-takeoff-paper] table{width:100%;border-collapse:collapse}
    [data-print-group]{padding:10px 0!important}[data-print-group] summary{min-height:20px!important}
    [data-print-group] details{margin-top:5px!important}[data-print-group] table{margin:6px 0!important}
    [data-print-group] th,[data-print-group] td{padding:5px 6px!important}
    [data-takeoff-paper] tr{break-inside:avoid} [data-takeoff-paper] thead{display:table-header-group}
    [data-takeoff-paper] summary{list-style:none} [data-takeoff-paper] details{display:block}
    [data-takeoff-paper] h2,[data-takeoff-paper] h3{break-after:avoid} [data-takeoff-paper] *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .print-controls{padding:12px;margin:0 0 18px;background:#f2f4f6}.print-controls button{padding:10px 14px;cursor:pointer}
    @media print{.print-controls{display:none}}
  </style></head><body><div class="print-controls"><button onclick="window.print()">Print / Save PDF</button> <span>Your takeoff stays open in the other tab.</span></div>${clone.outerHTML}</body></html>`);
  popup.document.close();
  const wait=Array.from(popup.document.querySelectorAll('link[rel="stylesheet"]')).map(link=>new Promise<void>(resolve=>{if((link as HTMLLinkElement).sheet){resolve();return;}link.addEventListener('load',()=>resolve(),{once:true});link.addEventListener('error',()=>resolve(),{once:true});setTimeout(resolve,2500);}));
  void Promise.all(wait).then(()=>{if(!popup.closed){popup.focus();popup.print();}});return true;
}
