const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(repo, p), 'utf8');
const route = 'app/(marketing)/roofing-pricing-setup/';

test('pricing setup landing route has correct SEO and conversion intent', () => {
  const page = read(route + 'page.tsx');
  assert.match(page, /Import Roofing Price Lists with AI/);
  assert.match(page, /const path = '\/roofing-pricing-setup'/);
  assert.match(page, /alternates: \{ canonical, languages:/);
  assert.match(page, /openGraph:/);
  assert.match(page, /type="application\/ld\+json"/);
  assert.equal((page.match(/href="\/signup"/g)||[]).length, 2);
  assert.match(page, /href="\/quick-start-pricing"/);
  assert.match(page, /href="\/features\/smart-components"/);
  assert.match(page, /data-analytics-surface="pricing_setup_hero"/);
});

test('simple two-path setup, clear review and no fabricated media', () => {
  const page = read(route + 'page.tsx');
  const media = read(route + 'media.ts');
  assert.match(page, /Enter it yourself/);
  assert.match(page, /Import prices with AI/);
  assert.match(page, /Excel, CSV, a supplier PDF or a photo/);
  assert.match(page, /Upload/);
  assert.match(page, /Review/);
  assert.match(page, /Save/);
  assert.match(page, /videoId \? <YouTubeLite/);
  assert.match(media, /NEXT_PUBLIC_PRICING_SETUP_TUTORIAL_ID/);
  assert.match(media, /NEXT_PUBLIC_PRICING_SETUP_BEFORE_IMAGE/);
  assert.match(media, /NEXT_PUBLIC_PRICING_SETUP_AFTER_IMAGE/);
  assert.match(media, /if \(!id \|\|/);
  assert.ok(!page.includes('—'), 'House style disallows em dashes');
});

test('marketing domain and sitemap expose new public route', () => {
  assert.match(read('middleware.ts'), /'\/roofing-pricing-setup', \/\/ Public/);
  assert.match(read('app/sitemap.ts'), /\$\{SITE_URL\}\/roofing-pricing-setup/);
  assert.match(read('app/(marketing)/features/smart-components/page.tsx'), /href="\/roofing-pricing-setup"/);
  assert.match(read('app/(marketing)/blog/[slug]/content/import-price-list-csv-to-components.tsx'), /href="\/roofing-pricing-setup"/);
});

test('styles use four-section light/dark standard and responsive layouts', () => {
  const css = read(route + 'PricingSetup.module.css');
  assert.match(css, /max-width: 1280px/);
  assert.match(css, /#ff641f/);
  assert.match(css, /#0a0b10/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /\.methodGrid \{ grid-template-columns: 1fr/);
  assert.match(css, /\.imagePlaceholder \{ width: 100%; min-height: 150px; aspect-ratio: auto/);
});
