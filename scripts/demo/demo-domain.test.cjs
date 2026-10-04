require('./ts-hook.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { initialDemoGuide, acknowledge, readGuide, isSessionActive } = require('../../app/lib/demo/model.ts');
const { parseGuideCommand, applyGuideCommand } = require('../../app/lib/demo/commands.ts');
const { canEnterChapter, guideProgress, nextGuideStep, guideHref, DEMO_GUIDE_CHAPTERS } = require('../../app/lib/demo/guide.ts');
const { isDemoLocation, isDemoRequest, normalAccountHref } = require('../../app/lib/demo/routing.ts');
const { signDemoToken, verifyDemoToken, parseDemoQuoteToken } = require('../../app/lib/demo/tokens.ts');
const { preparedScanResponse } = require('../../app/lib/demo/prepared-scan.ts');
const { nextCounter, remainingCounter, debitCounter, CounterLimit } = require('../../app/lib/demo/counter.ts');
const { computeTaxLines } = require('../../app/lib/taxes/types.ts');
const { applyPitchAndWaste, computeMaterialCostByStrategy } = require('../../app/lib/pricing/engine.ts');
const sessionId = '11111111-1111-4111-8111-111111111111', quoteId = '22222222-2222-4222-8222-222222222222';
const seed = { guided_roof_job:quoteId, guided_takeoff_plan:sessionId, maintenance_component:sessionId };
const now=Date.UTC(2026,9,3,12), key='offline-test-key-only-not-for-deployment-12345';
function fresh(){return initialDemoGuide(seed);}
function store(){let state=null;return {read:async()=>state?{...state}:null,insert:async v=>{if(state)return false;state={...v};return true;},replace:async(before,after)=>{if(JSON.stringify(state)!==JSON.stringify(before))return false;state={...after};return true;},value:()=>state};}

test('fresh guide has no fabricated acknowledgements',()=>{assert.equal(guideProgress(fresh()).done,0);assert.equal(nextGuideStep(fresh()).event,'component.created');});
test('old increment progress is not trusted',()=>assert.equal(readGuide({version:1,chapter:'complete',complete:true}).chapter,'pricing'));
for(const payload of [{chapter:'complete'},{action:'chapter',chapter:'complete',acknowledgements:{}},{action:'welcome',mode:'guided',guided_created_component_id:quoteId},{action:'event',event:'takeoff.saved'},{action:'explore',usage:0}]){
 test('rejects client state injection '+JSON.stringify(payload),()=>assert.equal(parseGuideCommand(payload),null));
}
test('welcome and exploration are legitimate commands',()=>{assert.deepEqual(parseGuideCommand({action:'welcome',mode:'guided'}),{action:'welcome',mode:'guided'});assert.equal(applyGuideCommand(fresh(),{action:'explore'}).mode,'explore');});
test('takeoff requires a real bound and tested component',()=>{assert.equal(canEnterChapter(fresh(),'takeoff'),false);let s={...fresh(),guided_created_component_id:sessionId};assert.equal(canEnterChapter(s,'takeoff'),false);s=acknowledge(s,'component.tested',sessionId);assert.equal(canEnterChapter(s,'takeoff'),true);});
test('customer chapter requires saved takeoff',()=>{assert.equal(applyGuideCommand(fresh(),{action:'chapter',chapter:'customer-quote'}),null);assert.equal(canEnterChapter(acknowledge(fresh(),'takeoff.saved',quoteId),'customer-quote'),true);});
test('completion requires all server events',()=>{let s=fresh();assert.equal(canEnterChapter(s,'complete'),false);for(const c of DEMO_GUIDE_CHAPTERS)for(const step of c.steps)s=acknowledge(s,step.event,quoteId);assert.equal(guideProgress(s).done,guideProgress(s).total);assert.equal(canEnterChapter(s,'complete'),true);});
test('record ids drive resume URLs, not configurable display names',()=>{let s={...fresh(),guided_created_component_id:quoteId,guided_created_component_name:'Any customer name'};s=acknowledge(s,'component.created',quoteId);assert.match(guideHref('demo-abc',s),new RegExp('demoComponent='+quoteId));assert.match(guideHref('demo-abc',s),/demoTest=1/);});
test('assistant means the real assistant route, not its settings page',()=>assert.equal(guideHref('demo-abc',{...fresh(),chapter:'smart-assistant'}),'/demo-abc/assistant'));
test('expiry boundary is server-time exact',()=>{assert.equal(isSessionActive('active',new Date(now+1).toISOString(),now),true);assert.equal(isSessionActive('active',new Date(now).toISOString(),now),false);assert.equal(isSessionActive('terminating',new Date(now+1000).toISOString(),now),false);assert.equal(isSessionActive('active','invalid',now),false);});
test('cookie namespace selects demo host and demo slug only',()=>{assert.equal(isDemoLocation('demo.quote-core.com','/'),true);assert.equal(isDemoLocation('app.quote-core.com','/real-company/quotes'),false);assert.equal(isDemoLocation('testing.vercel.app','/demo-abc/quotes'),true);});
test('API referrer must have same origin to select demo namespace',()=>{assert.equal(isDemoRequest('testing.vercel.app','/api/smart-assistant/turn','https://testing.vercel.app','https://testing.vercel.app/demo-abc/assistant'),true);assert.equal(isDemoRequest('app.quote-core.com','/api/x','https://app.quote-core.com','https://evil.invalid/demo-abc'),false);});
test('production signup leaves the demo host',()=>assert.equal(normalAccountHref('demo.quote-core.com'), 'https://app.quote-core.com/signup'));
test('valid scoped customer token verifies',()=>{const token=signDemoToken({v:1,purpose:'customer-preview',sessionId,quoteId,expires:now+1000},key);assert.equal(parseDemoQuoteToken(token,key,now).quoteId,quoteId);});
test('tampering, wrong key and expired token are rejected',()=>{const token=signDemoToken({v:1,purpose:'customer-preview',sessionId,quoteId,expires:now+1000},key);assert.equal(verifyDemoToken(token.replace(/^./,'z'),key,now),null);assert.equal(verifyDemoToken(token,key+'x',now),null);assert.equal(verifyDemoToken(token,key,now+1000),null);});
test('wrong-purpose and malformed UUID token cannot open a quote',()=>{assert.equal(parseDemoQuoteToken(signDemoToken({v:1,purpose:'mail-verify',sessionId,quoteId,expires:now+1},key),key,now),null);assert.equal(parseDemoQuoteToken(signDemoToken({v:1,purpose:'customer-preview',sessionId:'bad',quoteId,expires:now+1},key),key,now),null);});
test('weak signing key and oversized input rejected',()=>{assert.throws(()=>signDemoToken({},'weak'));assert.equal(verifyDemoToken('x'.repeat(5000),key,now),null);});
test('concurrent CAS requests cannot overspend one counter',async()=>{const s=store();const outcomes=await Promise.allSettled(Array.from({length:30},()=>debitCounter(s,1,10,now)));assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,10);assert.equal(s.value().used,10);assert.ok(outcomes.filter(x=>x.status==='rejected').every(x=>x.reason instanceof CounterLimit));});
test('same persisted visitor budget is not replenished by workspace reset',async()=>{const s=store();await debitCounter(s,7,10,now);await debitCounter(s,3,10,now+1000);await assert.rejects(debitCounter(s,1,10,now+2000),CounterLimit);});
test('window resets only after 24 hours',()=>{const before=nextCounter(null,10,10,now,86400000);assert.throws(()=>nextCounter(before,1,10,now+86399999,86400000),CounterLimit);assert.equal(nextCounter(before,1,10,now+86400000,86400000).used,1);});
test('corrupt counters and invalid debit amounts fail closed',()=>{assert.throws(()=>nextCounter({used:-1,held:0,expiresAt:new Date(now+1).toISOString()},1,10,now,1000));for(const amount of [0,-1,0.2,NaN,Infinity])assert.throws(()=>nextCounter(null,amount,10,now,1000));});
test('counter store failure never becomes an allowance',async()=>{await assert.rejects(debitCounter({read:async()=>{throw new Error('DB down')},insert:async()=>true,replace:async()=>true},1,10,now));});
test('remaining allowance considers reservations',()=>assert.equal(remainingCounter({used:3,held:4,expiresAt:new Date(now+1).toISOString()},10,now),3));
const dimensions={width:1200,height:900};
test('prepared scan is deterministic and explicitly disclosed',()=>{const a=preparedScanResponse({stage:'scan1',canvasDimensions:dimensions});const b=preparedScanResponse({stage:'scan1',canvasDimensions:dimensions});assert.deepEqual(a,b);assert.ok(a.data.notes.some(n=>n.includes('no AI call')));});
test('final stage keeps visitor-edited coordinates and deleted detections',()=>{const outline=[{x:100,y:100},{x:850,y:100},{x:850,y:600},{x:100,y:600}];const line={id:'L1',start:{x:200,y:220},end:{x:640,y:220}};const response=preparedScanResponse({stage:'scan3',canvasDimensions:dimensions,outlinePoints:outline,lines:[line]});assert.deepEqual(response.data.roof_areas[0].points,outline);assert.equal(response.data.components.hips.length,0);assert.deepEqual(response.data.components.ridges[0].points,[line.start,line.end]);assert.equal(response.data.stats.providerCalls,0);});
test('prepared scan respects canvas dimensions without changing engine coordinates',()=>{const a=preparedScanResponse({stage:'scan1',canvasDimensions:{width:600,height:450}});assert.deepEqual(a.data.roof_areas[0].points[0],{x:90,y:90});});
test('invalid or out-of-bounds scan geometry is rejected',()=>{assert.throws(()=>preparedScanResponse({stage:'scan1',canvasDimensions:{width:Infinity,height:1}}));assert.throws(()=>preparedScanResponse({stage:'scan3',canvasDimensions:dimensions,outlinePoints:[{x:-1,y:1},{x:2,y:2},{x:3,y:3}],lines:[]}));});
test('existing real pricing engine prices the example component',()=>{const q=applyPitchAndWaste(2,false,'none',0,'none',0,0);const cost=computeMaterialCostByStrategy({strategy:'per_unit',totalQuantity:q.afterWaste,materialRate:80,packPrice:null,packSize:null,packCoverageM2:null});assert.equal(cost.cost,160);assert.equal(q.afterWaste*25,50);});
test('existing tax engine retains customer quote totals',()=>{const tax=computeTaxLines([{id:'example',name:'Example tax',rate_percent:20,include_in_quote:true,include_in_labor:true}],1500,'quote');assert.equal(tax.total,300);assert.equal(1500+tax.total,1800);});

test('malformed persisted guide is normalized without granting unknown events',()=>{const s=readGuide({version:2,seed:{guided_roof_job:'invalid'},acknowledgements:{'takeoff.saved':{at:'invalid'},unknown:{at:new Date().toISOString()}},revision:NaN,chapter:'other'});assert.equal(s.revision,0);assert.equal(s.chapter,'pricing');assert.deepEqual(s.seed,{});assert.deepEqual(s.acknowledgements,{});});
