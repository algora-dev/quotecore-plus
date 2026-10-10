"""Local core/UI tests. Not a live ChatGPT, mobile-device or AI accuracy certification."""
import json, os, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
OFFLINE=os.environ.get('QC_OFFLINE_BROWSER')=='true'
BASE=os.environ.get('QC_TEST_URL','http://127.0.0.1:4767')
EVIDENCE=Path(os.environ.get('QC_EVIDENCE','/tmp/qc-host-outline-evidence')); EVIDENCE.mkdir(parents=True,exist_ok=True)
records=[]
def log(name,**details):
    records.append({'check':name,'passed':True,**details});print('PASS',name,flush=True)
def offline_http(url, options):
    # Test-only network adapter because this environment blocks browser navigation.
    if not url.startswith(BASE+'/'):raise ValueError('Local test origin only')
    body=options.get('body')
    if isinstance(body,list):body=bytes(body)
    elif isinstance(body,str):body=body.encode()
    req=urllib.request.Request(url,data=body,headers=options.get('headers',{}),method=options.get('method','GET'))
    try:
        with urllib.request.urlopen(req) as response:return {'status':response.status,'body':response.read().decode()}
    except urllib.error.HTTPError as e:return {'status':e.code,'body':e.read().decode()}
FETCH_SHIM="""window.fetch=async(url,options={})=>{let body=options.body;if(body instanceof Blob)body=Array.from(new Uint8Array(await body.arrayBuffer()));const r=await window.__qcTestHttp(new URL(url,'http://127.0.0.1:4767').href,{method:options.method||'GET',headers:options.headers||{},body});return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json'}})};"""
def load_page(page,initial=None):
    if not OFFLINE:
        page.goto(initial['structuredContent']['resultUrl'] if initial else BASE+'/mcp/host-scan/review');return
    html=urllib.request.urlopen(BASE+'/mcp/host-scan/review').read().decode()
    boot=FETCH_SHIM
    if initial:boot+='window.openai='+json.dumps({'toolOutput':initial['structuredContent'],'toolResponseMetadata':initial['_meta']}).replace('<','\\u003c')+';'
    page.set_content(html.replace('<script>','<script>'+boot,1))
