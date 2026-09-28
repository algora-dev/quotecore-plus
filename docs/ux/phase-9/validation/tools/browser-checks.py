"""Chromium layout/native-HTML-dialog checks, not a React/Fabric/app E2E suite."""
from pathlib import Path
import os,json,re,base64,mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ['QC_ROOT']); OUT=Path(os.environ['QC_FIXTURES'])
CSS=(OUT/'fixture.css').read_text()
def load_page(page, name):
    html=(OUT/(name+'.html')).read_text().replace('<link rel="stylesheet" href="fixture.css">','<style>'+CSS+'</style>')
    def asset(match):
        file=ROOT/'public'/match[1].lstrip('/')
        return 'src="data:'+str(mimetypes.guess_type(file.name)[0] or 'image/png')+';base64,'+base64.b64encode(file.read_bytes()).decode()+'"'
    html=re.sub(r'src="(/angle-calculator/[^"]+)"',asset,html)
    page.set_content(html,wait_until='load')
results=[]; errors=[]; (OUT/'screens').mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for width,height in [(320,640),(390,844),(768,900),(1280,800),(1440,1000)]:
        ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,has_touch=width<768,is_mobile=width<768)
        page=ctx.new_page();page.route('**/*',lambda route:route.abort())
        for file in sorted(OUT.glob('*.html')):
            load_page(page,file.stem);page.wait_for_timeout(35)
            record=page.evaluate('''() => {
                const vw=innerWidth,vh=innerHeight;
                const dialogs=[...document.querySelectorAll('dialog[open],.qc-angle-widget')].map(d=>{const r=d.getBoundingClientRect();return {name:d.getAttribute('aria-label')||d.getAttribute('aria-labelledby'),left:r.left,right:r.right,top:r.top,bottom:r.bottom,fits:r.left>=-1&&r.right<=vw+1&&r.top>=-1&&r.bottom<=vh+1}});
                const offscreen=[...document.querySelectorAll('button,input,select,a')].filter(n=>{const r=n.getBoundingClientRect();if(r.width===0||r.height===0||getComputedStyle(n).visibility==='hidden')return false;if(n.closest('dialog')&&!n.closest('dialog').open)return false;if(n.closest('.qc-drawing-scrollport'))return false;return r.left < -1 || r.right > vw+1;}).slice(0,12).map(n=>({text:n.innerText||n.getAttribute('aria-label'),width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right}));
                return {viewport:vw,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,dialogs,offscreen};
            }''')
            ok=record['documentWidth']<=width+1 and not record['offscreen'] and all(d['fits'] for d in record['dialogs'])
            item={'screen':file.stem,'width':width,'height':height,'pass':ok,**record};results.append(item)
            if not ok: print('FAIL',file.stem,width,json.dumps(record),flush=True)
            if width in (390,1440) and file.stem in ['drawings-library','drawing-upload-error','drawing-workspace','angle-floating-error','tutorial-dialog-long','inbox-partial-update','drawing-image-preview','template-logo-error','angle-dialog','angle-floating-result'] or width==320 and file.stem=='tutorial-dialog-long':
                page.screenshot(path=str(OUT/'screens'/f'{file.stem}-{width}.png'),full_page=False)
        ctx.close()
    # Native HTML focus containment against real top-layer dialogs in specimens.
    page=browser.new_page(viewport={'width':390,'height':600})
    for name in ['tutorial-dialog-long','drawing-delete-error','drawing-loading']:
        load_page(page,name);page.wait_for_timeout(30)
        trail=[]
        for _ in range(10):
            page.keyboard.press('Tab')
            trail.append(page.evaluate('''() => {
                const a=document.activeElement;
                return {tag:a?.tagName,label:a?.getAttribute('aria-label')||a?.textContent?.slice(0,45),inDialog:a?.closest('dialog')?.open===true,chromeCycle:a===document.body||a===document.documentElement};
            }'''))
        results.append({'screen':name,'check':'native HTML dialog blocks background control focus (browser chrome cycle allowed)','pass':all(t['inDialog'] or t['chromeCycle'] for t in trail),'focusTrail':trail})
    # Footer remains visible as long tutorial content is scrolled, including a short viewport.
    for height in [844,480]:
        page.set_viewport_size({'width':320,'height':height});load_page(page,'tutorial-dialog-long')
        page.eval_on_selector('.qc-dialog-body','e=>e.scrollTop=e.scrollHeight')
        r=page.eval_on_selector('.qc-dialog-footer','e=>{let r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}}')
        results.append({'screen':'tutorial-dialog-long','check':'scroll body/reachable footer','viewportHeight':height,'pass':r['top']>=0 and r['bottom']<=height+1,**r})
    browser.close()

report={'method':'Real Chromium on source-derived JSX/CSS static fixtures. Hook effects/actions/Fabric/Next hydration not executed. Native HTML focus containment only, not React focus restoration. Canvas overflow intentionally contained and exempt from page-wide overflow checks.','checks':results,'passed':sum(r['pass'] for r in results),'failed':sum(not r['pass'] for r in results)}
(OUT/'browser-report.json').write_text(json.dumps(report,indent=2));print('RESULT',report['passed'],'passed',report['failed'],'failed')
raise SystemExit(1 if report['failed'] else 0)
