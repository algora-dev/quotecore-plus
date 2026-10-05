/* Run from repo root after the integrator's normal install:
   node docs/ux/phase-3/check-pure-functions.cjs
   Uses the existing TypeScript dev dependency. Does not connect to services. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function load(relative) {
  const file = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require, Intl, Date, Set, console }, { filename: file });
  return module.exports;
}
const model = load('app/(auth)/[workspaceSlug]/job-spaces/job-space-list-model.ts');
const shell = load('app/components/workspace/shell-config.ts');
const state = load('app/components/workspace/sidebar-state.ts');
const results = [];
function test(name, run) { run(); results.push({ name, status: 'PASS' }); }
const row = (id, values = {}) => ({ id, status:'confirmed', job_name:`Job ${id}`, customer_name:`Customer ${id}`,
  quote_number:id, created_at:'2026-09-01T00:00:00Z', updated_at:'2026-09-21T09:00:00Z',
  job_status:'unsent', viewed_at:null, has_pending_revision:false, ...values });
const rows = [
  row('1', { status:'draft', job_status:'accepted' }),
  row('2', { job_name:'Smith Street', job_status:'accepted', quote_number:1014, updated_at:'2026-09-22T10:00:00Z' }),
  row('3', { job_name:'Ridge Road', job_status:'sent', quote_number:'Q-1015', customer_name:'ALEX TAYLOR' }),
  row('4', { status:'new_future_status', job_status:'awaiting_delivery', updated_at:'2026-09-23T00:00:00Z' }),
];
const ids = list => JSON.stringify(list.map(x => x.id));
test('Exclude records by status=draft, not by job_status', () => assert.equal(ids(model.nonDraftJobs(rows)), '["2","3","4"]'));
test('Preserve future non-draft statuses', () => assert.ok(model.nonDraftJobs(rows).some(x=>x.id==='4')));
test('Default updated order', () => assert.equal(ids(model.selectJobSpaces(rows,'','all','updated')), '["4","2","3"]'));
test('Oldest updated order', () => assert.equal(ids(model.selectJobSpaces(rows,'','all','oldest')), '["3","2","4"]'));
test('Job-name order', () => assert.equal(ids(model.selectJobSpaces(rows,'','all','name')), '["4","3","2"]'));
test('Case-insensitive job search', () => assert.equal(ids(model.selectJobSpaces(rows,' SMITH ','all','updated')), '["2"]'));
test('Case-insensitive customer search', () => assert.equal(ids(model.selectJobSpaces(rows,'alex','all','updated')), '["3"]'));
test('Numeric quote number search', () => assert.equal(ids(model.selectJobSpaces(rows,'1014','all','updated')), '["2"]'));
test('Hash-prefixed quote number search', () => assert.equal(ids(model.selectJobSpaces(rows,'#1014','all','updated')), '["2"]'));
test('String quote number search', () => assert.equal(ids(model.selectJobSpaces(rows,'Q-1015','all','updated')), '["3"]'));
test('Status and search intersect', () => assert.equal(ids(model.selectJobSpaces(rows,'smith','sent','updated')), '[]'));
test('Unknown status can still be filtered', () => assert.equal(ids(model.selectJobSpaces(rows,'','awaiting_delivery','updated')), '["4"]'));
test('Unknown status is honest and neutral', () => { const s=model.jobStatusDisplay('awaiting_delivery'); assert.equal(s.label,'awaiting delivery'); assert.equal(s.tone,'neutral'); });
test('Declined is danger, not accepted/neutral', () => assert.equal(model.jobStatusDisplay('declined').tone,'danger'));
test('Missing job status retains existing Unsent fallback', () => assert.equal(model.jobStatusKey(row('5',{job_status:null})),'unsent'));
test('Invalid date does not crash or become today', () => assert.equal(model.jobUpdatedLabel('bad'),'Update time unavailable'));
test('Valid updated date is deterministic UTC', () => assert.equal(model.jobUpdatedLabel('2026-09-21T23:30:00-05:00'),'22 Sept 2026'));
test('Exact timestamp explicitly identifies UTC', () => assert.ok(model.jobUpdatedDetail('2026-09-21T00:00:00Z').endsWith('UTC')));
test('Missing job name uses customer', () => assert.equal(model.jobTitle(row('5',{job_name:null,customer_name:'Alex'})),'Alex'));
test('Missing both names gets honest fallback', () => assert.equal(model.jobTitle(row('5',{job_name:null,customer_name:''})),'Untitled job'));
test('Every row links to existing summary with return context', () => assert.equal(model.jobSpaceHref('roofing','abc'),'\/roofing/quotes/abc/summary?from=job-spaces'));
test('Path segments are encoded', () => assert.equal(model.jobSpaceHref('roofing','x/y'),'\/roofing/quotes/x%2Fy/summary?from=job-spaces'));
test('Projection does not mutate source arrays', () => { const copy=JSON.stringify(rows); model.selectJobSpaces(rows,'','all','updated'); assert.equal(JSON.stringify(rows),copy); });
test('No client truncation of input collection', () => { const big=Array.from({length:1205},(_,i)=>row(String(i))); assert.equal(model.selectJobSpaces(big,'','all','updated').length,1205); });
const nav = shell.workspaceNavigation('roofing',true,true);
const item = key=>nav.find(x=>x.key===key);
test('Quotes remains named Quotes at original route', () => { assert.equal(item('quotes').label,'Quotes'); assert.equal(item('quotes').href,'/roofing/quotes'); });
test('Job Spaces is an additional destination', () => assert.equal(item('job-spaces').href,'/roofing/job-spaces'));
test('Original assistant selector is retained for Quotes', () => assert.equal(item('quotes').copilot,'nav-quotes'));
test('Job index activates only Job Spaces', () => assert.equal(nav.filter(x=>shell.navIsActive(x,'/roofing/job-spaces','roofing')).map(x=>x.key).join(','),'job-spaces'));
test('Job summary activates only Job Spaces', () => assert.equal(nav.filter(x=>shell.navIsActive(x,'/roofing/quotes/abc/summary','roofing')).map(x=>x.key).join(','),'job-spaces'));
test('Quotes list still activates Quotes', () => assert.equal(nav.filter(x=>shell.navIsActive(x,'/roofing/quotes','roofing')).map(x=>x.key).join(','),'quotes'));
test('Builder remains in Quotes', () => assert.equal(nav.filter(x=>shell.navIsActive(x,'/roofing/quotes/abc/build','roofing')).map(x=>x.key).join(','),'quotes'));
test('New quote routing remains under Quotes', () => assert.ok(shell.navIsActive(item('quotes'),'/roofing/quotes/new','roofing')));
test('No prefix collision with summary-like route', () => assert.equal(shell.navIsActive(item('job-spaces'),'/roofing/quotes/abc/summary-other','roofing'),false));
test('No prefix collision with job-spaces-extra', () => assert.equal(shell.navIsActive(item('job-spaces'),'/roofing/job-spaces-extra','roofing'),false));
test('Existing supplier condition remains', () => assert.equal(shell.workspaceNavigation('roofing',false,true).some(x=>x.key==='supplier'),false));
test('Existing assistant condition remains', () => assert.equal(shell.workspaceNavigation('roofing',true,false).some(x=>x.key==='assistant'),false));
test('Order feature gate retained', () => assert.equal(item('orders').gatedBy,'material_orders'));
test('Invoice feature gate retained', () => assert.equal(item('invoices').gatedBy,'invoices'));
test('Normal routes have no forced rail', () => assert.equal(shell.shellRoute('/roofing/job-spaces','roofing').defaultMode,'expanded'));
test('Builder keeps editor width but no public/forced rail', () => { const x=shell.shellRoute('/roofing/quotes/abc/build','roofing'); assert.equal(x.width,'editor'); assert.equal(x.defaultMode,'expanded'); });
test('Takeoff keeps hidden immersive default', () => { const x=shell.shellRoute('/roofing/quotes/abc/takeoff','roofing'); assert.equal(x.width,'immersive'); assert.equal(x.defaultMode,'hidden'); });
test('Legacy rail preference normalizes to expanded', () => assert.equal(state.readSidebarPreference('rail'),'expanded'));
test('Hidden preference is preserved', () => assert.equal(state.readSidebarPreference('hidden'),'hidden'));
test('Absent preference is expanded', () => assert.equal(state.readSidebarPreference(null),'expanded'));
test('Corrupt preference is expanded', () => assert.equal(state.readSidebarPreference('bad'),'expanded'));
test('Toggle expanded to hidden, not rail', () => assert.equal(state.nextSidebarMode('expanded'),'hidden'));
test('Toggle hidden to expanded', () => assert.equal(state.nextSidebarMode('hidden'),'expanded'));
test('An internal rail may be hidden using the same tab', () => assert.equal(state.nextSidebarMode('rail'),'hidden'));
test('Normal routes use stored hidden preference', () => assert.equal(state.resolveSidebarMode('/r','expanded','hidden',null),'hidden'));
test('Immersive default does not need to overwrite preference', () => assert.equal(state.resolveSidebarMode('/t','hidden','expanded',null),'hidden'));
test('Route override can temporarily open takeoff', () => assert.equal(state.resolveSidebarMode('/t','hidden','hidden',{path:'/t',mode:'expanded',presentation:'expanded'}),'expanded'));
test('Override expires off its owning path', () => assert.equal(state.resolveSidebarMode('/other','expanded','hidden',{path:'/t',mode:'expanded',presentation:'expanded'}),'hidden'));
test('Internal rail remains supported by state model', () => assert.equal(state.resolveSidebarMode('/t','rail','expanded',null),'rail'));
console.log(JSON.stringify({ scope:'Pure presentation/model functions only; not application/RLS/canvas tests', total:results.length, results },null,2));
