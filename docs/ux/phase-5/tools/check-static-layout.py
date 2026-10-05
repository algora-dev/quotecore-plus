"""Static layout evidence only, not React/Next application regression tests."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
root=Path(os.environ.get('QC_FIXTURE_OUT', Path(__file__).resolve().parents[1]/'fixtures')); out=root/'screenshots';out.mkdir(exist_ok=True)
def load(page,name):
 import re,base64,mimetypes
 content=(root/(name+'.html')).read_text().replace('<link rel="stylesheet" href="fixtures.css">','<style>'+(root/'fixtures.css').read_text()+'</style>')
 def image(m):
  path=Path(os.environ.get('QC_SOURCE_ROOT', Path(__file__).resolve().parents[4]))/'public'/m.group(1).lstrip('/')
  if path.is_file():return 'src="data:'+mimetypes.guess_type(path)[0]+';base64,'+base64.b64encode(path.read_bytes()).decode()+'"'
  return m.group(0)
 content=re.sub(r'src="(/[^"]+)"',image,content)
 page.set_content(content)
manifest=json.loads((root/'fixture-manifest.json').read_text()); results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('QC_CHROMIUM') or None,headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 for name in manifest['cases']:
  for width in [1440,1280,1024,800,390]:
   page.set_viewport_size({'width':width,'height':1000})
   load(page,name);page.wait_for_timeout(70)
   data=page.evaluate('''() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,grid:document.querySelector('.qc-document-body')&&getComputedStyle(document.querySelector('.qc-document-body')).gridTemplateColumns,visiblePanel:[...document.querySelectorAll('.qc-document-panel')].some(e=>!!e.offsetWidth),previewWidth:document.querySelector('.qc-document-preview')?.getBoundingClientRect().width,pdfHooks:document.querySelectorAll('[data-pdf-content]').length,buttons:[...document.querySelectorAll('button')].filter(e=>e.offsetWidth&&!e.disabled).length})''')
   data.update(name=name,overflow=data['scrollWidth']>width+1)
   results.append(data)
   if (width==1440 and name in ['quote','invoice','invoice-details','order-lines','order-single','order-double','order-picker','quote-add-item','visual-add-item','quote-edit-line','quote-full-preview']) or (width==390 and name in ['quote','invoice','order-single']):
    page.screenshot(path=str(out/f'{name}-{width}.png'),full_page=False)
 print('cases',len(results),'overflow',[r for r in results if r['overflow']])
 # Actual browser focus/hover/pressed on static C01 controls.
 page.set_viewport_size({'width':1440,'height':1000});load(page,'quote')
 button=page.locator('[data-copilot="cl-save-return"]');style='e=>({background:getComputedStyle(e).backgroundImage,outline:getComputedStyle(e).outlineWidth,shadow:getComputedStyle(e).boxShadow})'
 normal=button.evaluate(style);button.hover();page.wait_for_timeout(180);hover=button.evaluate(style);button.focus();focus=button.evaluate(style);page.mouse.down();page.wait_for_timeout(180);pressed=button.evaluate(style);page.mouse.up()
 (root/'control-state-check.json').write_text(json.dumps({'normal':normal,'hover':hover,'focus':focus,'pressed':pressed,'limitation':'Static browser CSS only; no React event execution.'},indent=2))
 browser.close()
(root/'layout-check.json').write_text(json.dumps({'method':'Browser measurements of source-derived static specimens, not running app.','results':results},indent=2))
