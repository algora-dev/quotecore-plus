// Phase 3 sidebar runtime test: real shell toggling with builder + takeoff state
// Uses e2e paid-c storage state with cookies rewritten to localhost.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3210';
const WS = 'e2e-paid-company-c';
const QUOTE = 'afa5ef4a-0d8c-491a-b876-6dbe4f271e9a'; // digital draft w/ plan file
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
const shellMode = async () => page.getAttribute('[data-qc-ui="v2"].qc-app-shell', 'data-qc-shell-mode');

// 1) Home: default expanded, edge tab present, toggle hidden/inert, toggle back
await page.goto(`${BASE}/${WS}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-qc-component="C50"]', { timeout: 60000 });
await page.waitForSelector('#qc-sidebar .qc-shell-navigation', { timeout: 60000 });
let mode = await shellMode();
report('home default expanded', mode === 'expanded', `mode=${mode}`);
await page.click('[data-qc-component="C50"]');
await page.waitForTimeout(700);
mode = await shellMode();
const inertAttr = await page.getAttribute('#qc-sidebar', 'inert');
const tabStillThere = await page.$('[data-qc-component="C50"]');
report('toggle hides sidebar (preference state)', mode === 'hidden', `mode=${mode}`);
report('hidden sidebar is inert', inertAttr !== null, `inert attr=${JSON.stringify(inertAttr)}`);
report('edge tab persists while hidden', !!tabStillThere);
await page.click('[data-qc-component="C50"]');
await page.waitForTimeout(700);
mode = await shellMode();
report('toggle restores expanded', mode === 'expanded', `mode=${mode}`);

// 2) Job Spaces page loads with rows
await page.goto(`${BASE}/${WS}/job-spaces`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-qc-component="C51"]', { timeout: 60000 });
const h1 = await page.textContent('[data-qc-component="C51"] h1');
report('job spaces view loads', (h1 || '').trim() === 'Job Spaces', `h1=${(h1 || '').trim()}`);
const resultLine = await page.textContent('.qc-job-index-result-line').catch(() => '');
report('job spaces list rendered with count', /job space/.test(resultLine || ''), (resultLine || '').trim().slice(0, 80));

// 3) Builder: follows preference (expanded), repeated toggles, no remount, URL stable
await page.goto(`${BASE}/${WS}/quotes/${QUOTE}/build`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-qc-component="C50"]', { timeout: 90000 });
await page.waitForSelector('.qc-main > *', { timeout: 90000 });
await page.waitForTimeout(2000);
mode = await shellMode();
report('builder follows saved preference (no forced rail)', mode === 'expanded', `mode=${mode}`);
const builderUrl = page.url();
const markerOk = await page.evaluate(() => {
  const main = document.querySelector('.qc-main');
  if (!main || !main.firstElementChild) return false;
  window.__marker = main.firstElementChild;
  return true;
});
for (let i = 0; i < 3; i++) { await page.click('[data-qc-component="C50"]'); await page.waitForTimeout(450); }
mode = await shellMode();
report('builder toggle x3 lands hidden', mode === 'hidden', `mode=${mode}`);
const stillConnected = await page.evaluate(() => window.__marker && window.__marker.isConnected);
report('builder content NOT remounted across toggles', stillConnected === true);
report('builder URL unchanged', page.url() === builderUrl);
await page.click('[data-qc-component="C50"]');
await page.waitForTimeout(500);

// 4) Takeoff: defaults hidden, canvas survives toggle cycles
await page.goto(`${BASE}/${WS}/quotes/${QUOTE}/takeoff`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
mode = await shellMode();
report('takeoff defaults hidden', mode === 'hidden', `mode=${mode}`);
await page.click('[data-qc-component="C50"]');
await page.waitForTimeout(700);
mode = await shellMode();
let canvas = await page.$('canvas');
let canvasBox = canvas ? await canvas.boundingBox() : null;
report('takeoff toggle opens nav', mode === 'expanded', `mode=${mode}`);
report('takeoff canvas present while expanded', !!canvas, canvasBox ? `w=${Math.round(canvasBox.width)} h=${Math.round(canvasBox.height)}` : 'no canvas');
await page.click('[data-qc-component="C50"]');
await page.waitForTimeout(700);
mode = await shellMode();
canvas = await page.$('canvas');
canvasBox = canvas ? await canvas.boundingBox() : null;
report('takeoff back to hidden', mode === 'hidden', `mode=${mode}`);
report('takeoff canvas survives hide (still mounted)', !!canvas, canvasBox ? `w=${Math.round(canvasBox.width)} h=${Math.round(canvasBox.height)}` : 'no canvas');

// 5) Route-change preference persistence: back to home still expanded
await page.goto(`${BASE}/${WS}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-qc-component="C50"]', { timeout: 60000 });
await page.waitForTimeout(1000);
mode = await shellMode();
report('preference persists across routes (expanded)', mode === 'expanded', `mode=${mode}`);

const failed = results.filter((r) => !r.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);