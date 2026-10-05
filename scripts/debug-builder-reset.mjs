/**
 * Debug: reproduce the quote-builder state-reset bug.
 * Runs against local dev server (localhost:3002) with starter-b e2e creds.
 * Captures: console renders, RSC/action network, URL changes, DOM state over time.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const env = readFileSync('.env.e2e', 'utf8');
const envVal = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const EMAIL = envVal('E2E_STARTER_B_EMAIL');
const PASSWORD = envVal('E2E_STARTER_B_PASSWORD');
const SLUG = envVal('E2E_STARTER_B_SLUG');
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const QUOTE_ID = process.env.QUOTE_ID || 'c7fe0e35-d5c1-453b-8840-5c71549b9f68';

const t0 = Date.now();
const now = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const log = (...a) => console.log(`[${now()}]`, ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();

page.on('console', (m) => {
  const txt = m.text();
  if (txt.includes('[QuoteBuilder]') || txt.includes('Error') || txt.includes('error')) log('CONSOLE:', txt.slice(0, 200));
});
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('/quotes/') || u.includes('action')) {
    const h = r.headers();
    const kind = h['next-action'] ? 'ACTION' : h['rsc'] ? 'RSC' : r.method();
    log('REQ:', kind, r.method(), u.replace(BASE, ''), h['next-action'] ? `action=${h['next-action'].slice(0, 10)}` : '');
  }
});
page.on('framenavigated', (f) => { if (f === page.mainFrame()) log('NAV:', f.url().replace(BASE, '')); });

log('login as', EMAIL);
await page.goto('/login');
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.getByRole('button', { name: /log in/i }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 });
log('logged in, now at', page.url().replace(BASE, ''));

await page.goto(`/${SLUG}/quotes/${QUOTE_ID}/build`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);
log('builder loaded:', page.url().replace(BASE, ''));

const probe = async (label) => {
  const url = page.url().replace(BASE, '');
  const expanded = await page.locator('[aria-expanded="true"]').count();
  const inputs = await page.locator('input:visible').count();
  const values = await page.locator('input:visible').evaluateAll((els) => els.slice(0, 6).map((e) => e.value).join('|'));
  log(`PROBE[${label}] url=${url} expanded=${expanded} inputs=${inputs} values="${values}"`);
};

// Phase 1: passive watch (no interaction) for 30s
await probe('start');
for (let i = 0; i < 10; i++) { await page.waitForTimeout(3000); await probe(`idle-${(i + 1) * 3}s`); }

// Phase 2: try to add a roof area via UI
const areaInput = page.locator('input[placeholder*="area" i], input[aria-label*="area" i]').first();
if (await areaInput.isVisible({ timeout: 3000 }).catch(() => false)) {
  await areaInput.fill('Debug Area');
  const addBtn = page.getByRole('button', { name: /add (roof )?area/i }).first();
  if (await addBtn.isVisible().catch(() => false)) { await addBtn.click(); log('clicked add area'); await page.waitForTimeout(3000); }
  else log('add-area button not found');
} else log('area input not found - continuing with whatever is present');
await probe('after-add-area');

// Phase 3: type in first numeric input + blur (auto-save hypothesis)
const num = page.locator('input[type="number"]:visible, input[inputmode="decimal"]:visible').first();
if (await num.isVisible({ timeout: 3000 }).catch(() => false)) {
  await num.fill('3.5');
  log('filled numeric input 3.5, blurring...');
  await page.mouse.click(10, 300);
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(3000); await probe(`post-blur-${(i + 1) * 3}s`); }
} else log('no numeric input found');

// Phase 4: stepper walk to review, then idle watch (review->extras yank repro)
for (const step of ['Review', 'Extras', 'Components', 'Roof Areas', 'Review']) {
  const btn = page.getByRole('button', { name: new RegExp(step, 'i') }).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) { await btn.click(); await page.waitForTimeout(1500); await probe(`stepped-${step}`); }
  else log(`step button "${step}" not found`);
}
for (let i = 0; i < 8; i++) { await page.waitForTimeout(3000); await probe(`watch-${(i + 1) * 3}s`); }

await browser.close();
log('done');
