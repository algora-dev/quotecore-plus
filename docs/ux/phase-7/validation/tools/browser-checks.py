from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os
O=Path(os.environ.get('QC_FIXTURES',str(Path(__file__).resolve().parents[1]/'fixtures')));(O/'screens').mkdir(exist_ok=True)
report=[];screens={'resources','document-templates','document-template-choose','message-templates','message-template-edit','invoice-template-edit','quote-header-edit','order-template-edit','pricing-library','component-create','inbox','notification-settings','supplier-directory','supplier-library','supplier-portal','supplier-profile-edit','quotes-error','quotes','invoice-picker-error','catalogue-components','send-options'}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('QC_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page()
 for file in sorted(O.glob('*.html')):
  for w,h in [(1440,1000),(390,844),(320,720),(844,390)]:
   page.set_viewport_size({'width':w,'height':h});page.set_content(file.read_text().replace('<link rel="stylesheet" href="fixture.css">','<style>'+ (O/'fixture.css').read_text() +'</style>'));page.wait_for_timeout(20)
   data=page.evaluate('''() => { const vw=innerWidth; const overflow=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); const s=getComputedStyle(e);return r.width>0&&s.display!=='none'&&(r.right>vw+2||r.left < -2)&&!e.closest('dialog:not([open])')&&!e.closest('.qc-library-table-scroll,.qc-flow-table-scroll,.qc-flow-scroll')}).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,text:(e.textContent||'').trim().slice(0,80),right:Math.round(e.getBoundingClientRect().right),width:Math.round(e.getBoundingClientRect().width)})); const d=document.querySelector('dialog[open]');return {pageOverflow:document.documentElement.scrollWidth>vw+2,scrollWidth:document.documentElement.scrollWidth,overflow,dialog:d?{top:d.getBoundingClientRect().top,bottom:d.getBoundingClientRect().bottom,height:innerHeight}:null,controls:document.querySelectorAll('button,input,select,textarea').length,back:!!document.querySelector('.qc-mobile-return a,.qc-page-back')}; }''')
   report.append({'screen':file.stem,'width':w,'height':h,**data})
   if file.stem in screens and w in (1440,390):page.screenshot(path=str(O/'screens'/f'{file.stem}-{w}.png'),full_page=True)
 # State feedback check on primary control in real shared primitive.
 page.set_viewport_size({'width':1440,'height':1000});page.set_content((O/'document-templates.html').read_text().replace('<link rel="stylesheet" href="fixture.css">','<style>'+ (O/'fixture.css').read_text() +'</style>'));button=page.locator('button[data-qc-variant="primary"]').first
 def appearance(): return button.evaluate('(e)=>{const s=getComputedStyle(e);return {background:s.backgroundImage,shadow:s.boxShadow,outline:s.outlineStyle,outlineWidth:s.outlineWidth,active:e.matches(":active")}}')
 default=appearance();button.hover();page.wait_for_timeout(200);hover=appearance();button.focus();focus=appearance();page.mouse.down();page.wait_for_timeout(200);pressed=appearance();page.mouse.up();
 json.dump({'method':'Chromium on source-derived static specimens; no React mounting, real data, handlers, requests, saves or payments. Overflow, native dialog bounds and CSS feedback only.','screens':report,'feedback':{'default':default,'hover':hover,'focus':focus,'pressed':pressed}},open(O/'browser-report.json','w'),indent=2)
 b.close()
print('Checks',len(report));print('Page overflow',[(r['screen'],r['width']) for r in report if r['pageOverflow']]);print('Elements outside viewport',[(r['screen'],r['width'],r['overflow'][:2]) for r in report if r['overflow']])
