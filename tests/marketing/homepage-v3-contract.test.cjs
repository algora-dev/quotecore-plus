const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '../..');
const read = (file) => readFileSync(join(root, file), 'utf8');

test('homepage order keeps compact journey, original job strip, workspace, testimonials, then help', () => {
  const source = read('components/marketing/home/Homepage.tsx');
  const anchors = ['<HomepageJourney />', '<LimitedTimeJobStrip />', 'className={styles.workspace}', 'className={styles.reviews}', '<HomepageHelp'];
  let at = 0;
  for (const anchor of anchors) {
    const next = source.indexOf(anchor);
    assert.ok(next >= at, `${anchor} should follow previous section`);
    at = next;
  }
});

test('workflow includes faster promise, accessible single-open panels and a direct features link', () => {
  const source = read('components/marketing/home/HomepageJourney.tsx');
  assert.match(source, /there&apos;s an easier and faster way to quote them/);
  assert.match(source, /Here&apos;s how it works in our app/);
  assert.match(source, /aria-expanded=\{active === index\}/);
  assert.match(source, /hidden=\{active !== index\}/);
  assert.match(source, /href="\/features"/);
  assert.match(source, /Click to see how it works/);
  assert.doesNotMatch(source, /—/);
});

test('pricing copy promises only accepted file formats and human review', () => {
  const journey = read('components/marketing/home/HomepageJourney.tsx');
  const assistant = read('app/(auth)/[workspaceSlug]/pricing/assistant/PricingAssistantClient.tsx');
  assert.match(journey, /Excel \(\.xlsx\)/);
  assert.match(journey, /photo, PDF or text file/);
  assert.match(journey, /review and confirm/);
  assert.match(assistant, /\.csv,\.xlsx,\.txt,\.pdf,\.png,\.jpg,\.jpeg,\.webp/);
});

test('help includes optional founder video and banner uses dark eyebrow ink', () => {
  const help = read('components/marketing/home/HomepageHelp.tsx');
  const banner = read('components/marketing/home/LimitedTimeJobStrip.module.css');
  assert.match(help, /<details className=\{s.founderStory\}>/);
  assert.match(help, /videoId="4E3khV0qRyI"/);
  assert.match(help, /Why I built QuoteCore\+/);
  assert.match(banner, /\.eyebrow\s*\{[^}]*color:\s*#161a20/s);
  assert.doesNotMatch(help, /—/);
});
