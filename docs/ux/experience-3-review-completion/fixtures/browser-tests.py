from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json,traceback
V=Path(__file__).resolve().parent;B=V/'browser';S=V/'screens';S.mkdir(exist_ok=True)
base=B.joinpath('index.html').read_text();base=re.sub(r'<script[^>]*>.*?</script>','',base,flags=re.S);base=re.sub(r'<link[^>]+>','',base)
css=[(B/n).read_text() for n in ['tailwind.css','source.css']];js=[(B/n).read_text() for n in ['runtime.js','source.js','entry.js']]
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def load(query='',width=1440,height=1000,**context):
  p=browser.new_page(viewport={'width':width,'height':height},**context);p.set_default_timeout(4000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p._errors=errors
  p.set_content(base)
  for c in css:p.add_style_tag(content=c)
  p.evaluate('(q)=>{window.fixtureParams=q;window.process={env:{NODE_ENV:"production"}}}',query)
  for s in js:p.add_script_tag(content=s)
  p.wait_for_timeout(60)
  return p
 def check(name,f):
  try:f();results.append({'name':name,'pass':True})
  except Exception as e:results.append({'name':name,'pass':False,'error':str(e),'trace':traceback.format_exc()});print('FAIL',name,str(e)[:350],flush=True)
  (V/'browser-progress.json').write_text(json.dumps(results,indent=2))
  print(len(results),name,results[-1]['pass'],flush=True)
 def eq(a,b):assert a==b,(a,b)
 def calls(p):return p.evaluate('fx.calls')
 def types(p):return [x['type'] for x in calls(p)]
 def cfg(p,**v):p.evaluate('(v)=>Object.assign(fx.config,v)',v)
 def primary(p):return p.locator('[data-copilot="quote-confirm"]')
 def secondary(p):return p.locator('[data-copilot="quote-save-job-space"]')
 def done(p):p.wait_for_function('fx.navigations.length>0')
 def initial():
  p=load();eq(types(p),[]);eq(primary(p).inner_text().strip(),'Continue to customer quote');eq(secondary(p).inner_text(),'Save & go to Job Space');eq(p._errors,[]);p.close()
 check('Two end actions; no request or send on mount',initial)
 def edited():
  p=load();p.get_by_label('Item Cost Margin percentage').fill('25');p.get_by_label('Labour Margin percentage').fill('12');primary(p).click();done(p);eq(types(p),['margins','confirm','navigate']);eq(calls(p)[0]['settings'],{'materialMarginPercent':25,'laborMarginPercent':12,'materialMarginEnabled':True,'laborMarginEnabled':True});eq(calls(p)[2]['path'],'/demo/quotes/quote-fixture/customer-edit');p.close()
 check('Primary uses current unsaved margins, then confirms, then existing customer route',edited)
 def job():
  p=load('mode=digital');secondary(p).click();done(p);eq(types(p),['margins','confirm','navigate']);eq(calls(p)[2]['path'],'/demo/quotes/quote-fixture/summary');p.close()
 check('Digital Review secondary uses identical preparation and Job Space route',job)
 for status in ['confirmed','sent','accepted','declined','withdrawn','archived']:
  def non_draft(status=status):
   p=load('status='+status);primary(p).click();done(p);eq(types(p),['margins','navigate']);p.close()
  check('Original non-draft lifecycle preserved: '+status,non_draft)
 def double():
  p=load();cfg(p,hold='margins');p.evaluate('''()=>{document.querySelector('[data-copilot="quote-confirm"]').click();document.querySelector('[data-copilot="quote-save-job-space"]').click();document.querySelector('[data-copilot="quote-confirm"]').click();}''');p.wait_for_timeout(30);eq(types(p),['margins']);assert primary(p).is_disabled() and secondary(p).is_disabled();p.evaluate('fx.gates.margins()');done(p);eq(types(p),['margins','confirm','navigate']);p.close()
 check('Synchronous single flight blocks repeated/mixed destination clicks',double)
 def lock():
  p=load();cfg(p,hold='margins');primary(p).click();eq(types(p),['margins']);assert p.get_by_label('Item Cost Margin percentage').is_disabled();assert p.get_by_role('button',name='← Back to Extras').is_disabled();eq(p.locator('.qc-stepper button:disabled').count(),4);eq(p.locator('fieldset[disabled]').count(),1);eq(p.evaluate('fx.phase'),'review');p.evaluate('fx.gates.margins()');done(p);p.close()
 check('Review settings and step/back controls lock for the same submitted snapshot',lock)
 def sequence():
  p=load();cfg(p,hold='confirm');primary(p).click();p.wait_for_function('!!fx.gates.confirm');eq(types(p),['margins','confirm']);assert primary(p).is_disabled();p.evaluate('fx.gates.confirm()');done(p);p.close()
 check('No navigation until the existing confirmation action resolves',sequence)
 def margin_continue():
  p=load('marginFail=true');primary(p).click();p.get_by_role('heading',name='Your margin changes were not saved').wait_for();eq(types(p),['margins','confirm']);assert p.get_by_label('Item Cost Margin percentage').is_disabled();p.wait_for_timeout(40);eq(p.evaluate('document.activeElement.className'),'qrc-result');p.get_by_role('button',name='Continue with saved margins',exact=True).click();done(p);eq(types(p),['margins','confirm','navigate']);p.close()
 check('Margin failure is explicit, nonfatal, focused, and requires acknowledgement',margin_continue)
 def margin_review():
  p=load('marginFail=true');primary(p).click();p.get_by_role('button',name='Review margins',exact=True).click();p.wait_for_timeout(45);eq(p.evaluate('document.activeElement.getAttribute("aria-label")'),'Profit margins');assert p.get_by_label('Item Cost Margin percentage').is_enabled();cfg(p,marginFail=False);p.get_by_label('Item Cost Margin percentage').fill('22');primary(p).click();done(p);eq(types(p),['margins','confirm','margins','navigate']);eq(calls(p)[2]['settings']['materialMarginPercent'],22);p.close()
 check('Review margins restores focus/draft and retries save without repeating successful confirmation',margin_review)
 for which,value,msg in [('Item Cost','-1','Item Cost'),('Labour','101','Labour'),('Item Cost','','Item Cost')]:
  def invalid(which=which,value=value,msg=msg):
   p=load();p.get_by_label(which+' Margin percentage').fill(value);primary(p).click();p.get_by_role('heading',name='Your margin changes were not saved').wait_for();eq(types(p),['confirm']);assert msg+' margin must be between 0 and 100%' in p.locator('.qrc-result').inner_text();p.close()
  check('Preserved validation with explicit result: '+which+'='+value,invalid)
 def disabled_margins():
  p=load();p.locator('[data-copilot="quote-margins"] input[type=checkbox]').first.uncheck();primary(p).click();done(p);eq(calls(p)[0]['settings']['materialMarginPercent'],None);eq(calls(p)[0]['settings']['materialMarginEnabled'],False);p.close()
 check('Disabled margin submits the original null/enabled payload semantics',disabled_margins)
 def confirm_fail():
  p=load('confirmFail=true');primary(p).click();p.get_by_role('heading',name='We could not confirm the quote').wait_for();eq(types(p),['margins','confirm']);assert 'Your margin settings were saved' in p.locator('.qrc-result').inner_text();cfg(p,confirmFail=False);p.get_by_role('button',name='Try again',exact=True).click();done(p);eq(types(p),['margins','confirm','margins','confirm','navigate']);p.close()
 check('Confirmation failure does not navigate; deliberate retry follows original idempotent action',confirm_fail)
 def both_fail():
  p=load('confirmFail=true&marginFail=true');secondary(p).click();p.get_by_role('heading',name='We could not confirm the quote').wait_for();eq(types(p),['margins','confirm']);assert 'Your margin settings were saved' not in p.locator('.qrc-result').inner_text();p.get_by_role('button',name='Review pricing').click();assert secondary(p).is_visible();p.close()
 check('Combined failures do not claim a margin save or a confirmed quote',both_fail)
 for stage in ['margins','confirm']:
  def leave(stage=stage):
   p=load();cfg(p,hold=stage);primary(p).click();p.wait_for_function('s=>!!fx.gates[s]',arg=stage);p.evaluate('fx.unmount()');p.evaluate('s=>fx.gates[s]()',stage);p.wait_for_timeout(90);eq(types(p),['margins'] if stage=='margins' else ['margins','confirm']);p.close()
  check('Leaving during '+stage+' cancels client continuation, not completed server work',leave)
 def nav_fail():
  p=load();cfg(p,navFail=True);primary(p).click();p.get_by_role('heading',name='Your quote is ready, but the next page could not open').wait_for();eq(types(p),['margins','confirm','navigate']);assert p.get_by_label('Item Cost Margin percentage').is_disabled();eq(p.get_by_role('link',name='Go to Job Space',exact=True).get_attribute('href'),'/demo/quotes/quote-fixture/summary');cfg(p,navFail=False);p.get_by_role('button',name='Try opening again').click();done(p);eq(types(p),['margins','confirm','navigate','navigate']);p.close()
 check('Known navigation rejection retries opening only; no repeated save/confirm',nav_fail)
 def restore_nav():
  p=load();cfg(p,navFail=True);primary(p).click();p.get_by_role('button',name='Review pricing').click();p.wait_for_timeout(35);assert p.get_by_label('Item Cost Margin percentage').is_enabled();eq(p.evaluate('document.activeElement.getAttribute("aria-label")'),'Profit margins');p.close()
 check('Navigation recovery can explicitly unlock review for more edits',restore_nav)
 def job_warning():
  p=load('marginFail=true');secondary(p).click();p.get_by_role('button',name='Go to Job Space with saved margins').click();done(p);eq(calls(p)[-1]['path'],'/demo/quotes/quote-fixture/summary');p.close()
 check('Margin warning preserves the originally selected Job Space destination',job_warning)
 for key in ['Enter','Space']:
  def keyboard(key=key):
   p=load();primary(p).focus();primary(p).press(key);done(p);eq(types(p),['margins','confirm','navigate']);p.close()
  check('Keyboard activates primary with '+key,keyboard)
 def empty():
  p=load('empty=true&trade=generic');primary(p).click();done(p);eq(types(p),['margins','confirm','navigate']);p.close()
 check('Existing empty/no-area policy unchanged; no new blocking guard',empty)
 def route_error():
  p=load('view=error');assert p.get_by_role('heading',name='The customer quote could not be opened').is_visible();eq(types(p),[]);assert 'Your pricing was saved' not in p.locator('body').inner_text();p.get_by_role('button',name='Try again',exact=True).click();eq(types(p),['retry']);eq(p.get_by_role('link',name='Go to Job Space').get_attribute('href'),'/demo/quotes/quote-fixture/summary');p.close()
 check('Route error handles direct visits without fabricated save proof or document recreation',route_error)
 def fallback():
  p=load('view=error-fallback');eq(types(p),[]);a=p.get_by_role('link',name='Try again',exact=True);eq(a.get_attribute('href'),'/demo/quotes/quote-fixture/customer-edit');assert a.is_visible();p.close()
 check('Older-runtime route retry offers same-route reload, not a cached reset',fallback)

 def loading():
  p=load('view=loading');assert p.get_by_role('status').is_visible();eq(types(p),[]);assert p.get_by_role('link',name='Go to Job Space').is_visible();p.close()
 check('Loading state provides status/escape without initiating a mutation',loading)
 def hover():
  p=load();btn=primary(p);btn.scroll_into_view_if_needed();normal=btn.evaluate('(e)=>getComputedStyle(e).backgroundImage');btn.hover();p.wait_for_timeout(160);hov=btn.evaluate('(e)=>getComputedStyle(e).backgroundImage');assert normal!=hov;(p.mouse.down());pressed=btn.evaluate('(e)=>getComputedStyle(e).backgroundImage');p.mouse.move(0,0);p.mouse.up();assert pressed!=hov;p.keyboard.press('Tab');btn.focus();assert btn.evaluate('(e)=>getComputedStyle(e).outlineStyle')!='none';p.close()
 check('Primary hover/pressed/focus states remain visibly distinct',hover)
 def reduced():
  p=load(reduced_motion='reduce');eq(primary(p).evaluate('(e)=>getComputedStyle(e).transitionDuration'),'0s');p.close()
 check('Reduced motion inherits the shared no-transition rule',reduced)
 def forced():
  p=load(forced_colors='active');primary(p).focus();assert primary(p).evaluate('(e)=>getComputedStyle(e).outlineStyle')!='none';assert primary(p).evaluate('(e)=>getComputedStyle(e).borderTopStyle')!='none';p.close()
 check('Forced-colour buttons retain boundaries/focus',forced)
 # Actual source layout states, including intentional table-local horizontal scroll.
 for width in [1440,1024,768,390,360,320]:
  for state in ['review','margin-warning','confirmation-error','route-error','loading']:
   def layout(width=width,state=state):
    query={'review':'','margin-warning':'marginFail=true','confirmation-error':'confirmFail=true','route-error':'view=error','loading':'view=loading'}[state]
    p=load(query,width,900)
    if state=='margin-warning':primary(p).click();p.get_by_role('heading',name='Your margin changes were not saved').wait_for()
    if state=='confirmation-error':primary(p).click();p.get_by_role('heading',name='We could not confirm the quote').wait_for()
    assert not p._errors,p._errors
    dims=p.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})');assert dims['scroll']<=dims['w']+1,dims
    buttons=p.locator('.qrc-completion button, .qrc-route-state button, .qrc-route-state a')
    for i in range(buttons.count()):
     d=buttons.nth(i).bounding_box();assert d['width']<=width and d['height']>=(44 if width<768 else 40),(state,width,d)
    if width in [1440,390,320]:p.screenshot(path=str(S/f'{state}-{width}.png'),full_page=True)
    p.close()
   check(f'Layout {state} at {width}px: no page overflow; actions meet the shared desktop/mobile target rules',layout)
 browser.close()
report={'method':'Actual QuoteBuilder Review, completion/route-state components and pure calculation/display helpers in Chromium; sample records, action/router/other-step mocks. Browser policy blocks navigation, so supplied local HTML/CSS/JS rendered with set_content. No live Next/RSC/backend/device tests. Runtime reused from prior baseline fixture.', 'checks':results,'passed':sum(r['pass'] for r in results),'failed':sum(not r['pass'] for r in results)}
(V/'browser-report.json').write_text(json.dumps(report,indent=2));print('BROWSER',report['passed'],'passed',report['failed'],'failed');
if report['failed']:raise SystemExit(1)
