"""Real Chromium / real widget checks. Loopback fixture harness, not ChatGPT.
Run the server separately, then: python browser-reliability.py
Requires playwright and a Chromium executable; no network installation is performed.
"""
import hashlib, json, os, pathlib, sys, urllib.request
from playwright.sync_api import sync_playwright, expect
origin=os.environ.get('QC_BROWSER_ORIGIN','http://127.0.0.1:4770')
if not origin.startswith('http://127.0.0.1:'): raise ValueError('Loopback harness only')
output=pathlib.Path(os.environ.get('QC_BROWSER_OUT','browser-evidence'));output.mkdir(parents=True,exist_ok=True)
def api(path, payload=None):
    req=urllib.request.Request(origin+path, data=None if payload is None else json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=10) as r: return json.load(r)
results=[]
def ok(name): results.append({'test':name,'status':'pass'});print('PASS '+name,flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('QC_CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1180,'height':1020},accept_downloads=True)
    page.set_default_timeout(7000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    def idle(): expect(page.locator('#app')).to_have_attribute('aria-busy','false')
    def ready(): expect(page.locator('#workspace')).to_be_visible();idle()
    def confirm(): page.locator('#review-check').check();expect(page.locator('#confirm')).to_be_enabled();page.locator('#confirm').click();idle()
    try:
        api('/control',{'offset':0,'nextError':None});seed=api('/seed');link=seed['resultUrl']
        page.goto(origin+'/mcp/host-scan/review');expect(page.locator('#status')).to_contain_text('[MISSING_REVIEW_REFERENCE]');expect(page.locator('#confirm')).to_be_disabled();assert page.evaluate('localStorage.length')==0
        ok('bare review URL rejects stale-state restoration and blocks confirmation')
        page.locator('#recovery-link').fill(link);page.locator('#load-link').click();ready();assert page.url==link
        ok('short-reference recovery loads verified canonical raster and keeps full link')
        initial_points=page.locator('#geometry polygon').get_attribute('points');confirm();expect(page.locator('#output')).to_be_visible();saved_first=page.url;assert '&review=qcr1r_' in saved_first
        ok('explicit confirmation creates a reviewed snapshot and navigable short link')
        page.locator('#edit-measurements').click();page.locator('#pitch').fill('25');expect(page.locator('#output')).to_be_hidden();expect(page.locator('#review-check')).not_to_be_checked();assert page.locator('#geometry polygon').get_attribute('points')==initial_points
        ok('changing reviewer pitch invalidates exported result without retracing')
        page.locator('[data-mode=calibrate]').click();page.locator('#canvas').scroll_into_view_if_needed()
        for x,y in [(100,100),(700,100)]:
            pt=page.locator('#canvas').evaluate('(el,p)=>{const q=new DOMPoint(p[0],p[1]).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y}}',[x,y]);page.mouse.click(pt['x'],pt['y'])
        page.locator('#length').fill('13.7');page.locator('#length').press('Enter');expect(page.locator('#cal-status')).to_contain_text('Scale set using 13.7 m');confirm();expect(page.locator('#output')).to_be_visible();saved_second=page.url
        exported=json.loads(page.locator('#export-data').input_value());assert saved_second!=saved_first
        ok('Enter applies calibration and reconfirmation produces a separate reviewed snapshot')
        page.reload();ready();expect(page.locator('#output')).to_be_visible();expect(page.locator('#pitch')).to_have_value('25');expect(page.locator('#length')).to_have_value('13.7');assert page.locator('#geometry polygon').get_attribute('points')==initial_points
        ok('page reload restores confirmed outline, calibration and reviewer pitch')
        page.locator('#edit-measurements').click();page.locator('#length').fill('14');page.locator('#review-check').check();expect(page.locator('#confirm')).to_be_disabled();page.locator('#save-calibration').click();page.locator('#review-check').check();expect(page.locator('#confirm')).to_be_enabled()
        ok('unapplied calibration edits cannot silently reuse old scale on confirmation')
        page.goto(saved_first);ready();expect(page.locator('#output')).to_be_visible();expect(page.locator('#pitch')).to_have_value('');expect(page.locator('#length')).to_have_value('')
        ok('older reviewed links remain immutable snapshots')
        page.goto(origin+'/mcp/host-scan/review#plan=qcr1p_invalid');expect(page.locator('#status')).to_contain_text('[INVALID_REFERENCE]');expect(page.locator('#recovery')).to_be_visible();expect(page.locator('#confirm')).to_be_disabled()
        ok('invalid reference reports visible error and provides safe recovery')
        api('/control',{'nextError':{'action':'open','status':403,'html':True}});page.locator('#recovery-link').fill(link);page.locator('#load-link').click();expect(page.locator('#status')).to_contain_text('[HTTP_403_NON_JSON]')
        ok('deployment-protection HTML error is distinguished from token failure')
        page.locator('#load-link').click();ready();api('/control',{'nextError':{'action':'export','status':503,'code':'REFERENCE_STORAGE_UNAVAILABLE'}});confirm();expect(page.locator('#status')).to_contain_text('[REFERENCE_STORAGE_UNAVAILABLE]');count=api('/counts')['confirm'];page.locator('#refresh-export').click();idle();expect(page.locator('#output')).to_be_visible();assert api('/counts')['confirm']==count
        ok('export retry reads the existing review without duplicating confirmation')
        page.goto(origin+'/mcp/host-scan/review');api('/control',{'nextError':{'action':'upload','status':403,'code':'ORIGIN_NOT_ALLOWED'}})
        with urllib.request.urlopen(origin+'/fixture.png') as r: fixture=r.read()
        page.locator('#file').set_input_files({'name':'fixture.png','mimeType':'image/png','buffer':fixture});expect(page.locator('#status')).to_contain_text('[ORIGIN_NOT_ALLOWED]')
        ok('image-upload origin error is surfaced with its actual code')
        page.goto(link);ready();assert 'show its resultUrl exactly as returned' in page.locator('#prompt').input_value()
        with page.expect_download() as download: page.locator('#download-image').click()
        downloaded=pathlib.Path(download.value.path()).read_bytes();assert hashlib.sha256(downloaded).hexdigest()==seed['plan']['sha256']
        ok('prepared download matches canonical SHA and copied request uses direct review URL')
        page.screenshot(path=str(output/'review-workspace.png'),full_page=True)
        api('/control',{'offset':31*60*1000});page.reload();expect(page.locator('#status')).to_contain_text('[EXPIRED]');expect(page.locator('#confirm')).to_be_disabled()
        ok('expired sessions fail closed without stale confirmation')
        assert not errors,errors;ok('no uncaught browser JavaScript exceptions')
    except Exception as e:
        results.append({'test':'browser scenario','status':'fail','error':str(e)});page.screenshot(path=str(output/'failure.png'),full_page=True);raise
    finally:
        (output/'results.json').write_text(json.dumps({'scope':'Chromium + real widget/service loopback fixture; adapter status is recorded separately','checks':results,'browserErrors':errors},indent=2));api('/control',{'offset':0,'nextError':None});browser.close()
