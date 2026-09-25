// Full-app AI scan repro: provisions throwaway fixtures in Supabase, drives the
// real takeoff page in Chromium with a minted session, runs the desktop staged
// AI scan, and probes the AiResultsModal Apply button clickability.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
try {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}

import { chromium } from '@playwright/test';
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const sharp = require('sharp');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3210';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'QUOTE-DOCUMENTS';
const AUTH_COOKIE = 'sb-qcp-auth';

const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`sr ${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);

async function createAuthUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`createAuthUser: ${JSON.stringify(j).slice(0, 200)}`);
  return j.user?.id ?? j.id;
}
async function signIn(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

// Gable roof plan SVG: outer walls, ridge, hips, dimension line with arrows + text
function roofPlanSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800">
  <rect width="1000" height="800" fill="#ffffff"/>
  <rect x="150" y="150" width="700" height="500" fill="none" stroke="#111" stroke-width="5"/>
  <line x1="150" y1="400" x2="850" y2="400" stroke="#111" stroke-width="4"/>
  <line x1="150" y1="150" x2="150" y2="650" stroke="#111" stroke-width="2" stroke-dasharray="8 6"/>
  <line x1="850" y1="150" x2="850" y2="650" stroke="#111" stroke-width="2" stroke-dasharray="8 6"/>
  <line x1="150" y1="730" x2="850" y2="730" stroke="#111" stroke-width="2"/>
  <polygon points="150,722 160,730 150,738" fill="#111"/>
  <polygon points="850,722 840,730 850,738" fill="#111"/>
  <text x="460" y="758" font-family="monospace" font-size="26" fill="#000">14.0 m</text>
  <line x1="920" y1="150" x2="920" y2="650" stroke="#111" stroke-width="2"/>
  <polygon points="912,150 920,160 928,150" fill="#111"/>
  <polygon points="912,650 920,640 928,650" fill="#111"/>
  <text x="930" y="410" font-family="monospace" font-size="26" fill="#000">10.0 m</text>
  <text x="160" y="120" font-family="monospace" font-size="24" fill="#000">RIDGE</text>
</svg>`;
}

const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const EMAIL = `qcp-ai-repro-${RUN}@example.com`;
const PASSWORD = `Hx9-${RUN}-ai!`;
let companyId, slug, uid, quoteId, sessionId, pageId, storagePath;

async function cleanup() {
  console.log('\ncleanup...');
  const errs = [];
  try { if (companyId) await sr('DELETE', `/rest/v1/companies?id=eq.${companyId}`); } catch (e) { errs.push(e.message); }
  try { if (uid) await fetch(`${SUPA_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: srH }); } catch (e) { errs.push(e.message); }
  try { if (storagePath) await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${storagePath}`, { method: 'DELETE', headers: srH }); } catch (e) { errs.push(e.message); }
  console.log(errs.length ? 'warnings: ' + errs.join(' | ') : 'fixtures removed');
}