def seed():return json.load(urllib.request.urlopen(BASE+'/seed'))
def point_position(page,x,y):
    return page.locator('#canvas').evaluate('(el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y}}',{'x':x,'y':y})
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':1100},accept_downloads=True)
    if OFFLINE:context.expose_function('__qcTestHttp',offline_http)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    initial=seed();load_page(page,initial);page.locator('#geometry circle').first.wait_for()
    assert page.locator('#geometry circle').count()==6
    assert not page.locator('#confirm').is_enabled()
    if not OFFLINE:assert not page.url.split('#')[-1].startswith('plan=')
    log('desktop: real prepared image and polygon load; confirmation locked; initial state loaded')
    page.locator('#corner-select').select_option('0');page.locator('#point-x').fill('102');page.locator('#point-x').dispatch_event('change')
    assert float(page.locator('#geometry circle').first.get_attribute('cx'))==102
    page.locator('#undo').click();assert float(page.locator('#geometry circle').first.get_attribute('cx'))==100
    page.locator('#redo').click();assert float(page.locator('#geometry circle').first.get_attribute('cx'))==102
    log('desktop: coordinate editing and undo/redo')
    page.locator('#calibration-details summary').click();page.get_by_role('button',name='Pick two reference points').click()
    q=point_position(page,100,100);page.mouse.click(q['x'],q['y']);q=point_position(page,700,100);page.mouse.click(q['x'],q['y'])
    page.locator('#length').fill('30');page.locator('#save-calibration').click()
    assert 'Scale set' in page.locator('#cal-status').inner_text()
    page.locator('#review-check').check();page.locator('#confirm').click();page.locator('#output').wait_for(state='visible')
    assert 'Reviewed plan area' in page.locator('#result-summary').inner_text()
    exported=json.loads(page.locator('#export-data').input_value());assert exported['edited'] is True;assert exported['calibration']['realLength']==30
    if not OFFLINE:
        with page.expect_download() as download:page.locator('#download').click()
        download.value.save_as(str(EVIDENCE/'reviewed-outline-software-fixture.json'))
    else:(EVIDENCE/'reviewed-outline-software-fixture.json').write_text(json.dumps(exported,indent=2))
    page.screenshot(path=str(EVIDENCE/'desktop-review.png'),full_page=True)
    assert not errors,errors
    log('desktop: calibration, explicit review and JSON export; no browser JS errors')
    page.locator('#corner-select').select_option('1');page.locator('#point-x').fill('699');page.locator('#point-x').dispatch_event('change')
    assert not page.locator('#output').is_visible();assert not page.locator('#review-check').is_checked()
    log('desktop: any geometry edit invalidates previous reviewed state')
    # Actual upload UI, not just model-prepared seeds.
    upload=context.new_page();load_page(upload)
    upload.locator('#file').set_input_files({'name':'fixture.png','mimeType':'image/png','buffer':urllib.request.urlopen(BASE+'/fixture.png').read()})
    upload.locator('#workspace').wait_for(state='visible')
    for x,y in [(100,100),(700,100),(700,300),(500,300),(500,500),(100,500)]:
        q=point_position(upload,x,y);upload.mouse.click(q['x'],q['y'])
    upload.get_by_role('button',name='Edit',exact=True).click();assert upload.locator('#geometry circle').count()==6
    upload.locator('#review-check').check();upload.locator('#confirm').click();upload.locator('#output').wait_for(state='visible')
    log('browser: upload, manual trace and review without a model')
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    if OFFLINE:mobile.expose_function('__qcTestHttp',offline_http)
    mp=mobile.new_page();me=[];mp.on('pageerror',lambda e:me.append(str(e)))
    mi=seed();load_page(mp,mi);mp.locator('#geometry circle').first.wait_for()
    assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile horizontal overflow'
    mp.locator('#canvas').scroll_into_view_if_needed();q=point_position(mp,100,100)
    session=mobile.new_cdp_session(mp)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':q['x'],'y':q['y']}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':q['x']+12,'y':q['y']+5}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert float(mp.locator('#geometry circle').first.get_attribute('cx'))>100
    view_before=mp.locator('#canvas').get_attribute('viewBox');mp.locator('#zoom-in').tap();assert mp.locator('#canvas').get_attribute('viewBox')!=view_before
    mp.locator('#fit').tap();mp.locator('#review-check').check();mp.locator('#confirm').tap();mp.locator('#output').wait_for(state='visible')
    mp.screenshot(path=str(EVIDENCE/'mobile-review.png'),full_page=True)
    assert not me,me
    log('mobile viewport: no overflow; real touch drag, zoom, explicit review and export')
    # Opaque-origin sandbox simulates MCP Apps postMessage but NOT real host inference.
    host=context.new_page();he=[];host.on('pageerror',lambda e:he.append(str(e)))
    if OFFLINE:
        host_html=urllib.request.urlopen(BASE+'/test-host').read().decode()
        host_html=host_html.replace('<script>','<script>'+FETCH_SHIM,1)
        host_html=host_html.replace('iframe.srcdoc=', 'iframe.srcdoc=')
        # Add the test-only fetch adapter to the resource before its script executes.
        host_html=host_html.replace('iframe.srcdoc=', 'const resource=')
        host_html=host_html.replace(';</script></body></html>', ';iframe.srcdoc=resource.replace("<script>","<script>"+'+json.dumps(FETCH_SHIM)+');</script></body></html>')
        host.set_content(host_html)
    else:host.goto(BASE+'/test-host')
    ui=host.frame_locator('#view')
    ui.locator('#workspace').wait_for(state='visible')
    assert 'Connected' in ui.locator('#host-label').inner_text()
    host.evaluate('window.rejectMessage=true')
    ui.locator('#ask').click()
    ui.locator('#status').filter(has_text='could not accept').wait_for()
    assert ui.locator('#prompt-box').get_attribute('open') is not None
    host.evaluate('window.rejectMessage=false')
    ui.locator('#ask').click();ui.locator('#geometry circle').first.wait_for()
    assert ui.locator('#geometry circle').count()==6
    assert host.evaluate('window.lastMessage.content[0].type')=='text'
    assert 'qc_prepare_roof_outline' in host.evaluate('window.lastMessage.content[0].text')
    ui.locator('#review-check').check();ui.locator('#confirm').click();ui.locator('#output').wait_for(state='visible')
    ui.locator('#return-context').click();host.wait_for_function('window.reviewContext !== null')
    assert 'reviewToken' in host.evaluate('window.reviewContext.structuredContent')
    assert 'reviewGate' not in host.evaluate('window.reviewContext.structuredContent')
    assert not he,he
    log('mock MCP Apps host: initialize, rejected-message fallback, array-content user message, synthetic tool-result, review context return',note='No live ChatGPT or vision model used; offline transport adapter='+str(OFFLINE))
    browser.close()
(EVIDENCE/'browser-results.json').write_text(json.dumps(records,indent=2)+'\n')
