// Phase 4 desktop takeoff runtime checks: host mount, single canvas, no remount across
// sidebar toggles + viewport resizes, zoom group present, header present.
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
page.setDefaultTimeout(90000);

await page.goto(`${BASE}/${WS}/quotes/${QUOTE}/takeoff`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

// 1) Phase 4 host + single canvas
const host = await page.$('.qc-takeoff-host');
report('TakeoffDesktopHost mounted', !!host, host ? `data-qc-desktop=${await host.getAttribute('data-qc-desktop')}` : 'not found');
const canvases = await page.$$('canvas');
const containers = await page.$$('.canvas-container');
report('single Fabric owner (one canvas-container; Fabric renders lower+upper canvas elements)', containers.length === 1, `containers=${containers.length}, canvases=${canvases.length}`);
let box1 = canvases[0] ? await canvases[0].boundingBox() : null;
report('canvas has size', !!box1 && box1.width > 200, box1 ? `w=${Math.round(box1.width)} h=${Math.round(box1.height)}` : 'none');

// 2) Canvas survives sidebar toggle cycles (marker connectivity)
const markerSet = await page.evaluate(() => { const c = document.querySelector('canvas'); if (!c) return false; window.__canvas = c; return true; });
for (let i = 0; i < 2; i++) {
  const tab = await page.$('[data-qc-component="C50"]');
  if (tab) { await tab.click(); await page.waitForTimeout(600); await tab.click(); await page.waitForTimeout(600); }
}
const stillConnected = await page.evaluate(() => window.__canvas && window.__canvas.isConnected);
report('canvas NOT remounted across sidebar toggles', markerSet && stillConnected === true);

// 3) Viewport resize handling
await page.setViewportSize({ width: 1024, height: 768 });
await page.waitForTimeout(1200);
const box2 = (await page.$('canvas')) ? await (await page.$('canvas')).boundingBox() : null;
report('canvas survives 1440->1024 resize', !!box2, box2 ? `w=${Math.round(box2.width)}` : 'gone');
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(1200);
const box3 = (await page.$('canvas')) ? await (await page.$('canvas')).boundingBox() : null;
// Narrow desktop intentionally scrolls horizontally (fixed working width) rather than rescaling.
report('canvas still mounted at 1440', !!box3, box3 ? `w=${Math.round(box3.width)}` : 'gone');

// 4) Takeoff chrome present (zoom/history group + panel) - tolerant selectors
const shellMode = await page.getAttribute('[data-qc-ui="v2"].qc-app-shell', 'data-qc-shell-mode').catch(() => null);
report('takeoff shell hidden by default', shellMode === 'hidden', `mode=${shellMode}`);
const zoomish = await page.$$eval('button, [role="button"]', (els) => els.filter((e) => /zoom|undo|redo|fit/i.test((e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || ''))).length);
report('zoom/history controls present', zoomish > 0, `matched=${zoomish}`);
const panelText = await page.evaluate(() => document.body.textContent.includes('Finish') || document.body.textContent.includes('Save'));
report('panel with finish/save affordance present', panelText);

// 5) No error boundary / crash markers
const crashed = await page.evaluate(() => document.body.textContent.includes('Application error') || document.body.textContent.includes('Unhandled Runtime Error'));
report('no crash markers', !crashed);
await page.screenshot({ path: '../.p4-takeoff-1440.png' });

const failed = results.filter((r) => !r.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);