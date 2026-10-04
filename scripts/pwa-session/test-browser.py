"""Chromium + production recovery controller/native event bindings.
Responses/auth accounts and restoration events are explicit fixtures, not real
Next/Supabase, physical iPhone or 180-day persistence evidence.
Requires Python playwright, a local chromium executable, Node and TypeScript.
"""
import asyncio, json, os, subprocess, tempfile, threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/pwa-session-2026-10-04/validation/browser-results.json'
DELIVERY='12345678-1234-4234-9234-123456789abc'

async def main():
    evidence=[]
    with tempfile.TemporaryDirectory() as temp:
        bundle=Path(temp)/'fixture-bundle.js'
        subprocess.run(['node',str(ROOT/'scripts/pwa-session/build-browser-fixture.cjs'),str(bundle)],check=True,cwd=ROOT)
        html=(ROOT/'scripts/pwa-session/browser-fixture.html').read_bytes()
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                body=bundle.read_bytes() if self.path.startswith('/fixture-bundle.js') else html if self.path.startswith('/login') else b'<!doctype html><title>Fixture destination</title><p id="destination">Fixture only: no authentication was performed here.</p>'
                self.send_response(200);self.send_header('Content-Type','application/javascript' if self.path.startswith('/fixture-bundle.js') else 'text/html');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
        origin=f'http://127.0.0.1:{server.server_port}'
        async with async_playwright() as p:
            browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
            async def case(name,run):
                context=await browser.new_context(viewport={'width':390,'height':844})
                page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                try:
                    await run(context,page)
                    assert not errors,errors
                    evidence.append({'case':name,'status':'passed'})
                except Exception as exc:
                    evidence.append({'case':name,'status':'failed','error':repr(exc),'page_errors':errors})
                finally:await context.close()
            async def route_sequence(page,values,delay=0):
                seen=[]
                async def respond(route):
                    seen.append({'url':route.request.url,'headers':await route.request.all_headers()})
                    value=values[min(len(seen)-1,len(values)-1)]
                    if delay:await asyncio.sleep(delay)
                    if value=='abort':await route.abort('failed')
                    else:await route.fulfill(status=200,content_type='application/json',body=json.dumps(value))
                await page.route('**/api/auth/resume?*',respond)
                return seen
            async def state(page,value):await page.wait_for_function('(s)=>document.body.dataset.state===s',arg=value,timeout=5000)
            async def authenticated(context,page):
                await context.add_cookies([{'name':'sb-qcp-auth.0','value':'FIXTURE-NOT-A-TOKEN','url':origin}])
                seen=await route_sequence(page,[{'status':'authenticated','destination':'/acme/assistant'}])
                await page.goto(origin+'/login?redirect=%2Fassistant');await page.wait_for_url('**/acme/assistant?__qcp_resume=1')
                assert len(seen)==1;assert 'FIXTURE-NOT-A-TOKEN' in seen[0]['headers'].get('cookie','')
            async def anonymous(context,page):
                seen=await route_sequence(page,[{'status':'anonymous','reason':'missing'}]);await page.goto(origin+'/login');await state(page,'form')
                assert await page.locator('#email').is_visible();assert len(seen)==1
            async def persisted(context,page):
                seen=await route_sequence(page,[{'status':'anonymous','reason':'missing'},{'status':'authenticated','destination':'/acme/assistant'}])
                await page.goto(origin+'/login');await state(page,'form');await page.evaluate("lifecycle('pageshow')")
                await page.wait_for_url('**/acme/assistant?__qcp_resume=1');assert len(seen)==2
            async def foreground(context,page):
                seen=await route_sequence(page,[{'status':'anonymous','reason':'missing'},{'status':'authenticated','destination':'/acme/assistant'}])
                await page.goto(origin+'/login');await state(page,'form');await page.evaluate("lifecycle('hide')");assert len(seen)==1
                await page.evaluate("lifecycle('show')");await page.wait_for_url('**/acme/assistant?__qcp_resume=1');assert len(seen)==2
            async def typing(context,page):
                seen=await route_sequence(page,[{'status':'anonymous','reason':'missing'}]);await page.goto(origin+'/login');await state(page,'form')
                await page.locator('#email').fill('fixture@example.invalid');await page.evaluate("lifecycle('hide'); lifecycle('show'); lifecycle('pageshow')")
                await page.wait_for_timeout(100);assert len(seen)==1;assert await page.locator('#email').input_value()=='fixture@example.invalid'
            async def logout(context,page):
                seen=await route_sequence(page,[{'status':'authenticated','destination':'/acme/assistant'}]);await page.goto(origin+'/login?signedOut=1');await state(page,'form')
                await page.evaluate("lifecycle('pageshow'); lifecycle('hide'); lifecycle('show')");await page.locator('#retry').click();await page.wait_for_timeout(100);assert not seen
            async def failure(context,page):
                await route_sequence(page,['abort']);await page.goto(origin+'/login');await state(page,'unavailable');assert await page.locator('#email').is_visible()
            async def storage(context,page):
                await page.add_init_script("Storage.prototype.getItem=function(){throw new Error('storage denied')}; Storage.prototype.setItem=function(){throw new Error('storage denied')}")
                seen=await route_sequence(page,[{'status':'authenticated','destination':'/acme/assistant'}]);await page.goto(origin+'/login');await page.wait_for_url('**/acme/assistant?__qcp_resume=1')
                await page.goto(origin+'/login?redirect=%2Facme%2Fassistant%3F__qcp_resume%3D1');await state(page,'loop');assert len(seen)==1
                await page.locator('#retry').click();await page.wait_for_url('**/acme/assistant?__qcp_resume=1');assert len(seen)==2
            async def mfa(context,page):
                await route_sequence(page,[{'status':'mfa_required','destination':'/2fa?redirect=%2Facme%2Fassistant'}]);await page.goto(origin+'/login');await page.wait_for_url('**/2fa?*')
                assert 'redirect=%2Facme%2Fassistant' in page.url
            async def unsafe(context,page):
                await route_sequence(page,[{'status':'authenticated','destination':'//evil.example'}]);await page.goto(origin+'/login');await state(page,'unavailable');assert page.url.startswith(origin+'/login')
            async def disabled(context,page):
                seen=await route_sequence(page,[{'status':'disabled'}]);await page.goto(origin+'/login');await state(page,'form');await page.evaluate("lifecycle('pageshow'); lifecycle('online'); lifecycle('hide'); lifecycle('show')")
                await page.locator('#retry').click();await page.wait_for_timeout(100);assert len(seen)==1
            async def coalesce(context,page):
                seen=await route_sequence(page,[{'status':'anonymous','reason':'missing'}],delay=.2);await page.goto(origin+'/login');await page.evaluate("lifecycle('pageshow'); lifecycle('online'); lifecycle('pageshow')");await state(page,'form');assert len(seen)==1
            async def notification(context,page):
                seen=await route_sequence(page,[{'status':'authenticated','destination':f'/pwa/open?delivery={DELIVERY}'}]);await page.goto(origin+'/login?redirect='+f'%2Fpwa%2Fopen%3Fdelivery%3D{DELIVERY}');await page.wait_for_url('**/pwa/open?*')
                assert DELIVERY in page.url;assert len(seen)==1
            for name,run in [('valid cookie sent; fresh server response navigates',authenticated),('anonymous stays on editable login',anonymous),('persisted pageshow triggers fresh verification',persisted),('foreground checks after hidden document',foreground),('credential entry suppresses restoration redirects',typing),('explicit logout cannot be undone',logout),('network error preserves sign-in fallback',failure),('storage denied: URL guard prevents loop and manual retry works',storage),('MFA challenge retains intended destination',mfa),('unsafe response cannot navigate off-origin',unsafe),('rollback response disables repeated probes',disabled),('simultaneous lifecycle signals coalesce',coalesce),('notification destination survives login verification',notification)]:await case(name,run)
            await browser.close()
        server.shutdown()
    OUT.parent.mkdir(parents=True,exist_ok=True)
    data={'evidence_type':'Chromium with production controller/event bindings; fixture HTTP auth responses and simulated restoration events. NOT real React/Next/Supabase/WebKit/PWA/device testing.','passed':sum(r['status']=='passed' for r in evidence),'failed':sum(r['status']=='failed' for r in evidence),'cases':evidence}
    OUT.write_text(json.dumps(data,indent=2));print(json.dumps(data,indent=2));assert not data['failed']
if __name__=='__main__':asyncio.run(main())
