/**
 * SA P1.6 Universal Retrieval acceptance battery (2026-09-26).
 * Provisions throwaway companies (retrieval rollout on A/B, off C), rich
 * fixtures, then runs: direct-RPC security probes during a live admitted run,
 * real Luna accuracy cases, P1.5/P3 regression checks and latency benchmarks.
 * Never touches RS Roofing. Follows the P3 provisioner fixture contract.
 *
 * Subcommands: setup | rpc | luna | regression | bench | cleanup
 * State:   ../../.sa-p16-state.json (workspace, never committed)
 * Results: ../../.sa-p16-results.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

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

const BASE_URL = process.env.BASE_URL || 'https://quotecore-plus-testing.vercel.app';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATE_PATH = new URL('../../.sa-p16-state.json', import.meta.url).pathname.replace(/^\//, '');
const RESULTS_PATH = new URL('../../.sa-p16-results.json', import.meta.url).pathname.replace(/^\//, '');
if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(2); }

const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const AUTH_COOKIE = 'sb-qcp-auth';
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`service-role ${method} ${path} -> ${r.status}: ${String(text).slice(0, 400)}`);
  return json;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);
const srPatch = (table, patch, query) => sr('PATCH', `/rest/v1/${table}?${query}`, patch);
const srDelete = (table, query) => sr('DELETE', `/rest/v1/${table}?${query}`);
async function createAuthUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`createAuthUser -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.user?.id ?? j.id;
}
async function deleteAuthUser(id) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: srH });
  if (!r.ok) console.error(`deleteAuthUser ${id} -> ${r.status}`);
}
async function signIn(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
const sessionCookieHeader = (session) =>
  createChunks(AUTH_COOKIE, 'base64-' + stringToBase64URL(JSON.stringify(session))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');

async function app(method, path, cookie, body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: BASE_URL } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(180000),
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j };
}
async function turn(cookie, conversationId, message, companyId, pathname) {
  const started = Date.now();
  const r = await app('POST', '/api/smart-assistant/turn', cookie, {
    conversationId, message, clientRequestId: randomUUID(),
    pageContext: { companyId, pathname },
  });
  const ms = Date.now() - started;
  if (r.status !== 200 || r.body?.status !== 'completed') throw new Error(`turn "${message}" -> ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return { body: r.body, ms };
}
async function readSession(cookie, conversationId) {
  const r = await app('GET', `/api/smart-assistant/v2/session?conversationId=${conversationId}`, cookie);
  if (r.status !== 200) throw new Error(`session read -> ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}
// Authenticated RPC probe (user JWT, normal PostgREST path).
async function rpcProbe(accessToken, fn, args) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (Array.isArray(json)) json = json[0] ?? null; // PostgREST wraps RPC results in an array
  let message = '';
  if (!r.ok) message = (json?.message ?? text ?? '').slice(0, 300);
  return { status: r.status, ok: r.ok, data: json, message, raw: text.slice(0, 400) };
}
async function anonRpc(fn, args) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
  });
  return { status: r.status, ok: r.ok, text: (await r.text()).slice(0, 200) };
}
function readState() { try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; } }
function writeState(s) { writeFileSync(STATE_PATH, JSON.stringify(s, null, 2)); }
function readResults() { try { return JSON.parse(readFileSync(RESULTS_PATH, 'utf8')); } catch { return { probes: [], luna: [], regression: [], bench: [] }; } }
function writeResults(r) { writeFileSync(RESULTS_PATH, JSON.stringify(r, null, 2)); }

const cmd = process.argv[2] ?? '';

// ── setup ─────────────────────────────────────────────────────────
if (cmd === 'setup') {
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nowIso = new Date().toISOString();
  const PWD = `Hx9-${run}-p16!`;
  const state = { run };
  console.log(`setup run=${run} base=${BASE_URL}`);

  const [coA] = await srInsert('companies', { name: `QCP P16 E2E ${run}`, slug: `qcp-p16-e2e-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active', default_currency: 'NZD' });
  const [coB] = await srInsert('companies', { name: `QCP P16 Foreign ${run}`, slug: `qcp-p16-foreign-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active', default_currency: 'NZD' });
  const [coC] = await srInsert('companies', { name: `QCP P16 NoRet ${run}`, slug: `qcp-p16-noret-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active', default_currency: 'NZD' });
  const uidA = await createAuthUser(`qcp-p16-a-${run}@example.com`, PWD);
  const uidB = await createAuthUser(`qcp-p16-b-${run}@example.com`, PWD);
  const uidC = await createAuthUser(`qcp-p16-c-${run}@example.com`, PWD);
  await srInsert('users', [
    { id: uidA, company_id: coA.id, email: `qcp-p16-a-${run}@example.com`, full_name: 'P16 E2E A', role: 'owner' },
    { id: uidB, company_id: coB.id, email: `qcp-p16-b-${run}@example.com`, full_name: 'P16 E2E B', role: 'owner' },
    { id: uidC, company_id: coC.id, email: `qcp-p16-c-${run}@example.com`, full_name: 'P16 E2E C', role: 'owner' },
  ]);
  await srInsert('assistant_feature_flags', [{ company_id: coA.id, enabled: true }, { company_id: coB.id, enabled: true }, { company_id: coC.id, enabled: true }]);
  const rollout = (cid) => ({ company_id: cid, p1: true, p2: true, p3: true, p4: false, write_policy: 'propose_then_confirm', confirmation_policy: 'requester_button', ledger_policy: 'retain_action_fields', enabled_at: nowIso });
  await srInsert('assistant_v2_rollout', [rollout(coA.id), rollout(coB.id), rollout(coC.id)]);
  await srInsert('assistant_v2_retrieval_rollout', [
    { company_id: coA.id, enabled: true, knowledge_enabled: false },
    { company_id: coB.id, enabled: true, knowledge_enabled: false },
  ]);
  await srInsert('assistant_section_permissions', { company_id: coA.id, permissions: { quotes: 'edit', draft_quotes: 'edit', orders: 'read_only', invoices: 'read_only', components: 'edit', customers: 'read_only', emails: 'hidden', billing: 'hidden', settings: 'hidden' }, revision: 1, updated_by: uidA });
  Object.assign(state, { coA: coA.id, coB: coB.id, coC: coC.id, uidA, uidB, uidC, pwd: PWD, emailA: `qcp-p16-a-${run}@example.com`, emailB: `qcp-p16-b-${run}@example.com`, emailC: `qcp-p16-c-${run}@example.com`, revision: 1 });
  writeState(state);
  console.log(`companies A=${coA.id} B=${coB.id} C=${coC.id} (C has NO retrieval row)`);

  const qNum = () => Math.floor(Math.random() * 900000) + 100000;
  const quote = (over) => ({ company_id: coA.id, quote_number: qNum(), measurement_system: 'metric', currency: 'NZD', created_by_user_id: uidA, ...over });
  const [q1] = await srInsert('quotes', quote({ customer_name: 'John Smith', job_name: 'Maple Ridge Roof Repair', status: 'sent', viewed_at: nowIso }));
  const [q2] = await srInsert('quotes', quote({ customer_name: 'Jane Doe', job_name: 'Maple Ridge Roof Repair', status: 'draft' }));
  const [q3] = await srInsert('quotes', quote({ customer_name: 'Test Owner', job_name: '9th canvas test', status: 'draft' }));
  const [q4] = await srInsert('quotes', quote({ customer_name: 'Ann Lee', job_name: 'Chelsea Flat Gutters', status: 'sent', currency: 'GBP' }));
  const [q5] = await srInsert('quotes', quote({ customer_name: 'Bob Ngata', job_name: 'Ponsonby Villa Reroof', status: 'sent' }));
  const [q6] = await srInsert('quotes', quote({ customer_name: 'Carol Ford', job_name: 'Remuera Sleepout', status: 'sent' }));
  const [qB1] = await srInsert('quotes', { company_id: coB.id, quote_number: qNum(), customer_name: 'Mike Brown', job_name: 'Foreign Only Quote', status: 'sent', measurement_system: 'metric', currency: 'NZD', created_by_user_id: uidB });
  const comp = (quoteId, over) => srInsert('quote_components', { quote_id: quoteId, ...over });
  const [c1] = await comp(q1.id, { name: 'Ridge', measurement_type: 'lineal', final_quantity: 12, material_rate: 25, labour_rate: 5, material_cost: 300, labour_cost: 60 });
  const [c2] = await comp(q1.id, { name: 'Gutter', measurement_type: 'lineal', final_quantity: 8, material_rate: 5, labour_rate: 2, material_cost: 40, labour_cost: 16 });
  const [c3] = await comp(q2.id, { name: 'Ridge', measurement_type: 'lineal', final_quantity: 10, material_rate: 0, labour_rate: 0, material_cost: 0, labour_cost: 0 });
  const [c4] = await comp(q3.id, { name: 'Ridge', measurement_type: 'lineal', final_quantity: 11, material_rate: 0, labour_rate: 0, material_cost: 0, labour_cost: 0 });
  await srInsert('quote_component_entries', { quote_component_id: c4.id, raw_value: 10.5, value_after_waste: 11 });
  await srInsert('quote_roof_areas', { quote_id: q1.id, label: 'Main Roof', computed_sqm: 100 });
  await srInsert('customer_quote_lines', [
    { quote_id: q1.id, custom_text: 'Supply and install ridge', custom_amount: 500, line_type: 'custom', is_visible: true, include_in_total: true, sort_order: 0 },
    { quote_id: q1.id, custom_text: 'Scaffolding', custom_amount: 250, line_type: 'custom', is_visible: true, include_in_total: true, sort_order: 1 },
  ]);
  await srInsert('quote_taxes', { quote_id: q1.id, name: 'GST', rate_percent: 15, include_in_quote: true, include_in_labor: false, sort_order: 0 });
  const [inv1] = await srInsert('invoices', { company_id: coA.id, invoice_number: `INV-1001-${run}`, payment_reference: 'none', customer_name: 'John Smith', status: 'sent', due_date: '2026-09-01', total: 1150, currency: 'NZD', user_id: uidA });
  const [inv2] = await srInsert('invoices', { company_id: coA.id, invoice_number: `INV-1002-${run}`, payment_reference: 'none', customer_name: 'Ann Lee', status: 'sent', due_date: '2026-10-30', total: 500, currency: 'GBP', user_id: uidA });
  const [ord1] = await srInsert('material_orders', { company_id: coA.id, order_number: `PO-A1-${run}`, supplier_name: 'Plumbing World', job_name: 'Maple Ridge Roof Repair', status: 'ordered', is_sent: true, quote_id: q1.id });
  await srInsert('material_order_lines', [
    { order_id: ord1.id, item_name: 'Ridge Cap 3m', quantity: 12, unit: 'each' },
    { order_id: ord1.id, item_name: 'Screws Box', quantity: 4, unit: 'each' },
  ]);
  await srInsert('material_orders', { company_id: coA.id, order_number: `PO-A2-${run}`, supplier_name: 'Mitre 10', job_name: 'Chelsea Flat Gutters', status: 'ready', is_sent: false, layout_mode: 'line_by_line', line_by_line_data: { lines: [{ text: 'Flashing 3m', quantity: '6', amount: '90' }, { text: 'Screws box', quantity: '2', amount: '30' }] } });
  const [coll] = await srInsert('component_collections', { company_id: coA.id, name: 'Roofing Bits', currency: 'NZD' });
  await srInsert('component_library', { company_id: coA.id, name: 'Ridge Cap 3m', sku: `RC3-${run}`, measurement_type: 'lineal', default_material_rate: 8, default_labour_rate: 2, collection_id: coll.id });
  const [cat] = await srInsert('catalogs', { company_id: coA.id, name: 'Mitre 10 Prices', status: 'ready', default_currency: 'NZD', row_count: 3, original_filename: 'mitre10.csv', column_mapping: { description: '0', price: '1', quantity: '2' } });
  await srInsert('catalog_rows', [
    { catalog_id: cat.id, company_id: coA.id, row_index: 0, raw_row: { 0: 'Ridge Cap 3m', 1: '45.00', 2: '10' }, search_text: 'ridge cap 3m 45.00' },
    { catalog_id: cat.id, company_id: coA.id, row_index: 1, raw_row: { 0: 'Gutter 4m', 1: '32.50', 2: '8' }, search_text: 'gutter 4m 32.50' },
    { catalog_id: cat.id, company_id: coA.id, row_index: 2, raw_row: { 0: 'Flashing roll', 1: '78.00', 2: '2' }, search_text: 'flashing roll 78.00' },
  ]);
  const conversationId = randomUUID();
  const conversationC = randomUUID();
  await srInsert('smart_assistant_conversations', [{ id: conversationId, company_id: coA.id, user_id: uidA }, { id: conversationC, company_id: coC.id, user_id: uidC }]);
  const sessA = await signIn(state.emailA, PWD);
  const sessB = await signIn(state.emailB, PWD);
  const sessC = await signIn(state.emailC, PWD);
  Object.assign(state, {
    conversationId, conversationC, convRpc: randomUUID(),
    q1: q1.id, q2: q2.id, q3: q3.id, q4: q4.id, q5: q5.id, q6: q6.id, qB1: qB1.id,
    c1: c1.id, ord1: ord1.id, inv1: inv1.id, inv2: inv2.id,
    cookieA: sessionCookieHeader(sessA), cookieB: sessionCookieHeader(sessB), cookieC: sessionCookieHeader(sessC),
    tokenA: sessA.access_token, tokenB: sessB.access_token, tokenC: sessC.access_token,
  });
  await srInsert('smart_assistant_conversations', [{ id: state.convRpc, company_id: coA.id, user_id: uidA }]);
  writeState(state);
  console.log(`fixtures q1=${q1.id} q2(dup)=${q2.id} q3(draft)=${q3.id} q4(GBP)=${q4.id} qB1=${qB1.id}`);
  console.log(`conversations A=${conversationId} rpc=${state.convRpc} C=${conversationC}`);
  console.log('setup complete');
  process.exit(0);
}

// ── rpc: direct authenticated probes during a live admitted run ───
if (cmd === 'rpc') {
  const s = readState();
  const results = [];
  const rev = s.revision ?? 1;
  const rev0 = () => s.revision ?? 1;
  const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + String(detail).slice(0, 220) : ''}`); };

  // Create a live admitted run: fire a heavy multi-tool turn, catch the run row while active.
  const convId = randomUUID();
  await srInsert('smart_assistant_conversations', { id: convId, company_id: s.coA, user_id: s.uidA });
  const turnPromise = turn(s.cookieA, convId, 'Summarise my quotes, material orders and invoices with their totals', s.coA, `/${s.run}/quotes`).catch((e) => ({ error: e.message }));
  let runId = null, runStatus = null;
  for (let i = 0; i < 60 && !runId; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const rows = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status,tokens_in,tokens_out&order=started_at.desc&limit=1`);
    if (rows && rows.length && rows[0].status !== 'completed' && rows[0].status !== 'failed') { runId = rows[0].id; runStatus = rows[0].status; }
  }
  if (!runId) {
    // Turn may have finished too fast; use the last completed run's id for finished-run probes only.
    const rows = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`);
    runId = rows?.[0]?.id ?? null;
    record('live-run-capture', false, 'no in-flight run captured; fallback to finished run ' + runId);
  } else {
    record('live-run-capture', true, `runId=${runId} status=${runStatus}`);
    // Wait until the run scope is bound (capabilities succeeds) before probing.
    let bound = false;
    for (let i = 0; i < 40 && !bound; i++) {
      const c = await rpcProbe(s.tokenA, 'sa_v2_retrieval_capabilities', { p_run_id: runId, p_revision: rev0() });
      if (c.ok) bound = true; else await new Promise((r2) => setTimeout(r2, 400));
    }
    record('run-scope-bound', bound, bound ? 'capabilities responded OK' : 'scope never bound before timeout');
  }

  const q = (plan) => rpcProbe(s.tokenA, 'sa_v2_retrieval_query', { p_run_id: runId, p_revision: rev, p_plan: plan });
  const rowsOf = (d) => Array.isArray(d?.rows) ? d.rows : [];

  // 1. capabilities
  const cap = await rpcProbe(s.tokenA, 'sa_v2_retrieval_capabilities', { p_run_id: runId, p_revision: rev });
  record('capabilities-enabled', cap.ok && cap.data?.enabled === true && cap.data?.knowledge_enabled === false && typeof cap.data?.schema_hash === 'string', JSON.stringify(cap.data)?.slice(0, 160));

  // 2. tenant isolation: search Maple returns only A rows
  const r2 = await q({ version: 1, source: 'quotes', mode: 'rows', search: { text: 'Maple Ridge', match: 'words' }, limit: 10 });
  const names2 = rowsOf(r2.data).map((x) => x.job_name);
  record('isolation-search-maple', r2.ok && names2.length === 2 && names2.every((n) => n === 'Maple Ridge Roof Repair'), `rows=${names2.length} ${names2.join('|')}`);

  // 3. foreign data invisible via search
  const r3 = await q({ version: 1, source: 'quotes', mode: 'rows', search: { text: 'Foreign Only Quote', match: 'exact' }, limit: 10 });
  record('isolation-foreign-search-empty', r3.ok && rowsOf(r3.data).length === 0, `rows=${rowsOf(r3.data).length}`);

  // 4+5. direct foreign ID vs random ID indistinguishable
  const mk = (id) => q({ version: 1, source: 'quotes', mode: 'rows', filters: [{ field: 'id', op: 'eq', value: id }], limit: 5 });
  const r4 = await mk(s.qB1);
  const r5 = await mk(randomUUID());
  record('isolation-foreign-id-empty', r4.ok && rowsOf(r4.data).length === 0, `rows=${rowsOf(r4.data).length}`);
  record('isolation-random-id-indistinguishable', r4.ok && r5.ok && r4.status === r5.status && JSON.stringify(r4.data?.rows).length === JSON.stringify(r5.data?.rows).length, `shape equal`);

  // 6-15. forged plan rejection
  const rejects = [
    ['unknown-field', { version: 1, source: 'quotes', mode: 'rows', fields: ['evil'] }],
    ['tenant-key', { version: 1, source: 'quotes', mode: 'rows', company_id: s.coB }],
    ['dotted-field', { version: 1, source: 'quotes', mode: 'rows', fields: ['q.quote_number'] }],
    ['proto-field', { version: 1, source: 'quotes', mode: 'rows', filters: [{ field: '__proto__', op: 'eq', value: 'x' }] }],
    ['limit-21', { version: 1, source: 'quotes', mode: 'rows', limit: 21 }],
    ['aggregate-no-metrics', { version: 1, source: 'quotes', mode: 'aggregate', groupBy: ['status'] }],
    ['sum-text-metric', { version: 1, source: 'quotes', mode: 'aggregate', metrics: [{ field: 'customer_name', op: 'sum' }] }],
    ['source-injection', { version: 1, source: 'quotes; DROP TABLE companies', mode: 'rows' }],
    ['source-infoschema', { version: 1, source: 'information_schema.tables', mode: 'rows' }],
    ['sql-in-search', { version: 1, source: 'quotes', mode: 'rows', search: { text: "'; DROP TABLE quotes;--", match: 'exact' } }],
    // NOTE sql-in-search asserts 200+0 rows below: parameterised literal text, never executed SQL.
    ['knowledge-off-source', { version: 1, source: 'knowledge_documents', mode: 'rows' }],
    ['nested-json-filter', { version: 1, source: 'quotes', mode: 'rows', filters: [{ field: 'customer_name', op: 'eq', value: { a: { b: 'c' } } }] }],
  ];
  for (const [name, plan] of rejects) {
    const r = await q(plan);
    if (name === 'sql-in-search') {
      // Correct property: parameterised literal text - 200 with zero rows, never executed.
      const rows = Array.isArray(r.data?.rows) ? r.data.rows : [];
      record('reject-sql-in-search', r.ok && rows.length === 0, `status=${r.status} rows=${rows.length} (literal search, no injection surface)`);
      continue;
    }
    const msg = (r.message || '').toLowerCase();
    const denied = !r.ok && /unsupported|invalid|knowledge_disabled|feature_disabled|denied|22023|p1601|p1603|p1604/.test(msg + ' ' + r.status);
    record('reject-' + name, denied, `${r.status} ${r.message.slice(0, 120)}`);
  }
  // sql-in-search may legitimately return 0 rows rather than error: verify no crash either way handled above; extra check: search with control chars must fail validation
  const rCtrl = await q({ version: 1, source: 'quotes', mode: 'rows', search: { text: 'abc\x00def', match: 'exact' } });
  record('reject-control-chars', !rCtrl.ok, `${rCtrl.status} ${rCtrl.message.slice(0, 80)}`);

  // 16. engine aggregate over sent quotes
  const r16 = await q({ version: 1, source: 'quotes', mode: 'aggregate', quoteScope: 'quotes', metrics: [{ field: 'builder_total', op: 'sum' }] });
  const eng = r16.data?.mode === 'engine_inputs';
  record('engine-aggregate-builder-total', r16.ok && eng && r16.data?.complete === true && rowsOf(r16.data).length <= 200, `mode=${r16.data?.mode} complete=${r16.data?.complete}`);

  // 17-19. cross-user/company + stale revision
  const r17 = await rpcProbe(s.tokenB, 'sa_v2_retrieval_query', { p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('deny-foreign-user-jwt', !r17.ok, `${r17.status} ${r17.message.slice(0, 120)}`);
  const r18 = await rpcProbe(s.tokenC, 'sa_v2_retrieval_query', { p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('deny-noretrieval-user-jwt', !r18.ok, `${r18.status} ${r18.message.slice(0, 120)}`);
  const r19 = await rpcProbe(s.tokenA, 'sa_v2_retrieval_query', { p_run_id: runId, p_revision: rev + 500, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('deny-stale-revision', !r19.ok, `${r19.status} ${r19.message.slice(0, 120)}`);

  // 20. anon + no auth
  const r20 = await anonRpc('sa_v2_retrieval_query', { p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('deny-anon-key', r20.status === 403 || r20.status === 401, `status=${r20.status}`);
  const r20b = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_retrieval_query`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } }) });
  record('deny-no-jwt', r20b.status === 403 || r20b.status === 401, `status=${r20b.status}`);

  // 22. resolve mode preserves duplicates as candidates
  const r22 = await q({ version: 1, source: 'quotes', mode: 'rows', resolve: true, search: { text: 'Maple Ridge Roof Repair', match: 'exact' }, limit: 10 });
  const res = r22.data;
  const resolution = res && typeof res === 'object' ? (res.resolution ?? res.resolve ?? null) : null;
  record('resolve-duplicate-candidates', r22.ok && (rowsOf(res).length === 2 || JSON.stringify(res).toLowerCase().includes('ambig')), `rows=${rowsOf(res).length} res=${JSON.stringify(resolution)?.slice(0, 100)}`);

  // 23. RPC-level draft-by-name (owner case)
  const r23 = await q({ version: 1, source: 'quotes', mode: 'rows', quoteScope: 'drafts', search: { text: '9th canvas test', match: 'exact' }, limit: 5 });
  record('draft-by-name', r23.ok && rowsOf(r23.data).length === 1 && rowsOf(r23.data)[0]?.job_name === '9th canvas test', `rows=${rowsOf(r23.data).length}`);

  // 24. related components semi-join (Ridge on quotes)
  const r24 = await q({ version: 1, source: 'quotes', mode: 'rows', related: [{ relation: 'components', filters: [{ field: 'name', op: 'eq', value: 'Ridge' }] }], limit: 10 });
  record('related-ridge-semijoin', r24.ok && rowsOf(r24.data).length === 3, `rows=${rowsOf(r24.data).length} (expect q1,q2,q3 once each)`);

  // 25. catalogue source (entitlement via pro plan)
  const r25 = await q({ version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'ridge cap', match: 'words' }, limit: 5 });
  record('catalogue-rows-search', r25.ok && rowsOf(r25.data).length === 1 && rowsOf(r25.data)[0]?.mapped_price_text === '45.00', `rows=${rowsOf(r25.data).length}`);

  // wait for the turn to finish, then confirm finished-run refusal
  const turnResult = await turnPromise;
  let finalStatus = null;
  for (let i = 0; i < 40; i++) {
    const rows = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`);
    if (rows?.[0]?.status === 'completed' || rows?.[0]?.status === 'failed') { finalStatus = rows[0].status; break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  record('live-turn-completed', finalStatus === 'completed', `status=${finalStatus} turn=${turnResult.error ? turnResult.error : turnResult.body?.reply?.slice(0, 80)}`);
  const r21 = await q({ version: 1, source: 'quotes', mode: 'rows', limit: 3 });
  record('deny-finished-run', !r21.ok, `${r21.status} ${r21.message.slice(0, 120)}`);

  // random nonexistent run
  const r26 = await rpcProbe(s.tokenA, 'sa_v2_retrieval_query', { p_run_id: randomUUID(), p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('deny-nonexistent-run', !r26.ok, `${r26.status} ${r26.message.slice(0, 120)}`);

  const res2 = readResults(); res2.probes = results; writeResults(res2);
  const fails = results.filter((x) => !x.ok).length;
  console.log(`rpc battery: ${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
}

// ── luna: real model accuracy cases ───────────────────────────────
if (cmd === 'luna') {
  const s = readState();
  const res = readResults();
  const convId = randomUUID();
  await srInsert('smart_assistant_conversations', { id: convId, company_id: s.coA, user_id: s.uidA });
  const cases = [
    { msg: 'How many quotes and drafts do I have in total?', check: (t) => /\b(6|six)\b/i.test(t) },
    { msg: 'Find my Maple Ridge Roof Repair quote', check: (t) => /smith|doe|two|2|which one|both/i.test(t) },
    { msg: "What's the builder total on the Maple Ridge Roof Repair quote for John Smith?", check: (t) => /NZD|\$/i.test(t) },
    { msg: 'Show me the Ridge component on my 9th canvas test draft', check: (t) => /ridge/i.test(t) && !/quote number/i.test(t) },
    { msg: 'How many Ridge components are there across all my quotes and drafts?', check: (t) => /\b3|three\b/i.test(t) },
    { msg: 'Which material orders link to the Maple Ridge quote for John Smith?', check: (t) => /plumbing world|PO-A1|ordered/i.test(t) },
    { msg: 'Which of my invoices are not paid yet?', check: (t) => /INV-1001|INV-1002|sent|two|2/i.test(t) },
    { msg: 'What can you help me with?', check: (t) => /quotes|drafts|orders|invoices|components/i.test(t) },
  ];
  for (const c of cases) {
    const t = await turn(s.cookieA, convId, c.msg, s.coA, `/${s.run}/quotes`);
    const snap = await readSession(s.cookieA, convId);
    const lastReply = snap.messages?.filter((m) => m.role === 'assistant').slice(-1)[0]?.content ?? '';
    const cards = (snap.cards ?? []).slice(-3).map((x) => x.content?.kind);
    const ok = c.check(lastReply || t.body?.reply || '');
    res.luna.push({ msg: c.msg, ms: t.ms, ok, reply: (lastReply || t.body?.reply || '').slice(0, 600), cards, tokensIn: null, tokensOut: null });
    console.log(`${ok ? 'PASS' : 'REVIEW'} (${t.ms}ms) ${c.msg}`);
    console.log(`   reply: ${(lastReply || t.body?.reply || '').slice(0, 220).replace(/\n/g, ' ')}`);
  }
  // token accounting from runs table
  const runs = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status,tokens_in,tokens_out&order=started_at.asc`);
  res.lunaRuns = runs;
  writeResults(res);
  const reviewCount = res.luna.filter((x) => !x.ok).length;
  console.log(`luna battery: ${res.luna.length - reviewCount}/${res.luna.length} passed checks; review ${reviewCount}`);
  process.exit(0);
}

// ── regression: P1.5 fast paths + P3 propose ──────────────────────
if (cmd === 'regression') {
  const s = readState();
  const res = readResults();
  const convId = randomUUID();
  await srInsert('smart_assistant_conversations', { id: convId, company_id: s.coA, user_id: s.uidA });
  const out = [];
  const record = (name, ok, detail) => { out.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} :: ${String(detail).slice(0, 200)}`); };

  const t1 = await turn(s.cookieA, convId, 'Open my latest quote', s.coA, `/${s.run}/quotes`);
  const runs1 = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=tokens_in,tokens_out,status&order=started_at.asc&limit=1`);
  record('p15-latest-quote-fast', t1.body?.reply && (runs1[0]?.tokens_in ?? 0) === 0, `ms=${t1.ms} tokens_in=${runs1[0]?.tokens_in} reply=${String(t1.body?.reply).slice(0, 90)}`);

  const conv2 = randomUUID();
  await srInsert('smart_assistant_conversations', { id: conv2, company_id: s.coA, user_id: s.uidA });
  const t2 = await turn(s.cookieA, conv2, 'How many quotes did I create this month?', s.coA, `/${s.run}/quotes`);
  const runs2 = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${conv2}&select=tokens_in,tokens_out&order=started_at.asc&limit=1`);
  record('p15-count-month-fast', (runs2[0]?.tokens_in ?? 0) === 0, `ms=${t2.ms} tokens_in=${runs2[0]?.tokens_in} reply=${String(t2.body?.reply).slice(0, 120)}`);

  const t3 = await turn(s.cookieA, conv2, 'Set the material rate on the Ridge component of my draft 9th canvas test to 25 per m', s.coA, `/${s.run}/quotes`);
  const snap = await readSession(s.cookieA, conv2);
  const proposed = (snap.actions ?? []).filter((x) => x.status === 'proposed');
  const rateProposals = proposed.filter((x) => JSON.stringify(x).match(/material_rate|rate/i));
  record('p3-propose-rate', rateProposals.length >= 1, `proposed=${proposed.length} titles=${proposed.map((x) => x.title).join(' / ')}`);

  const t4 = await turn(s.cookieC, s.conversationC, 'What can you help me with?', s.coC, `/${s.run}/quotes`);
  record('fallback-company-c-note', /P1\.6 retrieval is (disabled|not)/i.test(String(t4.body?.reply)), `reply=${String(t4.body?.reply).slice(0, 200)}`);

  res.regression = out; writeResults(res);
  const fails = out.filter((x) => !x.ok).length;
  console.log(`regression battery: ${out.length - fails}/${out.length} passed`);
  process.exit(fails ? 1 : 0);
}

// ── bench: latency measurements ───────────────────────────────────
if (cmd === 'bench') {
  const s = readState();
  const res = readResults();
  const cases = [
    { tag: 'fast-latest', msg: 'Open my latest quote' },
    { tag: 'one-model-fuzzy-draft', msg: 'What is the material rate on the Ridge component of my 9th canvas test draft?' },
    { tag: 'one-model-aggregate', msg: 'How many Ridge components are across my quotes and drafts?' },
    { tag: 'related-orders', msg: 'Which orders link to my Maple Ridge quote for John Smith?' },
  ];
  res.bench = [];
  for (const c of cases) {
    for (let i = 0; i < 3; i++) {
      const convId = randomUUID();
      await srInsert('smart_assistant_conversations', { id: convId, company_id: s.coA, user_id: s.uidA });
      const t = await turn(s.cookieA, convId, c.msg, s.coA, `/${s.run}/quotes`);
      const runs = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=tokens_in,tokens_out&order=started_at.asc&limit=1`);
      res.bench.push({ tag: c.tag, rep: i + 1, ms: t.ms, tokensIn: runs[0]?.tokens_in ?? null, tokensOut: runs[0]?.tokens_out ?? null });
      console.log(`${c.tag} #${i + 1}: ${t.ms}ms tokens=${runs[0]?.tokens_in ?? '?'}/${runs[0]?.tokens_out ?? '?'}`);
    }
  }
  writeResults(res);
  const summary = {};
  for (const b of res.bench) { (summary[b.tag] ??= []).push(b.ms); }
  for (const [tag, arr] of Object.entries(summary)) {
    const sorted = [...arr].sort((a, b) => a - b);
    console.log(`${tag}: p50=${sorted[Math.floor(sorted.length / 2)]}ms max=${sorted[sorted.length - 1]}ms reps=${arr.join(',')}`);
  }
  process.exit(0);
}

// ── cleanup ───────────────────────────────────────────────────────
if (cmd === 'cleanup') {
  const s = readState();
  if (!s.run) { console.error('No state'); process.exit(2); }
  const errs = [];
  const tables = ['assistant_v2_actions', 'sa_action_log', 'assistant_v2_cards', 'assistant_v2_context', 'smart_assistant_messages', 'smart_assistant_runs', 'assistant_turn_reservations', 'assistant_usage_events', 'assistant_events', 'smart_assistant_conversations', 'assistant_section_permissions', 'assistant_v2_retrieval_rollout', 'assistant_v2_rollout', 'assistant_feature_flags', 'catalog_rows', 'catalogs', 'component_library', 'component_collections', 'quote_component_entries', 'quote_components', 'quote_roof_areas', 'customer_quote_lines', 'quote_taxes', 'material_order_lines', 'material_orders', 'invoices', 'quotes'];
  for (const cid of [s.coA, s.coB, s.coC]) {
    if (!cid) continue;
    for (const t of tables) { try { await srDelete(t, `company_id=eq.${cid}`); } catch (e) { errs.push(`${t}: ${e.message.slice(0, 100)}`); } }
    try { await srDelete('invoice_lines', `company_id=eq.${cid}`); } catch {}
    try { await srDelete('users', `company_id=eq.${cid}`); } catch (e) { errs.push(`users: ${e.message.slice(0, 100)}`); }
    try { await srDelete('companies', `id=eq.${cid}`); } catch (e) { errs.push(`companies: ${e.message.slice(0, 100)}`); }
  }
  for (const [k, id] of [['A', s.uidA], ['B', s.uidB], ['C', s.uidC]]) if (id) { try { await deleteAuthUser(id); } catch (e) { errs.push(`auth${k}: ${e.message.slice(0, 100)}`); } }
  console.log(errs.length ? `cleanup finished with ${errs.length} notes:\n${errs.join('\n')}` : 'cleanup complete');
  process.exit(0);
}

console.error('usage: node scripts/test-sa-retrieval-acceptance.mjs setup|rpc|luna|regression|bench|cleanup');
process.exit(2);
