const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root,p), 'utf8');
const page = read('app/(marketing)/roof-measurements-to-price/page.tsx');
const media = read('app/(marketing)/roof-measurements-to-price/media.ts');

test('marketing page explains manual and assisted measurement input', () => {
  for (const s of ['Already have roof measurements?', 'Enter them yourself', 'Extract measurements with AI','Select the saved pricing library', 'saved pricing library']) assert.ok(page.includes(s), s);
});
test('the free browser tool and Free Workspace are distinct paths', () => {
  for (const s of ['/measurement-to-quote-tool', '/signup', 'Standalone free tool', 'QuoteCore+ Free Workspace', 'Free usage limits apply']) assert.ok(page.includes(s),s);
});
test('connected landing pages and search discoverability are registered', () => {
  assert.match(read('middleware.ts'), /'\/roof-measurements-to-price'/);
  assert.match(read('app/sitemap.ts'), /\/roof-measurements-to-price/);
  assert.ok(read('app/(marketing)/roofing-pricing-setup/page.tsx').includes('/roof-measurements-to-price'));
  assert.ok(read('app/(marketing)/roofing-takeoff-software/page.tsx').includes('/roof-measurements-to-price'));
  assert.ok(read('app/(public)/measurement-to-quote-tool/page.tsx').includes('/roof-measurements-to-price'));
});
test('video and sample imagery are placeholders until real media supplied', () => {
  assert.ok(media.includes('NEXT_PUBLIC_MEASUREMENTS_PRICE_TUTORIAL_ID'));
  assert.ok(media.includes('NEXT_PUBLIC_MEASUREMENTS_PRICE_AFTER_IMAGE'));
  assert.ok(page.includes('videoId ?'));
  assert.ok(media.includes('VideoObject'));
  assert.ok(media.includes('!id ||'));
});
test('SEO and public layout semantics', () => {
  assert.ok(page.includes("'/roof-measurements-to-price'"));
  assert.match(page,/const pageTitle = 'Roof Measurements to Quote with AI Import \| QuoteCore\+'/);
  assert.ok(page.includes('<h1'));
  assert.ok(page.includes('buildBreadcrumbSchema'));
  assert.ok(page.includes('buildSoftwareApplicationSchema'));
});

test('photo-first AI explanation and conditional instant pricing are honest and easy to find', () => {
  for (const value of ['calculates the price instantly', 'once your pricing is set up', 'photo of handwritten roof measurements', 'AI suggests the areas, lengths and quantities', 'Import your pricing with AI or set it up manually']) {
    assert.ok(page.includes(value), value);
  }
});

test('full workspace comes before quick tool, and entire comparison cards are clickable', () => {
  const start = page.indexOf('className={styles.compare}');
  assert.ok(start >= 0);
  const cards = page.slice(start, page.indexOf('\n          </div>', start));
  assert.ok(cards.indexOf('<Link href="/signup"') < cards.indexOf('<Link href="/measurement-to-quote-tool?trade=roofing"'));
  assert.match(cards, /<Link href="\/signup" className=\{`\$\{styles\.compareOption\} \$\{styles\.compareFeatured\}`\}/);
  assert.match(cards, /<Link href="\/measurement-to-quote-tool\?trade=roofing" className=\{`\$\{styles\.compareOption\} \$\{styles\.compareStandalone\}`\}/);
  assert.ok(!cards.includes('<Link href="/signup" data-analytics'));
});

test('distinct SEO positioning and inter-page journey preserved', () => {
  assert.ok(page.includes("const path = '/roof-measurements-to-price'"));
  for(const route of ['/roofing-pricing-setup','/roofing-takeoff-software','/signup','/measurement-to-quote-tool?trade=roofing']) assert.ok(page.includes(route));
  assert.ok(page.includes('buildSoftwareApplicationSchema'));
});
