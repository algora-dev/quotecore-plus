from playwright.sync_api import sync_playwright
from pathlib import Path
import json,base64
r=Path(__file__).resolve().parent.parent / 'fixtures'
def html(mode):
 s=(r/(mode+'.html')).read_text().replace('<link rel="stylesheet" href="fixture.css">','<style>'+(r/'fixture.css').read_text()+'</style>')
 for image in ['q-mark.png','plan-sample.png']:s=s.replace('src="'+image+'"','src="data:image/png;base64,'+base64.b64encode((r/image).read_bytes()).decode()+'"')
 return s
report={'kind':'STATIC_CSS_ONLY','checks':[],'limitations':'No React event handlers, native-dialog component lifecycle, mobile mode or Fabric canvas executed. Sample HTML controls only.'}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':900});page.route('**/*',lambda route:route.abort());page.set_content(html('desktop-measured'))
 selectors=['[data-copilot="takeoff-save"]','.qc-canvas-tool[aria-pressed="true"]','.qc-takeoff-component-select','.qc-takeoff-icon-action','.qc-takeoff-back']
 js='''el => {const c=getComputedStyle(el);return {background:c.backgroundColor,backgroundImage:c.backgroundImage,color:c.color,border:c.borderColor,outline:c.outline,shadow:c.boxShadow,transform:c.transform,opacity:c.opacity,transition:c.transitionDuration,focusVisible:el.matches(':focus-visible')}}'''
 for selector in selectors:
  el=page.locator(selector).first;page.mouse.move(1439,1);page.evaluate('document.activeElement?.blur()');page.wait_for_timeout(200);default=el.evaluate(js)
  el.hover();page.wait_for_timeout(200);hover=el.evaluate(js)
  page.mouse.move(1439,1);page.keyboard.press('Tab');el.focus();page.wait_for_timeout(200);focus=el.evaluate(js)
  el.hover();page.mouse.down();page.wait_for_timeout(200);pressed=el.evaluate(js);page.mouse.move(1439,1);page.mouse.up()
  report['checks'].append({'selector':selector,'default':default,'hover':hover,'focus':focus,'pressed':pressed,'hasVisibleFocus':focus['focusVisible'] and ('0px' not in focus['outline'] or focus['shadow']!='none'),'hoverChange':default!=hover,'pressedChange':hover!=pressed})
 disabled=page.locator('button:disabled').first
 report['disabled']={'disabled':disabled.is_disabled(),'computed':disabled.evaluate(js)}
 page.emulate_media(reduced_motion='reduce');report['reducedMotion']=page.locator('[data-copilot="takeoff-save"]').evaluate(js)
 page.emulate_media(forced_colors='active');report['forcedColorsSelected']=page.locator('.qc-canvas-tool[aria-pressed="true"]').first.evaluate(js)
 page.set_content(html('desktop-upload'));page.emulate_media(forced_colors='none',reduced_motion='no-preference')
 report['uploadDialog']={'count':page.locator('dialog').count(),'fitsViewport':page.locator('dialog').evaluate('el => {let r=el.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}'),'fieldCount':page.locator('dialog input,dialog select').count()}
 b.close()
report['allCheckedControlsHaveFocusFeedback']=all(c['hasVisibleFocus'] for c in report['checks'])
(r/'browser-feedback-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='checks'},indent=2));print([(x['selector'],x['hasVisibleFocus'],x['hoverChange'],x['pressedChange']) for x in report['checks']])
