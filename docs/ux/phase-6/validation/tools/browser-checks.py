from playwright.sync_api import sync_playwright
from pathlib import Path
import json,base64,os
D=Path(os.environ.get('QC_FIXTURES',str(Path(__file__).resolve().parent.parent/'fixtures')));(D/'screens').mkdir(exist_ok=True)
report=[];feedback=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('QC_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
 for f in sorted(D.glob('*.html')):
  for width in [1440,1024,390,320]:
   page=browser.new_page(viewport={'width':width,'height':1000 if width>500 else 844},device_scale_factor=1)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   html=f.read_text().replace('<link rel="stylesheet" href="fixture.css">','<style>'+(D/'fixture.css').read_text()+'</style>')
   for image in ['logo.png','q-mark.png','q-avatar.png']:
    if (D/image).exists(): html=html.replace('src="/'+image+'"','src="data:image/png;base64,'+base64.b64encode((D/image).read_bytes()).decode()+'"')
   page.set_content(html,wait_until='domcontentloaded');page.wait_for_timeout(80)
   data=page.evaluate('''() => ({body:document.documentElement.scrollWidth,viewport:innerWidth,dialogs:document.querySelectorAll('dialog[open]').length,
    unlabeledButtons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width && !e.textContent.trim() && !e.getAttribute('aria-label') && !e.title).map(e=>e.outerHTML.slice(0,240)),
    unnamedInputs:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>e.getBoundingClientRect().width && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.labels?.length).map(e=>({tag:e.tagName,type:e.type,html:e.outerHTML.slice(0,250)}))})''')
   data.update(name=f.stem,width=width,errors=errors)
   if data['dialogs']:
    page.evaluate('''() => {const b=document.createElement('button');b.id='fixture-background-sentinel';b.textContent='Background test control';document.body.append(b);}''')
    focus=[]
    for _ in range(24):
     page.keyboard.press('Tab');focus.append(page.evaluate('''() => ({tag:document.activeElement?.tagName,inDialog:!!document.activeElement?.closest('dialog'),backgroundControl:document.activeElement?.id==='fixture-background-sentinel'})'''))
    data['nativeDialogFocus']=focus
    data['backgroundControlReceivedFocus']=any(x['backgroundControl'] for x in focus)
    data['nonDialogContentReceivedFocus']=any(not x['inDialog'] and x['tag'] not in ['BODY','HTML'] for x in focus)
    page.evaluate("document.getElementById('fixture-background-sentinel').remove()")
    end=page.locator('dialog[open] button').last
    if end.count():
     end.scroll_into_view_if_needed()
     data['lastDialogButtonReachable']=end.evaluate('e=>{const r=e.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth}')
    page.evaluate("for(const e of document.querySelectorAll('dialog,dialog *')){if(e.scrollTop)e.scrollTop=0;}")
   if width in [1440,390]:
    page.evaluate('document.activeElement?.blur()');page.screenshot(path=str(D/'screens'/f'{f.stem}-{width}.png'),full_page=True)
   if width==1440 and f.stem in ['login','quotes','catalogue-upload','send-options']:
    for selector in ['.qc-button:not(:disabled)','.qc-input:not(:disabled)','[role="button"].qc-flow-dropzone']:
     el=page.locator(selector).first
     if not el.count() or not el.is_visible():continue
     def style():return el.evaluate('''e=>{const c=getComputedStyle(e);return {outline:c.outline,outlineOffset:c.outlineOffset,border:c.borderColor,background:c.backgroundColor,shadow:c.boxShadow,transform:c.transform}}''')
     normal=style();el.hover();page.wait_for_timeout(180);hover=style();page.keyboard.press('Tab');el.focus();focusStyle=style();el.hover();page.mouse.down();page.wait_for_timeout(180);pressed=style();page.mouse.up();page.wait_for_timeout(180)
     feedback.append({'fixture':f.stem,'selector':selector,'normal':normal,'hover':hover,'focus':focusStyle,'pressed':pressed})
   report.append(data);page.close()
 browser.close()
(D/'browser-report.json').write_text(json.dumps(report,indent=2));(D/'interaction-feedback.json').write_text(json.dumps(feedback,indent=2))
print('Fixture renders:',len(report))
print('Page overflow:',[(x['name'],x['width'],x['body']) for x in report if x['body']>x['viewport']+1])
print('Unlabelled buttons:',[(x['name'],len(x['unlabeledButtons'])) for x in report if x['unlabeledButtons'] and x['width']==1440])
print('Unnamed inputs:',[(x['name'],len(x['unnamedInputs'])) for x in report if x['unnamedInputs'] and x['width']==1440])
print('Native dialog focus escaped to background:',[(x['name'],x['width']) for x in report if x.get('nonDialogContentReceivedFocus')])
print('Page script errors:',[(x['name'],x['errors']) for x in report if x['errors']])
print('Feedback observations:',len(feedback))

print('Unreachable last dialog button:',[(x['name'],x['width'])for x in report if x.get('lastDialogButtonReachable') is False])
