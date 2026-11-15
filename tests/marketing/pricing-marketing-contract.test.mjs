/**
 * Marketing launch regression checks. No dependencies, network, data or secrets.
 * Run: node --test tests/marketing/pricing-marketing-contract.test.mjs
 * Static intent checks supplement, not replace, staging/browser/payment testing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = path => readFileSync(resolve(root, path), 'utf8');

test('public Quick Start advertises starting US$49, 15 components and review before payment', () => {
  const page = source('app/(marketing)/quick-start-pricing/page.tsx');
  assert.match(page, /From US\$49/);
  assert.match(page, /15 Smart Components/);
  assert.match(page, /confirm what you need and the final price before sending your payment link/i);
  assert.match(page, /QuickStartInquiryForm/);
  assert.doesNotMatch(page, /createCheckoutSession|stripe\.checkout/);
});

test('Quick Start upload endpoint sends staff an enquiry; does not bill', () => {
  const route = source('app/api/quick-start-inquiry/route.ts');
  assert.match(route, /checkRateLimit/);
  assert.match(route, /MAX_TOTAL = 4 \* 1024 \* 1024/);
  assert.match(route, /sendEmail/);
  assert.match(route, /consent/);
  assert.doesNotMatch(route, /from ['"]stripe['"]|checkout\.sessions\.create/i);
});

// NOTE (Ron 2026-11-15): the external marketing handoff retires the in-app instant
// Quick Start checkout (HTTP 410 stub). development currently keeps Gavin's $49
// Stripe checkout (commit 31195abf), so the 410 assertions are skipped until the
// owner decides the in-app direction. Public marketing pages are enquiry-only.
test.skip('legacy immediate Quick Start checkout stays retired', () => {
  const route = source('app/api/pricing-setup/quick-start/route.ts');
  assert.match(route, /status:410/);
  assert.doesNotMatch(route, /checkout\.sessions\.create/);
});

test('Done For You advertises US$199 and three months of included paid software and support', () => {
  const page = source('app/(marketing)/done-for-you-setup/page.tsx');
  assert.match(page, /US\$199/);
  assert.match(page, /Up to 15 Smart Components/);
  assert.match(page, /3 months of QuoteCore\+ included/);
  assert.match(page, /3 months of ongoing support/);
  assert.match(page, /DoneForYouInquiryButton formOnly/);
  assert.match(page, /Book a 25-minute call/);
});

test('public pricing calculator uses existing app calculations without billing callbacks', () => {
  const host = source('app/(marketing)/pricing/PublicPricingCalculator.tsx');
  const actual = source('app/components/pricing/calculator/PricingCalculator.tsx');
  assert.match(host, /import \{ PricingCalculator \}/);
  assert.match(host, /catalog=\{PREVIEW_CATALOG\}/);
  assert.match(host, /continueHref=\{\(\) => '\/signup'\}/);
  assert.match(host, /publicNextSteps/);
  assert.doesNotMatch(host, /onContinue=|from ['"]stripe['"]|checkout\.sessions\.create/i);
  assert.match(actual, /PublicPricingNextSteps/);
});

test('public calculator provides free signup plus call and Done For You', () => {
  const body = source('app/components/pricing/calculator/PublicPricingNextSteps.tsx');
  assert.match(body, /Book a free 25-minute call/);
  assert.match(body, /Explore Done For You setup/);
  assert.match(body, /Paid plans are chosen and activated inside your account/);
});
