from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os
O=Path(os.environ.get('QC_FIXTURES',str(Path(__file__).resolve().parents[1]/'fixtures')));(O/'screens').mkdir(exist_ok=True)
report=[];feedback=[];functional=[]
css=(O/'fixture.css').read_text()
def html(f): return f.read_text().replace('<link rel="stylesheet" href="fixture.css">','<style>'+css+'</style>')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('QC_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page()
 for file in sorted(O.glob('*.html')):
  for w,h in [(1440,1000),(390,844),(320,720),(844,390)]:
   page.set_viewport_size({'width':w,'height':h});page.set_content(html(file));page.wait_for_timeout(25)
   data=page.evaluate('''() => { const vw=innerWidth; const overflow=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&s.display!=='none'&&(r.right>vw+2||r.left < -2)&&!e.closest('dialog:not([open])')&&!e.closest('.qc-library-table-scroll,.qc-flow-table-scroll,.qc-flow-scroll')}).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,text:(e.textContent||'').trim().slice(0,80),right:Math.round(e.getBoundingClientRect().right),width:Math.round(e.getBoundingClientRect().width)})); const d=document.querySelector('dialog[open]');return {pageOverflow:document.documentElement.scrollWidth>vw+2,scrollWidth:document.documentElement.scrollWidth,overflow,dialog:d?{top:d.getBoundingClientRect().top,bottom:d.getBoundingClientRect().bottom,height:innerHeight}:null,controls:document.querySelectorAll('button,input,select,textarea').length}; }''')
   report.append({'screen':file.stem,'width':w,'height':h,**data})
   if w in (1440,390):page.screenshot(path=str(O/'screens'/f'{file.stem}-{w}.png'),full_page=True)
 # Real CSS focus/hover/pressed + native details, no substituted app event handlers.
 page.set_viewport_size({'width':390,'height':844});page.set_content(html(O/'quotes-partial-export.html'))
 for query in ['.qc-action-result button','.qc-action-result summary']:
  c=page.locator(query).first
  def appearance(): return c.evaluate('(e)=>{const s=getComputedStyle(e);return {background:s.backgroundColor,shadow:s.boxShadow,outline:s.outlineStyle,outlineWidth:s.outlineWidth,active:e.matches(":active"),focus:e.matches(":focus-visible"),height:e.getBoundingClientRect().height}}')
  page.mouse.move(1,1);default=appearance();c.hover();page.wait_for_timeout(160);hover=appearance();c.focus();focus=appearance();page.mouse.down();page.wait_for_timeout(160);pressed=appearance();page.mouse.up()
  feedback.append({'selector':query,'default':default,'hover':hover,'focus':focus,'pressed':pressed})
 page.set_content(html(O/'long-result-details.html'));summary=page.locator('.qc-action-result summary');summary.focus();page.keyboard.press('Enter');
 details=page.locator('.qc-action-result-details');ul=details.locator('ul');ul.focus()
 functional.append({'check':'Native details opens from keyboard, all 13 failure details accessible, scrollable region focusable','pass':details.get_attribute('open') is not None and ul.locator('li').count()==13 and ul.evaluate('e=>e.scrollHeight>e.clientHeight && e===document.activeElement')})
 page.emulate_media(reduced_motion='reduce',forced_colors='active');page.set_content(html(O/'quotes-partial-export.html'));page.locator('.qc-action-result button').focus()
 forced=page.locator('.qc-action-result button').evaluate('(e)=>{const s=getComputedStyle(e);return {outline:s.outlineStyle,width:s.outlineWidth,background:s.backgroundColor,transition:s.transitionDuration}}')
 functional.append({'check':'Forced-colors result action retains visible focus; reduced motion enabled','pass':forced['outline']!='none' and forced['width']!='0px','computed':forced})
 b.close()
 data={'method':'Chromium on source-derived static specimens, not React/Next. No live data, requests, writes, saving or email. Only CSS, native details and dialog geometry exercised.','screens':report,'feedback':feedback,'nativeChecks':functional}
 json.dump(data,open(O/'browser-report.json','w'),indent=2)
 print('Checks',len(report));print('Page overflow',[(r['screen'],r['width']) for r in report if r['pageOverflow']]);print('Elements outside viewport',[(r['screen'],r['width'],r['overflow'][:2]) for r in report if r['overflow']]);print('Native checks',functional)
 bad=[r for r in report if r['pageOverflow'] or (r['dialog'] and (r['dialog']['top'] < -2 or r['dialog']['bottom']>r['height']+2))]
 if bad or not all(x['pass'] for x in functional): raise SystemExit(1)
