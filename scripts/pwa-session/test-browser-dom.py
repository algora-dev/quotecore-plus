"""Real Chromium native event/controller checks with NO networking.
Auth response, clock, visibility/storage and navigation are injected fixtures.
This does not test Next, React, cookies, actual BFCache/PWA/WebKit or live auth.
"""
import asyncio, json, os, subprocess, tempfile
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
SETUP=r'''
window.fixture={...window.fixture};window.clock=100000;window.isHidden=false;window.states=[];window.destinations=[];window.calls=[];window.pending=[];
Object.defineProperty(document,'hidden',{get:()=>window.isHidden,configurable:true});
let search=new URLSearchParams(fixture.search||'');const store=new Map();const form=document.getElementById('form');
window.control=QcpRecovery.createLoginRecovery({search:()=>search,hash:()=>fixture.hash||'',visible:()=>!document.hidden,online:()=>fixture.online!==false,now:()=>window.clock,
 readStorage:k=>{if(fixture.storageBlocked)throw Error('blocked');return store.get(k)||null;},writeStorage:(k,v)=>{if(fixture.storageBlocked)throw Error('blocked');store.set(k,v);},
 probe:async(d,s,t)=>{calls.push([d,t]);if(fixture.hold)return new Promise(r=>pending.push(r));return fixture.result;},
 navigate:d=>destinations.push(d),state:s=>{states.push(s);document.body.dataset.state=s;form.hidden=s==='checking'||s==='navigating';document.getElementById('status').textContent=s;},
});
window.detach=QcpRecovery.attachLoginRecoveryEvents(control,window,document);
form.addEventListener('focusin',()=>control.enteringCredentials());form.addEventListener('pointerdown',()=>control.enteringCredentials());
document.getElementById('retry').onclick=()=>control.start('manual');
window.lifecycle=(kind)=>{window.clock+=3000;if(kind==='pageshow')window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));if(kind==='online')window.dispatchEvent(new Event('online'));if(kind==='hide'||kind==='show'){window.isHidden=kind==='hide';document.dispatchEvent(new Event('visibilitychange'));}};
void control.start();
'''
async def main():
 out=[]
 with tempfile.TemporaryDirectory() as temp:
  bundle=Path(temp)/'bundle.js';subprocess.run(['node',str(ROOT/'scripts/pwa-session/build-browser-fixture.cjs'),str(bundle)],cwd=ROOT,check=True)
  script=bundle.read_text()
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN','/usr/bin/chromium'),args=['--no-sandbox'],headless=True)
   async def fixture(config):
    page=await browser.new_page(viewport={'width':390,'height':844});await page.set_content('<!doctype html><title>Controller fixture only</title><div id="status"></div><form id="form"><label>Email<input id="email"></label></form><button id="retry">Check</button>');await page.add_script_tag(content=script);await page.evaluate('(x)=>window.fixture=x',config);await page.add_script_tag(content=SETUP);return page
   async def check(name,config,fn):
    page=await fixture(config)
    try:await fn(page);out.append({'case':name,'status':'passed'})
    except Exception as exc:out.append({'case':name,'status':'failed','error':repr(exc)})
    finally:await page.close()
   async def state(page,s):await page.wait_for_function('s=>document.body.dataset.state===s',arg=s)
   async def valid(page):await state(page,'navigating');assert await page.evaluate('destinations')==['/acme/assistant?__qcp_resume=1']
   async def anonymous(page):await state(page,'form');assert await page.locator('#email').is_visible();assert await page.evaluate('calls.length')==1
   async def restore(page):
    await state(page,'form');await page.evaluate("fixture.result={status:'authenticated',destination:'/acme/assistant'};lifecycle('pageshow')");await valid(page);assert await page.evaluate('calls.length')==2
   async def foreground(page):
    await state(page,'form');await page.evaluate("lifecycle('hide');fixture.result={status:'authenticated',destination:'/acme/assistant'};lifecycle('show')");await valid(page)
   async def credentials(page):
    await state(page,'form');await page.locator('#email').fill('fixture@example.invalid');await page.evaluate("fixture.result={status:'authenticated',destination:'/acme/assistant'};lifecycle('hide');lifecycle('show');lifecycle('pageshow')");assert await page.evaluate('calls.length')==1;assert await page.evaluate('destinations.length')==0
   async def signout(page):await state(page,'form');await page.evaluate("lifecycle('pageshow');lifecycle('online')");await page.locator('#retry').click();assert await page.evaluate('calls.length')==0
   async def unavailable(page):await state(page,'unavailable');assert await page.locator('#email').is_visible();assert await page.evaluate('destinations.length')==0
   async def one_request(page):
    await state(page,'checking');await page.evaluate("lifecycle('pageshow');lifecycle('online');lifecycle('pageshow')");assert await page.evaluate('calls.length')==1;await page.evaluate("pending[0]({status:'anonymous',reason:'missing'})");await state(page,'form')
   async def quick_reopen(page):
    await state(page,'checking');await page.evaluate("isHidden=true;document.dispatchEvent(new Event('visibilitychange'));isHidden=false;document.dispatchEvent(new Event('visibilitychange'))");assert await page.evaluate('calls.length')==2
    await page.evaluate("pending[0]({status:'authenticated',destination:'/wrong/assistant'});pending[1]({status:'anonymous',reason:'missing'})");await state(page,'form');assert await page.evaluate('destinations.length')==0
   async def loop(page):
    await state(page,'loop');assert await page.evaluate('calls.length')==0;await page.locator('#retry').click();await valid(page)
   async def mfa(page):await state(page,'navigating');assert (await page.evaluate('destinations[0]')).startswith('/2fa?redirect=%2Facme%2Fassistant')
   async def rollback(page):await state(page,'form');await page.evaluate("lifecycle('hide');lifecycle('show');lifecycle('pageshow')");await page.locator('#retry').click();assert await page.evaluate('calls.length')==1
   good={'status':'authenticated','destination':'/acme/assistant'};anon={'status':'anonymous','reason':'missing'}
   for name,config,fn in [
    ('validated response yields navigation intent',{'result':good},valid),('anonymous response leaves credentials editable',{'result':anon},anonymous),
    ('native pageshow listener reruns verification on restored fixture',{'result':anon},restore),('native visibility listener resumes suspended check',{'result':anon},foreground),
    ('actual input focus prevents foreground interference',{'result':anon},credentials),('signed-out query prevents all automatic/manual recovery',{'result':good,'search':'signedOut=1'},signout),
    ('provider failure leaves visible fallback',{'result':{'status':'unavailable'}},unavailable),('competing lifecycle events share one in-flight request',{'hold':True},one_request),
    ('immediate suspend/resume cannot strand checking screen',{'hold':True},quick_reopen),('blocked storage plus URL marker prevents loops; explicit retry works',{'storageBlocked':True,'result':good,'search':'redirect=%2Facme%2Fassistant%3F__qcp_resume%3D1'},loop),
    ('MFA result yields challenge not workspace',{'result':{'status':'mfa_required','destination':'/2fa?redirect=%2Facme%2Fassistant'}},mfa),
    ('disabled API stops future probes',{'result':{'status':'disabled'}},rollback),
    ('malicious navigation response stays on fallback',{'result':{'status':'authenticated','destination':'//evil.example'}},unavailable)]:await check(name,config,fn)
   await browser.close()
 result={'evidence':'Chromium production controller + native listeners and minimal DOM fixture. Auth, navigation, storage and restoration are injected; NOT React/Next/Supabase/cookie/device/PWA validation.','passed':sum(x['status']=='passed'for x in out),'failed':sum(x['status']=='failed'for x in out),'cases':out}
 path=ROOT/'docs/pwa-session-2026-10-04/validation/browser-dom-results.json';path.write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));assert result['failed']==0
if __name__=='__main__':asyncio.run(main())
