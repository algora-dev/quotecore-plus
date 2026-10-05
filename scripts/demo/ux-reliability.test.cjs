require('./ts-hook.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initialDemoGuide, readGuide, acknowledge } = require('../../app/lib/demo/model.ts');
const { applyGuideCommand, parseGuideCommand } = require('../../app/lib/demo/commands.ts');
const { canEnterChapter, DEMO_GUIDE_CHAPTERS, guideProgress, nextGuideStep } = require('../../app/lib/demo/guide.ts');
const { guideLocation, shouldAdvanceToCustomer, acceptGuideRevision, clampGuidePosition, chapterOutcome, assistantExample, isDemoSystem } = require('../../app/lib/demo/presentation.ts');
const { demoRequest, DemoRequestError, safeDemoHref } = require('../../app/lib/demo/client-request.ts');
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const now = '2026-10-05T12:00:00.000Z';
const slug = 'demo-test';
function fresh() { return initialDemoGuide({ guided_roof_job: id, maintenance_component: other }); }
function pricing() { return acknowledge(acknowledge({ ...fresh(), guided_created_component_id: id, guided_created_component_name: 'My roof detail' }, 'component.created', id), 'component.tested', id); }

test('optional skipping never invents a saved-product acknowledgement', () => {
  const next = applyGuideCommand(pricing(), { action: 'skip' });
  assert.ok(next.skipped['component.edited']); assert.equal(next.acknowledgements['component.edited'], undefined);
  assert.deepEqual(guideProgress(next), { done: 2, skipped: 1, handled: 3, total: 10 });
  assert.equal(nextGuideStep(next), undefined);
});
for (const event of ['component.created', 'component.tested', 'takeoff.saved']) test(`required lesson ${event} still cannot be skipped`, () => {
  const s = event === 'component.created' ? fresh() : event === 'component.tested' ? acknowledge({ ...fresh(), guided_created_component_id: id }, 'component.created', id) : { ...pricing(), chapter: 'takeoff' };
  assert.equal(applyGuideCommand(s, { action: 'skip' }), null);
});
test('a later real save replaces a skipped marker', () => {
  const skipped = applyGuideCommand(pricing(), { action: 'skip' });
  const completed = acknowledge(skipped, 'component.edited', other);
  assert.equal(completed.skipped['component.edited'], undefined); assert.ok(completed.acknowledgements['component.edited']);
});
test('all handled lessons can finish without claiming skipped work succeeded', () => {
  let s = fresh();
  for (const chapter of DEMO_GUIDE_CHAPTERS) for (const step of chapter.steps) {
    if (['email.sent','assistant.found'].includes(step.event)) s = { ...s, skipped: { ...s.skipped, [step.event]: { at: now } } };
    else s = acknowledge(s, step.event, id);
  }
  assert.equal(canEnterChapter(s, 'complete'), true); assert.equal(guideProgress(s).done, 8);
  assert.equal(chapterOutcome(s, DEMO_GUIDE_CHAPTERS[2]).finished, true);
  assert.equal(chapterOutcome(s, DEMO_GUIDE_CHAPTERS[2]).skipped, 1);
});
test('persisted optional skips and known date fields round-trip', () => {
  const saved = { ...pricing(), skipped: { 'email.sent': { at: now }, imaginary: { at: now } }, assistant_quote_updated_at: now, completed_at: now };
  const parsed = readGuide(saved);
  assert.deepEqual(parsed.skipped, { 'email.sent': { at: now } });
  assert.equal(parsed.assistant_quote_updated_at, now); assert.equal(parsed.completed_at, now);
});
test('old V2 state without skips remains valid', () => {
  const old = pricing(); delete old.skipped;
  assert.deepEqual(readGuide(old).acknowledgements, old.acknowledgements);
  assert.equal(readGuide(old).skipped, undefined);
});
test('client cannot submit fabricated completion or skip maps', () => {
  assert.equal(parseGuideCommand({ action: 'skip', skipped: { 'takeoff.saved': true } }), null);
  assert.equal(parseGuideCommand({ action: 'chapter', chapter: 'complete', acknowledgements: {} }), null);
});
test('Assistant prerequisite cannot be reduced to a skipped presentation without saved Takeoff', () => {
  const s = { ...fresh(), skipped: { 'quote.presentation': { at: now } } };
  assert.equal(canEnterChapter(s, 'smart-assistant'), false);
  assert.equal(canEnterChapter(acknowledge(s, 'takeoff.saved', id), 'smart-assistant'), true);
});
test('late GET cannot regress a newer PATCH revision', () => {
  const latest = { ...pricing(), revision: 8 }; const stale = { ...fresh(), revision: 7 };
  assert.equal(acceptGuideRevision(latest, stale), latest);
  assert.equal(acceptGuideRevision(stale, latest), latest);
});
test('component editor URL is not proof the drawer is open', () => {
  const s = acknowledge({ ...fresh(), guided_created_component_id: id }, 'component.created', id);
  const current = guideLocation(slug, s, `/${slug}/components`, { kind: 'closed' });
  assert.equal(current.onPage, true); assert.equal(current.ready, false);
});
test('a different component never receives instructions for the guided one', () => {
  const s = acknowledge({ ...fresh(), guided_created_component_id: id }, 'component.created', id);
  assert.equal(guideLocation(slug, s, `/${slug}/components`, { kind: 'test', componentId: other }).ready, false);
  assert.equal(guideLocation(slug, s, `/${slug}/components`, { kind: 'test', componentId: id }).ready, true);
});
test('create instructions require the actual create editor', () => {
  assert.equal(guideLocation(slug, fresh(), `/${slug}/components`, { kind: 'edit', componentId: id }).ready, false);
  assert.equal(guideLocation(slug, fresh(), `/${slug}/components`, { kind: 'create' }).ready, true);
});
test('send lesson recognizes editor vs Job Space for distinct instructions', () => {
  let s = { ...fresh(), chapter: 'customer-quote' };
  s = acknowledge(acknowledge(s, 'quote.template', id), 'quote.presentation', id);
  assert.equal(guideLocation(slug, s, `/${slug}/quotes/${id}/customer-edit`, null).inCustomerEditor, true);
  assert.equal(guideLocation(slug, s, `/${slug}/quotes/${id}/summary`, null).ready, true);
  assert.equal(guideLocation(slug, s, `/${slug}/quotes/${other}/summary`, null).onPage, false);
});
test('Assistant guides only workspace routes and never Q/standalone/settings', () => {
  const s = { ...fresh(), chapter: 'smart-assistant' };
  assert.equal(guideLocation(slug, s, `/${slug}/quotes`, null).onPage, true);
  for (const p of [`/${slug}/assistant`, `/${slug}/account/smart-assistant`, '/demo-other/quotes', '/demo-test-other']) assert.equal(guideLocation(slug, s, p, null).onPage, false);
});
test('saved Takeoff -> customer transition survives a remount', () => {
  const s = { ...acknowledge(pricing(), 'takeoff.saved', id), chapter: 'takeoff', mode: 'guided' };
  assert.equal(shouldAdvanceToCustomer(slug, s, `/${slug}/quotes/${id}/customer-edit`), true);
  assert.equal(shouldAdvanceToCustomer(slug, { ...s, mode: 'explore' }, `/${slug}/quotes/${id}/customer-edit`), false);
  assert.equal(shouldAdvanceToCustomer(slug, s, `/${slug}/quotes/${id}/takeoff`), false);
});
test('guide stays in bounds after content growth, resize and keyboard move', () => {
  assert.deepEqual(clampGuidePosition({ x: 900, y: 700 }, 376, 600, 1024, 768), { x: 636, y: 156 });
  assert.deepEqual(clampGuidePosition({ x: -20, y: -20 }, 400, 600, 320, 400), { x: 12, y: 12 });
});
for (const units of ['metric','imperial_ft','imperial_rs']) test(`examples follow ${units} without changing price conversions`, () => {
  assert.equal(isDemoSystem(units), true);
  const prompt = assistantExample('assistant.created', units);
  assert.ok(prompt.includes(units === 'metric' ? '180 m²' : units === 'imperial_ft' ? '1,940 ft²' : '19.4 roofing squares'));
});
test('same-workspace destinations accepted, protocol/external/sibling destinations denied', () => {
  assert.equal(safeDemoHref('/demo-test/components?demoCreate=1', slug), true);
  for (const href of ['https://demo.invalid/demo-test', '//evil.invalid/demo-test', 'javascript:alert(1)', '/demo-other', '/demo-test/../../other', '/demo-test-other', '/demo-test\\evil']) assert.equal(safeDemoHref(href, slug), false, href);
});
test('request helper preserves explicit error status/code', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ error: 'Ended', code: 'demo_expired' }), { status: 410 });
  try { await assert.rejects(demoRequest('/api/demo/state'), error => error instanceof DemoRequestError && error.status === 410 && error.code === 'demo_expired'); }
  finally { global.fetch = original; }
});
test('request helper rejects unreadable 200 responses', async () => {
  const original = global.fetch; global.fetch = async () => new Response('<html>login</html>');
  try { await assert.rejects(demoRequest('/api/demo/state'), error => error.code === 'demo_response'); }
  finally { global.fetch = original; }
});
test('timeout aborts exactly one mutation attempt, never resends', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async (_url, init) => { calls++; return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })); };
  try { await assert.rejects(demoRequest('/api/demo/reset', { method: 'POST' }, 12), error => error.code === 'demo_timeout'); assert.equal(calls, 1); }
  finally { global.fetch = original; }
});
test('static guard: prerequisite validation precedes Assistant setup', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../app/api/demo/state/route.ts'), 'utf8');
  assert.ok(src.indexOf('if (!applyGuideCommand(context.tutorialState, command))') < src.indexOf('await prepareDemoAssistant(context,client)'));
});
test('static guard: self-send rejects an explicitly wrong quote before delivery', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../app/api/demo/self-send/route.ts'), 'utf8');
  assert.ok(src.indexOf('body.quoteId !== context.tutorialState.seed.guided_roof_job') < src.indexOf('await sendDemoQuote'));
});
test('array-shaped success responses are rejected rather than treated as missing setup', async () => {
  const original=global.fetch;global.fetch=async()=>new Response('[]');
  try { await assert.rejects(demoRequest('/api/demo/start'),error=>error.code==='demo_response'); }
  finally { global.fetch=original; }
});
test('static guard: demo component creator respects the existing dirty editor confirmation', () => {
  const src=fs.readFileSync(path.join(__dirname,'../../app/(auth)/[workspaceSlug]/components/component-list.tsx'),'utf8');
  const effect=src.slice(src.indexOf('openedDemoCreateRef.current = visit;'),src.indexOf('// Demo-only surface signal'));
  assert.ok(effect.indexOf('await mayLeaveEditor()')>=0);
  assert.ok(effect.indexOf('await mayLeaveEditor()')<effect.indexOf('setEditingId(null)'));
});
test('find-work lesson explains the record navigation that completes the real server event', () => {
  const step=DEMO_GUIDE_CHAPTERS.flatMap(c=>c.steps).find(s=>s.event==='assistant.found');
  assert.match(step.copy,/open the matching job/);
});
