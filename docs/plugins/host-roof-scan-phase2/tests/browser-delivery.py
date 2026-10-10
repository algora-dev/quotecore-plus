"""Real review script/core + mock hosts. No actual ChatGPT, SDK or vision.
QC_OFFLINE_BROWSER=true uses explicitly labelled local HTTP and digest test adapters
when browser navigation is administratively blocked. Do not count this as HTTPS/CSP QA.
"""
import os,json,hashlib,urllib.request,urllib.error,re
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('QC_TEST_URL','http://127.0.0.1:4768')
OUT=Path(os.environ.get('QC_EVIDENCE','/tmp/qc-phase2-browser'));OUT.mkdir(parents=True,exist_ok=True)
OFFLINE=os.environ.get('QC_OFFLINE_BROWSER')=='true'
records=[]
def log(name):records.append({'name':name,'pass':True});print('PASS',name,flush=True)
def get(path):return json.load(urllib.request.urlopen(BASE+path))
def local_fetch(url,opts):
    if not url.startswith(BASE+'/'):raise ValueError('Only the local test origin is allowed')
    data=opts.get('body')
    if isinstance(data,list):data=bytes(data)
    elif isinstance(data,str):data=data.encode()
    req=urllib.request.Request(url,data=data,headers=opts.get('headers',{}),method=opts.get('method','GET'))
    try:
        with urllib.request.urlopen(req) as r:return {'status':r.status,'body':r.read().decode()}
    except urllib.error.HTTPError as e:return {'status':e.code,'body':e.read().decode()}
SHIM="""async function waitTestBinding(name){for(let i=0;i<100;i++){if(typeof window[name]==='function')return window[name];await new Promise(r=>setTimeout(r,10));}throw Error('Local test binding unavailable: '+name);}window.fetch=async(url,o={})=>{let body=o.body;if(body instanceof Blob)body=Array.from(new Uint8Array(await body.arrayBuffer()));const r=await (await waitTestBinding('__testFetch'))(new URL(url,%s).href,{method:o.method||'GET',headers:o.headers||{},body});return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json'}})};if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{digest:async(alg,bytes)=>{if(alg!=='SHA-256')throw Error('Test digest: unsupported');return Uint8Array.from(await (await waitTestBinding('__testDigest'))(Array.from(new Uint8Array(bytes.buffer||bytes,bytes.byteOffset||0,bytes.byteLength)))).buffer;}}});""" % json.dumps(BASE)
def configure(c):
    if OFFLINE:
        c.expose_function('__testFetch',local_fetch)
        c.expose_function('__testDigest',lambda a:list(hashlib.sha256(bytes(a)).digest()))
def load(page,path,initial=None):
    if not OFFLINE:
        page.goto(initial['structuredContent']['resultUrl'] if initial else BASE+path);return
    html=urllib.request.urlopen(BASE+path).read().decode()
    if path.startswith('/host'):
        html=html.replace('<script>','<script>'+SHIM,1).replace('frame.srcdoc=','const resource=')
        html=html.replace(';</script></body></html>',';frame.srcdoc=resource.replace("<script>","<script>"+'+json.dumps(SHIM)+');</script></body></html>')
    else:
        boot=SHIM
        if initial:boot+='window.openai='+json.dumps({'toolOutput':initial['structuredContent'],'toolResponseMetadata':{'status':'complete','mcp_tool_result':initial}}).replace('<','\\u003c')+';'
        html=html.replace('<script>','<script>'+boot,1)
    page.set_content(html)
