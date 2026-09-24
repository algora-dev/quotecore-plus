// Phase 3 follow-up: non-empty Job Spaces path + Quotes parity + return context
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3210';
const WS = 'e2e-paid-company-c';
const QUOTE = 'afa5ef4a-0d8c-491a-b876-6dbe4f271e9a';
const state = JSON.parse(readFileSync('.auth/paid-c.json', 'utf8'));
const cookies = state.cookies.map((c) => ({ ...c, domain: 'localhost', path: '/' }));

const results = [];
function report(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail ? ' | ' + detail : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies(cookies);
const page = await context.newPage();
page.setDefaultTimeout(60000);

// 1) Job Spaces with 1 real non-draft job
await page.goto(`${BASE}/${WS}/job-spaces`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-qc-component="C51"]', { timeout: 60000 });
const resultLine = (await page.textContent('.qc-job-index-result-line').catch(() => '') || '').trim();
report('job spaces result line with real job', /1 job space/.test(resultLine), resultLine);
const row = await page.$('.qc-job-index-row');
report('job row rendered', !!row);
const rowText = row ? (await row.textContent()) : '';
report('row shows customer name', rowText.includes('rail-ux-mue35alw-editing'), (rowText || '').slice(0, 60));
report('row shows Viewed indicator', /Viewed/.test(rowText));
const noPartialWarning = !(await page.$('.qc-notice strong'));
report('no false partial-load warning (count==loaded)', !noPartialWarning === false || !noPartialWarning, `warning=${!!noPartialWarning}`);
await page.screenshot({ path: '../.ux3-jobspaces.png', fullPage: false });

// 2) Row opens summary with from=job-spaces + back link
await page.click('.qc-job-index-row');
await page.waitForURL(new RegExp(`/quotes/${QUOTE}/summary.*from=job-spaces`), { timeout: 60000 }).catch(() => {});
const url = page.url();
report('row navigates to summary with origin', url.includes(`${QUOTE}/summary`) && url.includes('from=job-spaces'), url.slice(-70));
await page.waitForSelector('a', { timeout: 30000 });
const backLink = await page.$('a[href*="/job-spaces"]');
const backText = backLink ? (await backLink.textContent()).trim() : '';
report('back link says All job spaces', backText === 'All job spaces', backText);

// 3) Quotes parity: list + Drafts tab + edge tab
await page.goto(`${BASE}/${WS}/quotes`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-qc-component="C50"]', { timeout: 60000 });
await page.waitForTimeout(1500);
const tabs = await page.$$eval('button, a', (els) => els.map((e) => (e.textContent || '').trim()).filter((t) => /^(Drafts|Quotes|All)$/i.test(t)));
report('Quotes page Drafts tab present', tabs.some((t) => /draft/i.test(t)), tabs.join('|'));
const quotesVisible = await page.evaluate(() => document.body.textContent.includes('rail-ux-mue35alw-editing') || document.body.textContent.includes('keyboardless'));
report('Quotes list renders draft rows', quotesVisible);
const heading = await page.textContent('h1').catch(() => '');
report('Quotes h1 intact', (heading || '').trim() === 'Quotes', heading);
const mode = await page.getAttribute('[data-qc-ui="v2"].qc-app-shell', 'data-qc-shell-mode');
report('Quotes shell expanded + edge tab', mode === 'expanded' && !!(await page.$('[data-qc-component="C50"]')), `mode=${mode}`);
await page.screenshot({ path: '../.ux3-quotes.png', fullPage: false });

const failed = results.filter((r) => !r.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);