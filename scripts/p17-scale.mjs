/**
 * P1.7 scale acceptance: disposable company D with a 100,000-row catalogue and
 * 200/201-quote engine boundary sets. Subcommands: setup | probes | boundary | abort | cleanup
 * - setup: company D + user + rollout + catalogue (100k rows) + 200/201 quotes + admit run
 * - probes: EXPLAIN (ANALYZE, BUFFERS) on equivalent literal catalogue statements + timed v17 RPC calls
 * - boundary: v17 engine aggregate at 200 (complete) vs 201 (too_broad refusal)
 * - abort: caller-side abort during dense read; observe pg_stat_activity; re-fire
 * - cleanup: deletes company D fixtures (companies/rows cascade) + auth user
 * State: ../../.sa-p17-scale-state.json (workspace, never committed)
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.BASE_URL || 'https://quotecore-plus-testing.vercel.app';
const STATE_PATH = new URL('../../.sa-p17-scale-state.json', import.meta.url).pathname.replace(/^\//, '');
if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(2); }
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body, timeoutMs) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs ?? 120000) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`sr ${method} ${path} -> ${r.status}: ${String(text).slice(0, 300)}`);
  return json;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);
async function createAuthUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`createAuthUser -> ${r.status}`);
  return j.user?.id ?? j.id;
}
const signIn = async (email, password) => {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error('signIn ' + r.status);
  return j;
};
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const cookieOf = (s) => createChunks('sb-qcp-auth', 'base64-' + stringToBase64URL(JSON.stringify(s))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
async function rpc17(token, plan, timeoutMs) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_retrieval_query_v17`, {
    method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_run_id: state.runId, p_revision: 1, p_plan: plan }),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : AbortSignal.timeout(60000),
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (Array.isArray(json)) json = json[0] ?? null;
  return { status: r.status, ok: r.ok, data: json, message: json?.message ?? String(text).slice(0, 200) };
}
async function admitRun() {
  // fire a fresh heavy turn and capture its live run id (stays active during probes)
  const sess = await signIn(state.email, state.pwd);
  state.token = sess.access_token;
  state.cookie = cookieOf(sess);
  const convId = randomUUID();
  await srInsert('smart_assistant_conversations', { id: convId, company_id: state.coD, user_id: state.uidD });
  state.conversationId = convId; writeState(state);
  const turnP = fetch(`${BASE_URL}/api/smart-assistant/turn`, { method: 'POST', headers: { Cookie: state.cookie, 'Content-Type': 'application/json', Origin: BASE_URL }, body: JSON.stringify({ conversationId: convId, message: 'Summarise my quotes, material orders and invoices with their totals', clientRequestId: randomUUID(), pageContext: { companyId: state.coD, pathname: `/${state.run}/quotes` } }), signal: AbortSignal.timeout(180000) }).catch((e) => ({ err: e.message }));
  let runId = null;
  for (let i = 0; i < 60 && !runId; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const rows = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`);
    if (rows?.length && rows[0].status !== 'completed' && rows[0].status !== 'failed') runId = rows[0].id;
  }
  if (!runId) throw new Error('failed to capture live run');
  state.runId = runId; writeState(state);
  // poll a TRIVIAL query_v17 until it returns 200 = the read window is provably open
  let bound = false;
  for (let i = 0; i < 40 && !bound; i++) {
    const c = await rpc17(state.token, { version: 1, source: 'quotes', mode: 'rows', limit: 3 });
    if (c.ok) bound = true; else await new Promise((r2) => setTimeout(r2, 300));
  }
  console.log('live run admitted:', runId, 'query window open:', bound);
  if (!bound) throw new Error('query window never opened');
  return turnP;
}
const readState = () => { try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; } };
const writeState = (s) => writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
let state = readState();
const cmd = process.argv[2] ?? '';

if (cmd === 'setup') {
  const run = Date.now().toString(36);
  const nowIso = new Date().toISOString();
  const PWD = `Hs7-${run}-p17!`;
  console.log(`scale setup run=${run}`);
  const [coD] = await srInsert('companies', { name: `QCP P17 Scale ${run}`, slug: `qcp-p17-scale-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active', default_currency: 'NZD' });
  const uidD = await createAuthUser(`qcp-p17-scale-${run}@example.com`, PWD);
  await srInsert('users', { id: uidD, company_id: coD.id, email: `qcp-p17-scale-${run}@example.com`, full_name: 'P17 Scale', role: 'owner' });
  await srInsert('assistant_feature_flags', { company_id: coD.id, enabled: true });
  await srInsert('assistant_v2_rollout', { company_id: coD.id, p1: true, p2: true, p3: true, p4: false, write_policy: 'propose_then_confirm', confirmation_policy: 'requester_button', ledger_policy: 'retain_action_fields', enabled_at: nowIso });
  await srInsert('assistant_v2_retrieval_rollout', { company_id: coD.id, enabled: true, knowledge_enabled: false });
  await srInsert('assistant_section_permissions', { company_id: coD.id, permissions: { quotes: 'edit', draft_quotes: 'edit', orders: 'edit', invoices: 'edit', components: 'edit', customers: 'read_only', emails: 'hidden', billing: 'hidden', settings: 'hidden' }, revision: 1, updated_by: uidD });
  state = { run, coD: coD.id, uidD, email: `qcp-p17-scale-${run}@example.com`, pwd: PWD };
  writeState(state);

  // 100k-row catalogue in one owned catalogue
  const [cat] = await srInsert('catalogs', { company_id: coD.id, name: 'P17 Scale Catalogue', status: 'ready', default_currency: 'NZD', row_count: 100000, original_filename: 'p17-scale.csv', column_mapping: { description: '0', price: '1', quantity: '2' } });
  state.cat = cat.id; writeState(state);
  console.log('catalogue', cat.id, '- inserting 100,000 rows in batches...');
  const BATCH = 2000;
  const mkRow = (i) => {
    if (i === 0) return { catalog_id: cat.id, company_id: coD.id, row_index: i, raw_row: { 0: 'P17 UNIQUE MARLEY MODERN', 1: '89.50', 2: '25' }, search_text: 'p17 unique marley modern 89.50' };
    const kind = i % 5;
    const desc = kind === 0 ? `P17 Tile Red ${i}` : kind === 1 ? `P17 Gutter Grey ${i}` : kind === 2 ? `P17 Ridge Cap ${i}` : kind === 3 ? `P17 Flashing Roll ${i}` : `P17 Screw Box ${i}`;
    const price = (10 + (i % 90) + 0.25).toFixed(2);
    return { catalog_id: cat.id, company_id: coD.id, row_index: i, raw_row: { 0: desc, 1: price, 2: '10' }, search_text: `${desc.toLowerCase()} ${price}` };
  };
  let inserted = 0;
  for (let b = 0; b < 100000 / BATCH; b++) {
    const rows = [];
    for (let j = 0; j < BATCH; j++) rows.push(mkRow(b * BATCH + j));
    await srInsert('catalog_rows', rows);
    inserted += BATCH;
    if (b % 10 === 0) console.log(`  rows ${inserted}/100000`);
  }
  // foreign-tenant lookalikes (company A of the P1.16 state)
  try {
    const p16 = JSON.parse(readFileSync(new URL('../../.sa-p16-state.json', import.meta.url).pathname.replace(/^\//, ''), 'utf8'));
    const [fcat] = await srInsert('catalogs', { company_id: p16.coB, name: 'P17 Foreign Lookalike', status: 'ready', default_currency: 'NZD', row_count: 3, original_filename: 'p17-foreign.csv', column_mapping: { description: '0', price: '1' } });
    await srInsert('catalog_rows', [
      { catalog_id: fcat.id, company_id: p16.coB, row_index: 0, raw_row: { 0: 'P17 UNIQUE MARLEY MODERN', 1: '1.00', 2: '1' }, search_text: 'p17 unique marley modern 1.00' },
      { catalog_id: fcat.id, company_id: p16.coB, row_index: 1, raw_row: { 0: 'P17 Tile Red 999', 1: '2.00', 2: '1' }, search_text: 'p17 tile red 999 2.00' },
    ]);
    console.log('foreign lookalikes inserted (company B)');
  } catch (e) { console.log('foreign lookalikes skipped:', e.message); }

  // 200/201 engine boundary quote sets
  console.log('inserting 401 boundary quotes...');
  const qBatch = (start, count, tag) => {
    const rows = [];
    for (let i = 0; i < count; i++) {
      rows.push({ company_id: coD.id, quote_number: 700000 + start + i, job_name: `${tag} job ${i}`, customer_name: `Scale Cust ${tag} ${i}`, status: 'sent', measurement_system: 'metric', currency: 'NZD', created_by_user_id: uidD });
    }
    return rows;
  };
  await srInsert('quotes', qBatch(0, 200, 'P17 ENGINE200'));
  await srInsert('quotes', qBatch(1000, 201, 'P17 ENGINE201'));
  console.log('boundary quotes inserted (200 + 201)');

  // admit a live run for D via a real turn
  const sess = await signIn(state.email, PWD);
  state.cookie = cookieOf(sess); state.token = sess.access_token;
  const convId = randomUUID();
  await srInsert('smart_assistant_conversations', { id: convId, company_id: coD.id, user_id: uidD });
  state.conversationId = convId; writeState(state);
  const turnP = fetch(`${BASE_URL}/api/smart-assistant/turn`, { method: 'POST', headers: { Cookie: state.cookie, 'Content-Type': 'application/json', Origin: BASE_URL }, body: JSON.stringify({ conversationId: convId, message: 'Summarise my quotes, material orders and invoices with their totals', clientRequestId: randomUUID(), pageContext: { companyId: coD.id, pathname: `/${run}/quotes` } }), signal: AbortSignal.timeout(180000) }).catch((e) => ({ err: e.message }));
  let runId = null;
  for (let i = 0; i < 60 && !runId; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const rows = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`);
    if (rows?.length && rows[0].status !== 'completed' && rows[0].status !== 'failed') runId = rows[0].id;
  }
  state.runId = runId; writeState(state);
  console.log('admitted run:', runId);
  await turnP;
  console.log('setup complete');
  process.exit(0);
}

if (cmd === 'probes') {
  const turnP = await admitRun();
  const timed = async (label, plan) => {
    const t0 = Date.now();
    const r = await rpc17(state.token, plan);
    const ms = Date.now() - t0;
    const rows = Array.isArray(r.data?.rows) ? r.data.rows.length : null;
    console.log(`${label}: ${r.status} ${ms}ms rows=${rows} status=${r.data?.status ?? ''} complete=${r.data?.complete ?? ''}`);
    return { label, ms, rows, status: r.data?.status, complete: r.data?.complete, sample: r.data?.rows?.[0]?.description?.slice(0, 80) };
  };
  const out = { probes: [] };
  out.probes.push(await timed('v17-catalogue-exact-unique', { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'P17 UNIQUE MARLEY MODERN', match: 'exact' }, limit: 5 }));
  out.probes.push(await timed('v17-catalogue-words-dense', { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'p17 tile red', match: 'words' }, limit: 5 }));
  out.probes.push(await timed('v17-catalogue-count', { version: 1, source: 'catalogue_rows', mode: 'aggregate', metrics: [{ op: 'count' }] }));
  // EXPLAIN equivalent literal statements (inner statements the RPC builds, same predicates+role)
  const explains = {};
  const runExplain = async (label, sql) => {
    const fsMod = await import('node:fs');
    fsMod.writeFileSync('C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-explain.sql', 'EXPLAIN (ANALYZE, BUFFERS) ' + sql + ';', 'utf8');
    const { execFileSync } = await import('node:child_process');
    const r = execFileSync('powershell', ['-File', 'C:/Users/Jimmy/.openclaw/workspace-gavin/.db-query.ps1', 'C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-explain.sql'], { encoding: 'utf8', timeout: 120000 });
    explains[label] = r;
    console.log(`--- EXPLAIN ${label} ---`);
    console.log(String(r).slice(0, 1500));
  };
  await runExplain('catalogue-exact-unique', `SELECT * FROM public.catalog_rows cr JOIN public.catalogs c ON c.id=cr.catalog_id WHERE cr.company_id='${state.coD}' AND (cr.row_index=0 OR cr.search_text = 'p17 unique marley modern 89.50') LIMIT 6`);
  await runExplain('catalogue-words-dense', `SELECT count(*) FROM public.catalog_rows cr WHERE cr.company_id='${state.coD}' AND cr.search_text ILIKE '%p17%' AND cr.search_text ILIKE '%tile%' AND cr.search_text ILIKE '%red%'`);
  await runExplain('catalogue-full-scan-count', `SELECT count(*) FROM public.catalog_rows cr WHERE cr.company_id='${state.coD}' AND cr.search_text ILIKE '%p17%'`);
  await turnP;
  writeFileSync(new URL('../../.sa-p17-scale-probes.json', import.meta.url).pathname.replace(/^\//, ''), JSON.stringify({ out, explains }, null, 2));
  console.log('probes complete');
  process.exit(0);
}

if (cmd === 'boundary') {
  const turnP = await admitRun();
  const run = async (label, text) => {
    const t0 = Date.now();
    const r = await rpc17(state.token, { version: 1, source: 'quotes', mode: 'aggregate', quoteScope: 'quotes', search: { text, match: 'words' }, metrics: [{ field: 'builder_total', op: 'sum' }] }, 120000);
    const ms = Date.now() - t0;
    console.log(`${label}: ${r.status} ${ms}ms mode=${r.data?.mode} complete=${r.data?.complete} status=${r.data?.status} msg=${r.message?.slice(0, 160)} warnings=${JSON.stringify(r.data?.warnings)?.slice(0, 200)}`);
    return { label, ms, mode: r.data?.mode, complete: r.data?.complete, status: r.data?.status };
  };
  const [ctrl, res200, res201] = await Promise.all([
    run('control-simple-rows', 'P17 ENGINE200'),
    run('engine-200', 'P17 ENGINE200'),
    run('engine-201', 'P17 ENGINE201'),
  ]);
  await turnP;
  writeFileSync(new URL('../../.sa-p17-boundary.json', import.meta.url).pathname.replace(/^\//, ''), JSON.stringify({ res200, res201 }, null, 2));
  const pass = res200.complete === true && res201.mode !== 'engine_inputs' && res201.status === 'too_broad';
  console.log('boundary gate:', pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

if (cmd === 'abort') {
  const turnP = await admitRun();
  // 1. dense bounded read with 150ms caller abort
  let aborted = false, errName = '';
  const t0 = Date.now();
  try {
    await rpc17(state.token, { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'p17 tile red', match: 'words' }, limit: 5 }, 150);
  } catch (e) { aborted = true; errName = e.name; }
  console.log(`caller abort: aborted=${aborted} (${errName}) after ${Date.now() - t0}ms`);
  // 2. immediately inspect pg_stat_activity for our statement
  const fsMod = await import('node:fs');
  fsMod.writeFileSync('C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-activity.sql', `SELECT pid, state, wait_event_type, now()-query_start AS age, left(query,160) AS q FROM pg_stat_activity WHERE query ILIKE '%catalog_rows%' AND pid <> pg_backend_pid() ORDER BY query_start;`, 'utf8');
  const { execFileSync } = await import('node:child_process');
  const act = execFileSync('powershell', ['-File', 'C:/Users/Jimmy/.openclaw/workspace-gavin/.db-query.ps1', 'C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-activity.sql'], { encoding: 'utf8', timeout: 60000 });
  console.log('pg_stat_activity after abort:');
  console.log(String(act).slice(0, 2000));
  // 3. wait 3s, check again (did it finish/cancel on its own?)
  await new Promise((r) => setTimeout(r, 3000));
  const act2 = execFileSync('powershell', ['-File', 'C:/Users/Jimmy/.openclaw/workspace-gavin/.db-query.ps1', 'C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-activity.sql'], { encoding: 'utf8', timeout: 60000 });
  console.log('pg_stat_activity 3s later:');
  console.log(String(act2).slice(0, 2000));
  // 4. re-fire the same query normally (replay/no duplicate-work observation)
  const t1 = Date.now();
  const r = await rpc17(state.token, { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'p17 tile red', match: 'words' }, limit: 5 });
  console.log(`re-fire: ${r.status} ${Date.now() - t1}ms rows=${r.data?.rows?.length ?? 0}`);
  fsMod.writeFileSync('C:/Users/Jimmy/.openclaw/workspace-gavin/p17-evidence/abort-observations.txt', `aborted=${aborted} (${errName}) after ${Date.now() - t0 - (Date.now() - t1)}ms initial\nactivity-after-abort:\n${act}\nactivity-3s-later:\n${act2}\nrefire ${r.status} ${Date.now() - t1}ms\n`);
  await turnP;
  console.log('abort observations saved');
  process.exit(0);
}

if (cmd === 'cleanup') {
  if (!state.coD) { console.log('no scale state'); process.exit(0); }
  const del = async (q) => { try { await sr('DELETE', `/rest/v1/${q}`); } catch (e) { console.log('cleanup skip:', e.message.slice(0, 120)); } };
  await del(`catalog_rows?company_id=eq.${state.coD}`);
  await del(`catalogs?company_id=eq.${state.coD}`);
  await del(`quotes?company_id=eq.${state.coD}`);
  await del(`smart_assistant_conversations?company_id=eq.${state.coD}`);
  await del(`smart_assistant_runs?company_id=eq.${state.coD}`);
  await del(`assistant_section_permissions?company_id=eq.${state.coD}`);
  await del(`assistant_v2_retrieval_rollout?company_id=eq.${state.coD}`);
  await del(`assistant_v2_rollout?company_id=eq.${state.coD}`);
  await del(`assistant_feature_flags?company_id=eq.${state.coD}`);
  await del(`users?company_id=eq.${state.coD}`);
  await del(`companies?id=eq.${state.coD}`);
  try { await fetch(`${SUPA_URL}/auth/v1/admin/users/${state.uidD}`, { method: 'DELETE', headers: srH }); } catch {}
  writeState({});
  console.log('scale cleanup complete (company D deleted)');
  process.exit(0);
}

console.error('usage: node scripts/p17-scale.mjs setup|probes|boundary|abort|cleanup');
process.exit(2);
