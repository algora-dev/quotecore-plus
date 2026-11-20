const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '../..');
const read = path => readFileSync(join(root,path),'utf8');
test('strip sits between homepage hero and existing pricing, with one CTA',()=>{
 const home=read('components/marketing/home/Homepage.tsx');
 assert.match(home, /<LimitedTimeJobStrip \/>/);
 assert.ok(home.indexOf('<LimitedTimeJobStrip />')>home.indexOf('className={styles.hero}'));
 assert.ok(home.indexOf('<LimitedTimeJobStrip />')<home.indexOf("c('price-strip')"));
 const strip=read('components/marketing/home/LimitedTimeJobStrip.tsx');
 assert.match(strip,/href="\/your-job-demo"/);
 // CTA standardised to the glass MarketingButton recipe (owner 2026-11-16).
 assert.equal((strip.match(/<MarketingButton/g)||[]).length,1);
 assert.match(strip,/Learn more/);
});
test('job demo has page, accessible four-step client form and public metadata',()=>{
 const page=read('app/(marketing)/your-job-demo/page.tsx');
 const client=read('app/(marketing)/your-job-demo/JobDemoInquiryForm.tsx');
 assert.match(page,/JobDemoInquiryForm/);
 assert.match(page,/canonical: 'https:\/\/quote-core.com\/your-job-demo'/);
 assert.match(client,/type Step = 0 \| 1 \| 2 \| 3;/);
 assert.match(client,/type="file"/);
 assert.match(client,/consent/);
 assert.match(client,/fetch\('\/api\/job-demo-inquiry'/);
});
test('public submission validates attachments, consent and job details',()=>{
 const api=read('app/api/job-demo-inquiry/route.ts');
 for(const term of ['checkRateLimit','MAX_TOTAL','MAX_FILES','validBytes','consent','measurements','pricingProcess','sendEmail','escapeHtml']) assert.ok(api.includes(term));
 assert.doesNotMatch(api,/stripe|checkout\.sessions/i);
});
test('public pricing still mounts the actual authenticated calculator without Stripe continuation',()=>{
 const host=read('app/(marketing)/pricing/PublicPricingCalculator.tsx');
 assert.match(host,/import \{ PricingCalculator \} from/);
 assert.match(host,/continueHref=\{\(\) => '\/free-trial'\}/);
 assert.doesNotMatch(host,/onContinue=|checkout\.sessions|stripe\.checkout/i);
});
test('Done For You modal retains close X, multi-selection and visible component example',()=>{
 const modal=read('components/marketing/DoneForYouInquiryModal.tsx');
 assert.match(modal,/aria-label="Close">×<\/button>/);
 assert.match(modal,/measurementMethods: toggleValue/);
 assert.match(modal,/pricingSources: toggleValue/);
 assert.match(modal,/className=\{styles.componentExample\}/);
});
test('Quick Start remains enquiry before payment',()=>{
 const page=read('app/(marketing)/quick-start-pricing/page.tsx');
 const form=read('app/(marketing)/quick-start-pricing/QuickStartInquiryForm.tsx');
 assert.match(page,/From US\$49/);
 assert.match(form,/fetch\('\/api\/quick-start-inquiry'/);
 assert.doesNotMatch(form,/createCheckout|stripe\.checkout/);
});
