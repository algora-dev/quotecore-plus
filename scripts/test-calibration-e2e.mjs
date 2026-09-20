// AI calibration end-to-end test harness (local dev server, optional live).
// Run: node scripts/test-calibration-e2e.mjs              (local :3000)
//      BASE_URL=https://app.quote-core.com node scripts/test-calibration-e2e.mjs
//
// Provisions a throwaway company + auth user + calibration_feature_flags row
// (enabled), a minimal quote, a real PNG plan file in QUOTE-DOCUMENTS, a
// quote_files row (file_type='plan') and a takeoff_pages row with
// image_storage_path NULL (page-1 convention), then POSTs
// /api/takeoff/calibration {action:'search', round implicit 0} with the
// minted user cookie. Cleans up everything it created.
//
// Env (from .env.local or process env):
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//   BASE_URL (default http://localhost:3000)

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

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'QUOTE-DOCUMENTS'; // BUCKETS.QUOTE_DOCUMENTS

if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const sharp = require('sharp'); // repo dependency
const AUTH_COOKIE = 'sb-qcp-auth';

// ── service-role REST helpers ─────────────────────────────────────────────
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`service-role ${method} ${path} -> ${r.status}: ${text.slice(0, 400)}`);
  return json;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);
const srSelect = (table, query) => sr('GET', `/rest/v1/${table}?${query}`);
const srDelete = (table, query) => sr('DELETE', `/rest/v1/${table}?${query}`);

async function createAuthUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`createAuthUser -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.user?.id ?? j.id;
}
async function signIn(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
function sessionCookieHeader(session) {
  const encoded = 'base64-' + stringToBase64URL(JSON.stringify(session));
  return createChunks(AUTH_COOKIE, encoded).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
}

// ── synthetic roof-plan PNG (SVG -> sharp -> PNG) ──────────────────────────
async function makePlanPng() {
  const lines = [];
  for (let i = 1; i <= 8; i++) lines.push(`<line x1="${i * 90}" y1="60" x2="${i * 90}" y2="660" stroke="#333" stroke-width="3"/>`);
  for (let i = 1; i <= 6; i++) lines.push(`<line x1="60" y1="${i * 90}" x2="840" y2="${i * 90}" stroke="#333" stroke-width="3"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="720">
    <rect width="900" height="720" fill="#ffffff"/>
    ${lines.join('')}
    <text x="450" y="700" font-family="monospace" font-size="28" fill="#000">SCALE 1:100</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── main ──────────────────────────────────────────────────────────────────
const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const EMAIL = `qcp-cal-e2e-${RUN}@example.com`;
const PASSWORD = `Hx9-${RUN}-cal!`;
let companyId = null, uid = null, quoteId = null, pageId = null, storagePath = null, runIds = [];

async function cleanup() {
  console.log('\nCleanup...');
  const errs = [];
  try { if (companyId) await srDelete('calibration_runs', `company_id=eq.${companyId}`); } catch (e) { errs.push('ledger rows: ' + e.message); }
  try { if (companyId) await srDelete('companies', `id=eq.${companyId}`); } catch (e) { errs.push('company cascade: ' + e.message); }
  try { if (uid) await fetch(`${SUPA_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: srH }); } catch (e) { errs.push('auth user: ' + e.message); }
  try {
    if (storagePath) await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${storagePath}`, { method: 'DELETE', headers: srH });
  } catch (e) { errs.push('storage object: ' + e.message); }
  if (errs.length) console.log('  cleanup warnings:', errs.join(' | '));
  else console.log('  all fixtures removed (company cascade + auth user + storage object)');
}

async function main() {
  console.log(`AI calibration e2e harness -> ${BASE_URL}`);
  try { await fetch(BASE_URL, { method: 'HEAD' }); } catch {
    console.error(`Server not reachable at ${BASE_URL}. Start with: npm run dev`);
    process.exit(2);
  }

  // 1) Company + auth user + users row + calibration flag
  const nowIso = new Date().toISOString();
  [ { id: companyId } ] = await srInsert('companies', { name: `QCP Cal E2E ${RUN}`, slug: `qcp-cal-e2e-${RUN}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
  uid = await createAuthUser(EMAIL, PASSWORD);
  await srInsert('users', { id: uid, company_id: companyId, email: EMAIL, full_name: 'Cal E2E', role: 'owner' });
  await srInsert('calibration_feature_flags', { company_id: companyId, enabled: true });
  console.log(`fixtures: company=${companyId} user=${uid}`);

  // 2) Minimal quote (route only selects id/company_id)
  [ { id: quoteId } ] = await srInsert('quotes', {
    company_id: companyId, quote_number: Math.floor(Math.random() * 900000) + 100000, customer_name: 'Cal E2E Customer',
    status: 'draft', measurement_system: 'metric',
  });
  console.log(`quote=${quoteId}`);

  // 3) Upload a real PNG plan to QUOTE-DOCUMENTS + quote_files row
  const png = await makePlanPng();
  storagePath = `${companyId}/${quoteId}/RoofPlan-${RUN}.png`;
  {
    const r = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
      body: png,
    });
    if (!(r.status === 200 || r.status === 201)) throw new Error(`storage upload -> ${r.status}: ${await r.text()}`);
  }
  await srInsert('quote_files', {
    company_id: companyId, quote_id: quoteId, file_type: 'plan',
    file_name: `RoofPlan-${RUN}.png`, file_size: png.length, mime_type: 'image/png',
    storage_path: storagePath, uploaded_by: uid, uploaded_at: nowIso,
  });
  console.log(`plan uploaded: ${storagePath} (${png.length} bytes)`);

  // 4) takeoff session + page, image_storage_path NULL (page-1 convention)
  const [ { id: sessionId } ] = await srInsert('takeoff_sessions', { quote_id: quoteId });
  [ { id: pageId } ] = await srInsert('takeoff_pages', {
    session_id: sessionId, quote_id: quoteId, page_order: 1, page_name: 'Plan Page 1',
  });
  console.log(`page=${pageId} (image_storage_path NULL)`);

  // 5) Sign in + POST /api/takeoff/calibration
  const session = await signIn(EMAIL, PASSWORD);
  const cookie = sessionCookieHeader(session);
  const requestId = `e2e-${RUN}${Math.random().toString(36).slice(2, 10)}`;
  console.log(`POST /api/takeoff/calibration requestId=${requestId}`);
  const r = await fetch(`${BASE_URL}/api/takeoff/calibration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'search', quoteId, pageId, requestId }),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  console.log(`\n===== RESPONSE =====`);
  console.log(`status: ${r.status}`);
  console.log(`body:   ${text.slice(0, 1500)}`);

  // Check ledger admission for diagnostics
  try {
    const rows = await srSelect('calibration_runs', `company_id=eq.${companyId}&select=id,status,error_code,created_at`);
    console.log(`\nledger rows for company: ${JSON.stringify(rows)}`);
  } catch (e) { console.log(`ledger read failed: ${e.message}`); }

  process.exitCode = r.status >= 200 && r.status < 300 && json?.success === true ? 0 : 1;
}

main().catch(async (err) => {
  console.error('HARNESS ERROR:', err instanceof Error ? err.stack || err.message : err);
  process.exitCode = 2;
}).finally(cleanup);
