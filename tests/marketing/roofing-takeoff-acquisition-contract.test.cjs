const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const root = process.cwd();
const route = join(root,'app/(marketing)/roofing-takeoff-software');
const read = path => readFileSync(path,'utf8');
const page = read(join(route,'page.tsx'));
const css = read(join(route,'RoofTakeoff.module.css'));
const media = read(join(route,'media.ts'));

test('Search-facing page retains existing route and covers plans, satellite imagery, free and AI takeoff', () => {
  for (const term of ['roofing-takeoff-software','satellite images','PDF roof plan','blueprint','Roof Scan Assist','/free-roof-takeoff','/signup']) assert.ok(page.includes(term),term);
  assert.match(page,/alternates: \{ canonical/);
  assert.match(page,/buildFaqSchema\(faqs\)/);
});
test('AI is editable with qualified image accuracy wording', () => {
  for(const term of ['calibrate','shadows','trees','complex roofs','edit','satellite image','AI subject to credits']) assert.ok(page.toLowerCase().includes(term.toLowerCase()),term);
  assert.doesNotMatch(page,/can.?t (scan|use).*satellite/i);
  assert.match(page,/does not automatically fetch satellite imagery/i);
});
test('Page connects to related acquisition steps without confusing the two free options', () => {
  for (const target of ['/roofing-pricing-setup','/roof-measurements-to-price','/features/ai-scan-assist','/features/digital-roof-takeoff','/research/google-earth-roof-measurement-accuracy']) assert.ok(page.includes(target),target);
  assert.match(page,/Standalone free roof tool/);
  assert.match(page,/QuoteCore\+ Free Workspace/);
});
test('Real site assets and responsive four-section styling are present', () => {
  const paths=['/marketing/home/takeoff-workspace-v2.webp','/marketing/current-ux/digital-takeoff-manual.webp','/marketing/current-ux/ai-scan-assist-completed-roof.webp','/marketing/current-ux/quote-builder-components-measurements.webp'];
  for(const asset of paths)assert.ok(existsSync(join(root,'public',asset)),asset);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(page,/<details key=\{faq.question\}/);
});
test('Video stays a truthful placeholder until published', () => {
  assert.match(media,/NEXT_PUBLIC_ROOF_TAKEOFF_TUTORIAL_ID/);
  assert.match(media,/return null/);
  assert.match(page,/videoId \? <YouTubeLite/);
  assert.match(page,/Your YouTube tutorial goes here/);
});
test('Supporting AI feature page no longer rules out uploaded satellite imagery', () => {
  const scan=read(join(root,'app/(marketing)/features/ai-scan-assist/page.tsx'));
  assert.match(scan,/uploaded satellite image/);
  assert.match(scan,/shadows, trees and roof complexity/);
  assert.doesNotMatch(scan,/designed for roof plans and drawings\. It is not a satellite/);
});

test('Measured or AI-drawn roof components carry into pricing and quote without re-entry', () => {
  for (const phrase of ['Draw it or scan it.', 'The price follows.', 'Components price automatically', 'No re-entry', 'saved rates', 'barge or rake']) assert.ok(page.includes(phrase), phrase);
  assert.match(page,/\/roofing-pricing-setup/);
  assert.match(page,/demo-02-takeoff\.webp/);
  assert.equal((page.match(/<img src="\/marketing\/home\/takeoff-workspace-v2\.webp"/g)||[]).length,1,'hero asset must not be repeated as the result');
});
test('Full-width CTA cards use typography without decorative icons', () => {
  assert.match(page,/<div className=\{styles\.compareTitle\}><h3>QuoteCore\+ Free Workspace<\/h3><\/div>/);
  assert.match(page,/<div className=\{styles\.compareTitle\}><h3>Standalone free roof tool<\/h3><\/div>/);
  assert.doesNotMatch(css,/\.compareTitle>svg/);
});


test('Related action cards use relevant currency and measurement symbols with descriptive destination copy', () => {
  assert.match(page, /className=\{styles\.currencyGlyph\} aria-hidden="true">\$<\/span>/);
  assert.match(page, /Already have measurements\?<\/strong><small>Price your existing quantities/);
  assert.match(page, /<Icon kind="ruler" \/>/);
  assert.match(page, /import a price list with AI/);
  assert.match(css, /\.currencyGlyph/);
});