try {
  const nowIso = new Date().toISOString();
  slug = `qcp-ai-repro-${RUN}`;
  [{ id: companyId }] = await srInsert('companies', { name: `AI Repro ${RUN}`, slug, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
  uid = await createAuthUser(EMAIL, PASSWORD);
  await srInsert('users', { id: uid, company_id: companyId, email: EMAIL, full_name: 'AI Repro', role: 'owner' });
  console.log(`company=${companyId} user=${uid}`);

  [{ id: quoteId }] = await srInsert('quotes', { company_id: companyId, quote_number: Math.floor(Math.random() * 900000) + 100000, customer_name: 'AI Repro Cust', status: 'draft', measurement_system: 'metric' });
  const png = await sharp(Buffer.from(roofPlanSvg())).png().toBuffer();
  storagePath = `${companyId}/${quoteId}/RoofPlan-${RUN}.png`;
  const up = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${storagePath}`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: png });
  if (!(up.status === 200 || up.status === 201)) throw new Error(`upload ${up.status}`);
  await srInsert('quote_files', { company_id: companyId, quote_id: quoteId, file_type: 'plan', file_name: `RoofPlan-${RUN}.png`, file_size: png.length, mime_type: 'image/png', storage_path: storagePath, uploaded_by: uid, uploaded_at: nowIso });
  // NOTE: no takeoff_sessions/takeoff_pages seeded - ensurePage1 creates the page
  // client-side on mount, matching the real Measure-a-job first-load state.
  console.log(`quote=${quoteId}`);

  const session = await signIn(EMAIL, PASSWORD);
  const encoded = 'base64-' + stringToBase64URL(JSON.stringify(session));
  const cookies = createChunks(AUTH_COOKIE, encoded).map(c => ({ name: c.name, value: c.value, url: BASE_URL }));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)); });

  const takeoffUrl = `${BASE_URL}/${slug}/quotes/${quoteId}/takeoff`;
  console.log('goto', takeoffUrl);
  await page.goto(takeoffUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  console.log('url after load:', page.url());

  // Inventory of buttons/dialogs
  const bodyText = await page.locator('body').innerText();
  console.log('has AI Assist button:', bodyText.includes('AI Assist'));
  console.log('has calibrate text:', /calibrat/i.test(bodyText));
  // note: cookie banner stays (blocked by modal); clicks target mid-canvas anyway
  await page.screenshot({ path: 'scripts/ai-repro-1-load.png' });

  const dumpDialogs = async (label) => {
    const dialogs = await page.evaluate(() => Array.from(document.querySelectorAll('dialog')).map(d => ({
      cls: d.className.slice(0, 50), open: d.open,
      rect: (() => { const r = d.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    })));
    console.log(`[dialogs ${label}]`, JSON.stringify(dialogs));
  };
  await dumpDialogs('initial');

  // Try to reach the AI scan. Path A: instructions dialog auto-opened.
  let aiBtn = page.getByRole('button', { name: /AI Assist \(BETA\)/ });
  // Calibration flow like Shaun: Start calibration -> 2 canvas clicks -> distance modal -> confirm
  const startCal = page.getByRole('button', { name: 'Start calibration' });
  if (await startCal.count()) {
    console.log('clicking Start calibration...');
    await startCal.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'scripts/ai-repro-2-calibmode.png' });
    // click two points along the bottom dimension line of the canvas
    const cv = page.locator('canvas').first();
    const cb = await cv.boundingBox();
    console.log('canvas box:', JSON.stringify(cb));
    if (cb) {
      // keep clicks inside the visible viewport (canvas may extend below)
      const y1 = Math.min(cb.y + cb.height * 0.55, 840);
      await page.mouse.click(cb.x + cb.width * 0.35, y1);
      await page.waitForTimeout(500);
      await page.mouse.click(cb.x + cb.width * 0.65, y1);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'scripts/ai-repro-3-distmodal.png' });
      await dumpDialogs('after 2 points');
      // distance entry modal - find number input in dialog and fill 14, then confirm
      const distInput = page.locator('dialog input[type=number]').first();
      if (await distInput.count()) {
        await distInput.fill('14');
        const confirmBtn = page.locator('dialog button', { hasText: /confirm|ok|set|save|apply/i }).first();
        const confirmTxt = await confirmBtn.textContent().catch(() => null);
        console.log('distance modal confirm button:', confirmTxt);
        if (confirmTxt) await confirmBtn.click();
        await page.waitForTimeout(800);
      } else {
        console.log('no distance modal appeared - dump dialogs and inputs');
        console.log((await page.locator('body').innerText()).slice(0, 800).replace(/\n/g, ' | '));
      }
      await page.screenshot({ path: 'scripts/ai-repro-4-postcal.png' });
    }
  } else {
    console.log('Start calibration button not found');
  }
  // wait for instructions dialog (1.5s delay after calibration confirm)
  await page.waitForTimeout(1200);
  // Confirm Calibration (sidebar button) completes calibration
  const confirmCal = page.getByRole('button', { name: 'Confirm Calibration' });
  if (await confirmCal.count()) {
    console.log('clicking Confirm Calibration...');
    await confirmCal.click();
  } else {
    console.log('Confirm Calibration button not found');
  }
  await page.waitForTimeout(2500);
  await dumpDialogs('post-confirm');
  await page.screenshot({ path: 'scripts/ai-repro-5-instructions.png' });
  aiBtn = page.getByRole('button', { name: /AI Assist \(BETA\)/ });

  if (await aiBtn.count()) {
    console.log('clicking AI Assist...');
    await aiBtn.first().click();
    // wait for the results modal (scan1 can take a while)
    const results = page.getByRole('heading', { name: 'AI Assist Results' });
    try {
      await results.waitFor({ timeout: 90000 });
      console.log('RESULTS MODAL VISIBLE');
    } catch {
      console.log('results modal did NOT appear');
      await page.screenshot({ path: 'scripts/ai-repro-3-noresults.png' });
      console.log('body:', (await page.locator('body').innerText()).slice(0, 600).replace(/\n/g, ' | '));
      throw new Error('no results modal');
    }
    await page.waitForTimeout(800);
    await dumpDialogs('results');
    await page.screenshot({ path: 'scripts/ai-repro-3-results.png' });

    // Fill name + pitch
    const nameInput = page.getByLabel('Name of AI area 1');
    const pitchInput = page.getByLabel(/Pitch of AI area 1/);
    console.log('name input count:', await nameInput.count(), 'pitch input count:', await pitchInput.count());
    await nameInput.fill('Main Roof');
    await pitchInput.fill('25');
    await page.locator('dialog input[type=checkbox]').check();
    await page.waitForTimeout(300);

    const apply = page.getByRole('button', { name: 'Apply to Canvas' });
    console.log('apply disabled attr:', await apply.getAttribute('disabled'));
    const ab = await apply.boundingBox();
    if (ab) {
      const hit = await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return 'NULL';
        const tag = el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).slice(0, 60);
        const dlg = el.closest('dialog');
        return `hit=${tag} inDialog=${!!dlg} dlgOpen=${dlg ? dlg.open : '-'}`;
      }, [ab.x + ab.width / 2, ab.y + ab.height / 2]);
      console.log('elementFromPoint at Apply centre:', hit);
      console.log('apply box:', JSON.stringify(ab), 'viewport:', page.viewportSize());
    }
    try {
      await apply.click({ timeout: 5000 });
      console.log('CLICK DISPATCHED on Apply');
    } catch (e) {
      console.log('CLICK FAILED:', e.message.split('\n').slice(0, 2).join(' / '));
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'scripts/ai-repro-4-after-apply.png' });
    const after = await page.locator('body').innerText();
    console.log('modal still open after click:', await page.getByRole('heading', { name: 'AI Assist Results' }).count() > 0);
    console.log('outline applied banner:', after.includes('AI outline applied'));
    console.log('any error banner:', after.includes('Scan failed') || after.includes('failed'));
  } else {
    console.log('NO AI ENTRY FOUND - dumping visible text:');
    console.log((await page.locator('body').innerText()).slice(0, 1200).replace(/\n/g, ' | '));
  }
  console.log('--- page errors ---');
  errors.slice(0, 10).forEach(e => console.log(e));
  await browser.close();
} catch (e) {
  console.error('HARNESS ERROR:', e.message);
} finally {
  await cleanup();
}