def open_host(c,mode='standard',extra=''):
    p=c.new_page();load(p,'/host?mode='+mode+extra);ui=p.frame_locator('#view');
    try:ui.locator('#workspace').wait_for(timeout=10000)
    except Exception:
        print('FAILED HOST STATUS',ui.locator('#status').inner_text(),flush=True);raise
    p.wait_for_timeout(100);f=p.frames[1];return p,ui,f
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    c=b.new_context(viewport={'width':1360,'height':1150},accept_downloads=True);configure(c)
    errors=[];c.on('page',lambda p:p.on('pageerror',lambda e:errors.append(str(e))))
    # Exact canonical download and visible browser fallback.
    p=c.new_page();initial=get('/seed?proposal');load(p,'/mcp/host-scan/review',initial);p.locator('#workspace').wait_for();p.locator('#ask').click()
    assert p.locator('#prompt-box').get_attribute('open') is not None
    assert 'Download' in p.locator('#status').inner_text() or 'download' in p.locator('#status').inner_text()
    with p.expect_download() as d:p.locator('#download-image').click()
    downloaded=Path(d.value.path()).read_bytes();assert hashlib.sha256(downloaded).hexdigest()==initial['structuredContent']['plan']['sha256']
    assert initial['structuredContent']['plan']['imageId'] in d.value.suggested_filename
    assert 'qc_get_roof_outline_image' in p.locator('#prompt').input_value()
    assert 'Open browser review' in p.locator('#browser-review').inner_text()
    log('standalone fallback downloads byte-identical canonical raster with correct filename and request')
    # Core review still works after the image-delivery changes.
    p.locator('#corner-select').select_option('0');p.locator('#point-x').fill('102');p.locator('#point-x').dispatch_event('change');p.locator('#review-check').check();p.locator('#confirm').click();p.locator('#output').wait_for()
    exported=json.loads(p.locator('#export-data').input_value());assert exported['edited'] is True;assert exported['scanData']['roof_areas'][0]['points'][0]['x']==102
    p.screenshot(path=str(OUT/'desktop-review.png'),full_page=True)
    log('correct a corner, explicitly review and export actual service output with no assumed scale')
    # Standard app context image path, including returned synthetic proposal.
    h,ui,f=open_host(c);ui.locator('#ask').click();ui.locator('#geometry circle').first.wait_for(timeout=10000)
    assert h.evaluate('window.contexts[0].content[0].type')=='image';assert h.evaluate('window.messages[0].content[0].type')=='text'
    assert 'Image and request submitted' in ui.locator('#status').inner_text() or 'review' in ui.locator('#status').inner_text().lower()
    assert ui.locator('#geometry circle').count()==6
    log('standard mock host receives image context before text and returns editable synthetic proposal')
    # OpenAI file API receives exact bytes and imageIds, not base64 stuffed into a text prompt.
    h,ui,f=open_host(c,'openai');h.evaluate('window.noProposal=true');ui.locator('#ask').click()
    ui.locator('#status').filter(has_text='Image and request submitted').wait_for(timeout=10000)
    uploads=f.evaluate('window.__test.uploads');states=f.evaluate('window.__test.states');assert len(uploads)==1
    shared=[s for s in states if s.get('imageIds')];assert shared[-1]['imageIds']==['file-mock-1'];assert shared[-1]['modelContent']['sha256']==uploads[0]['sha256']
    ui.locator('#ask').click();ui.locator('#status').filter(has_text='Image and request submitted').wait_for();assert len(f.evaluate('window.__test.uploads'))==1
    log('OpenAI-compatible mock uses uploadFile + imageIds with verified bytes and avoids duplicate upload')
    # Diagnostic copy should not leak signed plan refs or host file IDs.
    ui.locator('#prompt-box summary').click();ui.locator('#copy-diagnostics').click()
    diag=ui.locator('#diagnostics').input_value();assert 'planToken' not in diag;assert 'file-mock' not in diag;assert 'reviewGate' not in diag;assert 'base64' not in diag
    assert json.loads(diag)['hostVisibility']=='not_verified_by_client'
    log('copyable diagnostics contain no private tokens, files or unjustified visibility success')
    # Rejections must not trigger a text-only pseudo scan.
    h,ui,f=open_host(c,'openai');f.evaluate('window.__test.rejectUpload=true');ui.locator('#ask').click();ui.locator('#status').filter(has_text='could not accept').wait_for()
    assert h.evaluate('window.messages.length')==0;assert ui.locator('#prompt-box').get_attribute('open') is not None
    log('rejected host upload gives actionable fallback and sends no misleading text-only scan')
    h,ui,f=open_host(c);h.evaluate('window.rejectContext=true');ui.locator('#ask').click();ui.locator('#status').filter(has_text='could not accept').wait_for();assert h.evaluate('window.messages.length')==0
    log('rejected standard image context does not silently send text or resubmit images')
    h,ui,f=open_host(c);h.evaluate('window.rejectMessage=true');ui.locator('#ask').click();ui.locator('#status').filter(has_text='not confirmed').wait_for();assert ui.locator('#prompt-box').get_attribute('open') is not None
    log('text follow-up rejection is distinguished from successful image sharing')
    # A host update cannot overwrite manual editing.
    h,ui,f=open_host(c,extra='&proposal');ui.locator('#corner-select').select_option('0');ui.locator('#point-x').fill('102');ui.locator('#point-x').dispatch_event('change')
    h.evaluate("document.getElementById('view').contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:initial},'*')")
    ui.locator('#incoming').wait_for();assert ui.locator('#geometry circle').first.get_attribute('cx')=='102';ui.locator('#keep-edits').click();assert not ui.locator('#incoming').is_visible()
    log('incoming host result cannot overwrite user geometry')
    # Corrupt metadata blocks the complete review/share load.
    h=c.new_page();load(h,'/host?mode=openai&corrupt');u=h.frame_locator('#view');u.locator('#status').filter(has_text='does not match').wait_for();assert not u.locator('#workspace').is_visible()
    log('canonical byte-hash mismatch fails closed before sharing')
    # Mobile emulation, actual touch input and no overflow.
    mc=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True);configure(mc)
    mp=mc.new_page();load(mp,'/mcp/host-scan/review',get('/seed?proposal'));mp.locator('#workspace').wait_for();assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mp.locator('#canvas').scroll_into_view_if_needed();q=mp.locator('#canvas').evaluate('(e)=>{const p=new DOMPoint(100,100).matrixTransform(e.getScreenCTM());return {x:p.x,y:p.y}}');session=mc.new_cdp_session(mp)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[q]});session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':q['x']+10,'y':q['y']+3}]});session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert float(mp.locator('#geometry circle').first.get_attribute('cx'))>100
    mp.locator('#ask').tap();assert mp.locator('#prompt-box').get_attribute('open') is not None;mp.screenshot(path=str(OUT/'mobile-fallback.png'),full_page=True)
    log('mobile viewport has no overflow, touch corner editing and visible prepared-file fallback')
    assert not errors,errors
    log('no uncaught browser errors in scenarios')
    b.close()
(OUT/'browser-results.json').write_text(json.dumps({'adapter_mode':OFFLINE,'limitations':['Mock host, synthetic geometry; not real ChatGPT vision','Offline adapters replace browser network and SHA-256 via Python only when enabled; secure-origin/CSP not validated'], 'tests':records},indent=2)+'\n')
