from playwright.sync_api import sync_playwright
from pathlib import Path
import json,base64
root=Path(__file__).resolve().parent.parent / 'fixtures'
report=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-network'])
 for mode,w,h in [('desktop-measured',1440,900),('desktop-measured',1280,800),('desktop-measured',1024,768),('desktop-measured',800,700),('desktop-library',1440,900),('desktop-calibration',1280,800),('desktop-upload',1280,800)]:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  html=(root/(mode+'.html')).read_text().replace('<link rel="stylesheet" href="fixture.css">', '<style>'+ (root/'fixture.css').read_text()+'</style>')
  for image in ['q-mark.png','plan-sample.png']:
   html=html.replace('src="'+image+'"','src="data:image/png;base64,'+base64.b64encode((root/image).read_bytes()).decode()+'"')
  page.route('**/*', lambda route: route.abort())
  page.set_content(html);page.wait_for_timeout(150)
  result=page.evaluate('''() => {
    const box=s=>{const el=document.querySelector(s);if(!el)return null;let r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}};
    return {documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,viewport:[innerWidth,innerHeight],toolbar:box('.qc-takeoff-toolbar'),panel:box('.qc-takeoff-panel'),canvas:box('.qc-takeoff-canvas-scroll'),status:box('.qc-takeoff-canvas-status'),finish:box('[data-copilot="takeoff-save"]'),dialog:box('dialog'),buttons:[...document.querySelectorAll('button')].filter(b=>b.offsetWidth && !b.closest('[hidden]')).map(b=>({text:b.innerText||b.getAttribute('aria-label'),r:b.getBoundingClientRect().toJSON(),font:getComputedStyle(b).fontSize}))};
  }''')
  report.append({'mode':mode,'width':w,'height':h,**result});page.screenshot(path=str(root/f'{mode}-{w}.png'),full_page=True);page.close()
 browser.close()
(root/'browser-layout-checks.json').write_text(json.dumps(report,indent=2))
for x in report:
 print(x['mode'],x['width'],x['documentWidth'],x['documentHeight'],'canvas',x['canvas'],'toolbar',x['toolbar'],'dialog',x['dialog'])
