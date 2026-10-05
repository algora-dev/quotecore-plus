/**
 * SA P1.7 v17 RPC acceptance battery (2026-09-26).
 * Provisions P1.7 correctness fixtures inside the P1.6 disposable company A
 * (missing-value order lines, tie lines, duplicate Ridge, Ridge-named parent),
 * then probes sa_v2_retrieval_query_v17 + capabilities during a live admitted run.
 * Mirrors the P1.6 access matrix against the NEW reader and adds P1.7-specific
 * plan validation, ranking/coverage, resolve-mode and isolation checks.
 *
 * Subcommands: p17setup | rpc17
 * State:   ../../.sa-p16-state.json (+p17 sub-object); fixtures die with company A cleanup.
 * Results: ../../.sa-p17-rpc-results.json
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
const STATE_PATH = new URL('../../.sa-p16-state.json', import.meta.url).pathname.replace(/^\//, '');
const RESULTS_PATH = new URL('../../.sa-p17-rpc-results.json', import.meta.url).pathname.replace(/^\//, '');
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
async function signIn(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
const sessionCookieHeader = (session) =>
  createChunks(AUTH_COOKIE, 'base64-' + stringToBase64URL(JSON.stringify(session))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
async function app(method, path, cookie, body) {
  const r = await fetch(`${process.env.BASE_URL || 'https://quotecore-plus-testing.vercel.app'}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(180000),
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j };
}
async function rpcProbe(accessToken, fn, args) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (Array.isArray(json)) json = json[0] ?? null;
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

const cmd = process.argv[2] ?? '';

// ─── p17setup: extra correctness fixtures inside disposable company A ───
if (cmd === 'p17setup') {
  const s = readState();
  const nowIso = new Date().toISOString();
  const tag = s.run;
  // Dedicated orders so order_number filters isolate exact populations.
  const [ordM] = await srInsert('material_orders', { company_id: s.coA, order_number: `PO-P17M-${tag}`, supplier_name: 'P17 Missing Supplier', job_name: 'P17 Missing Job', status: 'ready', is_sent: false });
  await srInsert('material_order_lines', [
    { order_id: ordM.id, item_name: 'P17 Missing A', quantity: 100, unit: 'm' },
    { order_id: ordM.id, item_name: 'P17 Missing B', quantity: null, unit: 'm' },
  ]);
  const [ordT] = await srInsert('material_orders', { company_id: s.coA, order_number: `PO-P17T-${tag}`, supplier_name: 'P17 Tie Supplier', job_name: 'P17 Tie Job', status: 'ready', is_sent: false });
  await srInsert('material_order_lines', [
    { order_id: ordT.id, item_name: 'P17 Tie X', quantity: 77, unit: 'm' },
    { order_id: ordT.id, item_name: 'P17 Tie Y', quantity: 77, unit: 'm' },
    { order_id: ordT.id, item_name: 'P17 Tie Z', quantity: 77, unit: 'm' },
  ]);
  const [ordN] = await srInsert('material_orders', { company_id: s.coA, order_number: `PO-P17N-${tag}`, supplier_name: 'P17 Null Supplier', job_name: 'P17 Null Job', status: 'ready', is_sent: false });
  await srInsert('material_order_lines', [
    { order_id: ordN.id, item_name: 'P17 Null C', quantity: null, unit: 'm' },
    { order_id: ordN.id, item_name: 'P17 Null D', quantity: null, unit: 'm' },
  ]);
  // Duplicate Ridge under the same parent (q3 = '9th canvas test' draft) -> child ambiguity.
  const [dupRidge] = await srInsert('quote_components', { quote_id: s.q3, name: 'Ridge', measurement_type: 'lineal', final_quantity: 11, material_rate: 0, labour_rate: 0, material_cost: 0, labour_cost: 0 });
  // Parent whose NAME contains Ridge but with no Ridge-named child (field-constraint probe).
  const [qRidge] = await srInsert('quotes', { company_id: s.coA, quote_number: Math.floor(Math.random() * 900000) + 100000, customer_name: 'Rita Ridge', job_name: 'Ridge Cottage Repaint', status: 'sent', measurement_system: 'metric', currency: 'NZD', created_by_user_id: s.uidA });
  await srInsert('quote_components', { quote_id: qRidge.id, name: 'Velux Window', measurement_type: 'count', final_quantity: 2, material_rate: 100, labour_rate: 50, material_cost: 200, labour_cost: 100 });
  Object.assign(s, { p17: { ordM: ordM.id, ordT: ordT.id, ordN: ordN.id, dupRidge: dupRidge.id, qRidge: qRidge.id } });
  writeState(s);
  console.log(`p17setup complete ordM=${ordM.id} ordT=${ordT.id} ordN=${ordN.id} dupRidge=${dupRidge.id} qRidge=${qRidge.id}`);
  process.exit(0);
}

// ─── rpc17: v17 reader battery during a live admitted run ───
if (cmd === 'rpc17') {
  const s = readState();
  const results = [];
  const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + String(detail).slice(0, 220) : ''}`); };
  const rev = s.revision ?? 1;
  const p17 = s.p17;

  // Live admitted run via heavy multi-tool turn (unchanged admission path).
  const convId = randomUUID();
  await srInsert('smart_assistant_conversations', { id: convId, company_id: s.coA, user_id: s.uidA });
  const sessA = await signIn(s.emailA, s.pwd);
  const cookieA = sessionCookieHeader(sessA);
  const turnPromise = app('POST', '/api/smart-assistant/turn', cookieA, {
    conversationId: convId, message: 'Summarise my quotes, material orders and invoices with their totals', clientRequestId: randomUUID(),
    pageContext: { companyId: s.coA, pathname: `/${s.run}/quotes` },
  }).catch((e) => ({ error: e.message }));
  let runId = null, runStatus = null;
  for (let i = 0; i < 60 && !runId; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const rows = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`);
    if (rows && rows.length && rows[0].status !== 'completed' && rows[0].status !== 'failed') { runId = rows[0].id; runStatus = rows[0].status; }
  }
  if (!runId) {
    const rows = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`);
    runId = rows?.[0]?.id ?? null;
    record('live-run-capture', false, 'fallback to finished run ' + runId);
  } else {
    record('live-run-capture', true, `runId=${runId} status=${runStatus}`);
    let bound = false;
    for (let i = 0; i < 40 && !bound; i++) {
      const c = await rpcProbe(sessA.access_token, 'sa_v2_retrieval_capabilities', { p_run_id: runId, p_revision: rev });
      if (c.ok) bound = true; else await new Promise((r2) => setTimeout(r2, 400));
    }
    record('run-scope-bound', bound, bound ? 'capabilities OK' : 'scope never bound');
  }

  const q = (plan) => rpcProbe(sessA.access_token, 'sa_v2_retrieval_query_v17', { p_run_id: runId, p_revision: rev, p_plan: plan });
  const rowsOf = (d) => Array.isArray(d?.rows) ? d.rows : [];

  // 1. capabilities: intelligence_version=1 (v17-compatible reader).
  const cap = await rpcProbe(sessA.access_token, 'sa_v2_retrieval_capabilities', { p_run_id: runId, p_revision: rev });
  record('capabilities-v17', cap.ok && cap.data?.enabled === true && cap.data?.intelligence_version === 1, JSON.stringify(cap.data)?.slice(0, 160));

  // 2-5. tenant isolation through the NEW reader.
  const r2 = await q({ version: 1, source: 'quotes', mode: 'rows', search: { text: 'Maple Ridge', match: 'words' }, limit: 10 });
  const names2 = rowsOf(r2.data).map((x) => x.job_name);
  record('v17-isolation-search-maple', r2.ok && names2.length === 2 && names2.every((n) => n === 'Maple Ridge Roof Repair'), `rows=${names2.length}`);
  const r3 = await q({ version: 1, source: 'quotes', mode: 'rows', search: { text: 'Foreign Only Quote', match: 'exact' }, limit: 10 });
  record('v17-isolation-foreign-search-empty', r3.ok && rowsOf(r3.data).length === 0, `rows=${rowsOf(r3.data).length}`);
  const mk = (id) => q({ version: 1, source: 'quotes', mode: 'rows', filters: [{ field: 'id', op: 'eq', value: id }], limit: 5 });
  const r4 = await mk(s.qB1);
  const r5 = await mk(randomUUID());
  record('v17-isolation-foreign-id-empty', r4.ok && rowsOf(r4.data).length === 0, `rows=${rowsOf(r4.data).length}`);
  record('v17-random-id-indistinguishable', r4.ok && r5.ok && JSON.stringify(r4.data?.rows).length === JSON.stringify(r5.data?.rows).length, 'shape equal');

  // 6-15. forged plan rejection through v17.
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
    ['knowledge-off-source', { version: 1, source: 'knowledge_documents', mode: 'rows' }],
    ['nested-json-filter', { version: 1, source: 'quotes', mode: 'rows', filters: [{ field: 'customer_name', op: 'eq', value: { a: { b: 'c' } } }] }],
    ['sql-in-search', { version: 1, source: 'quotes', mode: 'rows', search: { text: "'; DROP TABLE quotes;--", match: 'exact' } }],
    ['unknown-plan-key', { version: 1, source: 'quotes', mode: 'rows', selection: { relationship: 'quotes.components' } }],
  ];
  for (const [name, plan] of rejects) {
    const r = await q(plan);
    const msg = (r.message || '').toLowerCase();
    if (name === 'sql-in-search') {
      const rows = rowsOf(r.data);
      record('v17-reject-sql-in-search', r.ok && rows.length === 0, `status=${r.status} rows=${rows.length} (literal, no injection surface)`);
      continue;
    }
    const denied = !r.ok && /unsupported|invalid|knowledge_disabled|feature_disabled|denied|22023|p1601|p1603|p1604/.test(msg + ' ' + r.status);
    record('v17-reject-' + name, denied, `${r.status} ${r.message.slice(0, 120)}`);
  }
  const rCtrl = await q({ version: 1, source: 'quotes', mode: 'rows', search: { text: 'abc\x00def', match: 'exact' } });
  record('v17-reject-control-chars', !rCtrl.ok, `${rCtrl.status}`);

  // P1.7-specific plan validation.
  const rRes = await q({ version: 1, source: 'quotes', mode: 'aggregate', metrics: [{ field: 'builder_total', op: 'sum' }], resolve: true });
  record('v17-reject-resolve-aggregate', !rRes.ok && /invalid_aggregate_resolution/.test(rRes.message), `${rRes.status} ${rRes.message.slice(0, 100)}`);
  const rRank = await q({ version: 1, source: 'order_lines', mode: 'rows', orderBy: [{ field: 'quantity', direction: 'desc' }], search: { text: 'P17 Tie', match: 'natural' }, limit: 5 });
  record('v17-reject-ranking-natural-search', !rRank.ok && /numeric_ranking_requires_definite_membership/.test(rRank.message), `${rRank.status} ${rRank.message.slice(0, 100)}`);
  const rNumSearch = await q({ version: 1, source: 'quote_components', mode: 'rows', search: { text: 'Ridge', match: 'natural', field: 'final_quantity' } });
  record('v17-reject-search-non-text-field', !rNumSearch.ok, `${rNumSearch.status} ${rNumSearch.message.slice(0, 100)}`);

  // Resolve-mode: unique draft parent by name.
  const r17 = await q({ version: 1, source: 'quotes', mode: 'rows', resolve: true, quoteScope: 'drafts', search: { text: '9th canvas test', match: 'natural' } });
  const parentRows = rowsOf(r17.data);
  record('v17-resolve-parent-unique-draft', r17.ok && parentRows.length === 1 && parentRows[0]?.job_name === '9th canvas test', `rows=${parentRows.length} ${parentRows[0]?.job_name}`);
  // Resolve-mode: ambiguous parent returns candidates (no arbitrary child fetch).
  const r18 = await q({ version: 1, source: 'quotes', mode: 'rows', resolve: true, search: { text: 'Maple Ridge Roof Repair', match: 'natural' } });
  record('v17-resolve-parent-ambiguous-2', r18.ok && rowsOf(r18.data).length === 2, `rows=${rowsOf(r18.data).length}`);
  // Child under parent q3: single Ridge (before duplicate) -> now TWO Ridge (dup fixture) => ambiguity is correct.
  const childPlan = (parentId, text, scope) => ({ version: 1, source: 'quote_components', mode: 'rows', resolve: true, ...(scope ? { quoteScope: scope } : {}),
    related: [{ relation: 'quote', filters: [{ field: 'id', op: 'eq', value: parentId }] }],
    ...(text ? { search: { text, match: 'natural', field: 'name' } } : {}), limit: 10 });
  const rChild = await q(childPlan(s.q3, 'Ridge', 'drafts'));
  record('v17-child-duplicate-ridge-ambiguous', rChild.ok && rowsOf(rChild.data).length === 2, `rows=${rowsOf(rChild.data).length} (expect 2: original+dup)`);
  const rChildUniq = await q(childPlan(s.q1, 'Ridge', 'quotes'));
  record('v17-child-single-ridge-q1', rChildUniq.ok && rowsOf(rChildUniq.data).length === 1 && rowsOf(rChildUniq.data)[0]?.name === 'Ridge', `rows=${rowsOf(rChildUniq.data).length}`);
  // Field-constrained child: parent named Ridge Cottage has NO Ridge child; child text must not match through parent/job/customer names.
  const rParentRC = await q({ version: 1, source: 'quotes', mode: 'rows', resolve: true, search: { text: 'Ridge Cottage', match: 'natural' } });
  const rcRows = rowsOf(rParentRC.data);
  record('v17-resolve-parent-ridge-cottage', rParentRC.ok && rcRows.length === 1 && rcRows[0]?.job_name === 'Ridge Cottage Repaint', `rows=${rcRows.length}`);
  if (rcRows.length === 1) {
    const rChildRC = await q(childPlan(rcRows[0].id, 'Ridge', 'quotes'));
    record('v17-child-field-constrained-no-parent-leak', rChildRC.ok && rowsOf(rChildRC.data).length === 0, `rows=${rowsOf(rChildRC.data).length} (parent name must not satisfy child name)`);
  }
  // Cross-parent child binding: q3's child id queried under q1 must return nothing.
  const rCross = await q({ version: 1, source: 'quote_components', mode: 'rows', related: [{ relation: 'quote', filters: [{ field: 'id', op: 'eq', value: s.q1 }] }], filters: [{ field: 'id', op: 'eq', value: p17.dupRidge }], limit: 5 });
  record('v17-child-cross-parent-binding-empty', rCross.ok && rowsOf(rCross.data).length === 0, `rows=${rowsOf(rCross.data).length}`);

  // Missing-value grouped evidence (DATABASE_ACCEPTANCE C).
  const missPlan = { version: 1, source: 'order_lines', mode: 'aggregate', filters: [{ field: 'order_number', op: 'eq', value: `PO-P17M-${s.run}` }], groupBy: ['item_name'], metrics: [{ field: 'quantity', op: 'sum' }], orderBy: [{ field: 'metric_0', direction: 'desc' }], limit: 1 };
  const rMiss = await q(missPlan);
  const cov = rMiss.data?.coverage;
  const mrows = rowsOf(rMiss.data);
  record('v17-missing-group-coverage', rMiss.ok && cov?.matchedRows === '2' && cov?.groupCount === '2' && cov?.missingValues === '1' && rMiss.data?.complete === false,
    `rows=${mrows.length} top=${mrows[0]?.item_name} cov=${JSON.stringify(cov)?.slice(0, 140)}`);
  record('v17-missing-displayed-a-not-erasing-b', rMiss.ok && mrows.length === 1 && mrows[0]?.item_name === 'P17 Missing A' && mrows[0]?.metric_0 === '100', `top=${mrows[0]?.item_name} sum=${mrows[0]?.metric_0}`);

  // Tie evidence: three equal values, LIMIT 1 page shows one; _tie_count=3, _position=1.
  const tiePlan = { version: 1, source: 'order_lines', mode: 'rows', filters: [{ field: 'order_number', op: 'eq', value: `PO-P17T-${s.run}` }], orderBy: [{ field: 'quantity', direction: 'desc' }], fields: ['item_name', 'quantity'], limit: 1 };
  const rTie = await q(tiePlan);
  const tieRow = rowsOf(rTie.data)[0];
  const tieCov = rTie.data?.coverage;
  record('v17-tie-three-equal-top1', rTie.ok && tieRow && tieRow._tie_count === '3' && tieRow._position === '1' && tieCov?.matchedRows === '3',
    `tie=${tieRow?._tie_count} pos=${tieRow?._position} cov=${tieCov ? tieCov.matchedRows : 'none'} rows=${rowsOf(rTie.data).length}`);

  // All-missing grouped: sum null, complete=false, missing=2.
  const rAllNull = await q({ version: 1, source: 'order_lines', mode: 'aggregate', filters: [{ field: 'order_number', op: 'eq', value: `PO-P17N-${s.run}` }], groupBy: ['item_name'], metrics: [{ field: 'quantity', op: 'sum' }], limit: 5 });
  record('v17-all-missing-incomplete', rAllNull.ok && rAllNull.data?.complete === false && rAllNull.data?.coverage?.missingValues === '2', `complete=${rAllNull.data?.complete} cov=${JSON.stringify(rAllNull.data?.coverage)?.slice(0, 120)}`);

  // Unlike currencies: invoice totals ranking must surface both dimensions (no silent global winner).
  const rCur = await q({ version: 1, source: 'invoices', mode: 'rows', orderBy: [{ field: 'total', direction: 'desc' }], fields: ['invoice_number', 'customer_name', 'total', 'currency'], limit: 5 });
  const curCov = rCur.data?.coverage;
  record('v17-currency-dimensions-evidenced', rCur.ok && curCov?.dimensionCount === '2' && rowsOf(rCur.data).some((x) => x.currency === 'GBP') && rowsOf(rCur.data).some((x) => x.currency === 'NZD'),
    `dims=${curCov?.dimensionCount} rows=${rowsOf(rCur.data).map((x) => x.currency).join('|')}`);

  // Related semi-join: parents not multiplied by many matching children (Ridge on q1,q2,q3).
  const rRel = await q({ version: 1, source: 'quotes', mode: 'rows', related: [{ relation: 'components', search: { text: 'Ridge', match: 'exact' } }], fields: ['job_name', 'status'], limit: 10 });
  const relNames = rowsOf(rRel.data).map((x) => x.job_name);
  record('v17-related-semijoin-no-multiplication', rRel.ok && relNames.length === 3 && relNames.filter((n) => n === 'Maple Ridge Roof Repair').length === 2, `rows=${relNames.length} ${relNames.join('|')}`);

  // Zero matches: honest empty, complete.
  const rZero = await q({ version: 1, source: 'quotes', mode: 'rows', search: { text: 'Zzqqxx nothing', match: 'exact' }, limit: 5 });
  record('v17-zero-matches-honest-empty', rZero.ok && rowsOf(rZero.data).length === 0 && rZero.data?.complete === true, `rows=${rowsOf(rZero.data).length}`);

  // Engine path through v17: complete bounded inputs for non-draft quotes.
  const rEng = await q({ version: 1, source: 'quotes', mode: 'aggregate', quoteScope: 'quotes', metrics: [{ field: 'builder_total', op: 'sum' }] });
  record('v17-engine-inputs-complete', rEng.ok && rEng.data?.mode === 'engine_inputs' && rEng.data?.complete === true, `mode=${rEng.data?.mode} complete=${rEng.data?.complete}`);

  // Stored aggregate exactness: tie order count=3 sum=231.
  const rAgg = await q({ version: 1, source: 'order_lines', mode: 'aggregate', filters: [{ field: 'order_number', op: 'eq', value: `PO-P17T-${s.run}` }], metrics: [{ op: 'count' }, { field: 'quantity', op: 'sum' }] });
  const aggRow = rowsOf(rAgg.data)[0];
  record('v17-stored-aggregate-exact', rAgg.ok && aggRow?.metric_0 === '3' && aggRow?.metric_1 === '231' && rAgg.data?.complete === true, `count=${aggRow?.metric_0} sum=${aggRow?.metric_1}`);

  // Access-control denials through v17 (mirror P1.6): foreign user, no-retrieval user, stale revision, anon, no JWT.
  const rF = await rpcProbe(s.tokenB, 'sa_v2_retrieval_query_v17', { p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('v17-deny-foreign-user-jwt', !rF.ok, `${rF.status} ${rF.message.slice(0, 100)}`);
  const rN = await rpcProbe(s.tokenC, 'sa_v2_retrieval_query_v17', { p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('v17-deny-noretrieval-user-jwt', !rN.ok, `${rN.status}`);
  const rS = await rpcProbe(sessA.access_token, 'sa_v2_retrieval_query_v17', { p_run_id: runId, p_revision: rev + 500, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('v17-deny-stale-revision', !rS.ok, `${rS.status}`);
  const rAnon = await anonRpc('sa_v2_retrieval_query_v17', { p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('v17-deny-anon-key', rAnon.status === 401, `${rAnon.status}`);
  const rNoJwt = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_retrieval_query_v17`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } }) });
  record('v17-deny-no-jwt', rNoJwt.status === 401, `${rNoJwt.status}`);

  await turnPromise;
  // Finished run must refuse.
  const rDone = await rpcProbe(sessA.access_token, 'sa_v2_retrieval_query_v17', { p_run_id: runId, p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('v17-deny-finished-run', !rDone.ok, `${rDone.status}`);
  const rGhost = await rpcProbe(sessA.access_token, 'sa_v2_retrieval_query_v17', { p_run_id: randomUUID(), p_revision: rev, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  record('v17-deny-nonexistent-run', !rGhost.ok, `${rGhost.status}`);

  const pass = results.filter((r) => r.ok).length;
  console.log(`v17 rpc battery: ${pass}/${results.length} passed`);
  writeFileSync(RESULTS_PATH, JSON.stringify({ startedAt: new Date().toISOString(), results }, null, 2));
  process.exit(pass === results.length ? 0 : 1);
}
console.error('usage: node scripts/test-sa-retrieval-v17-rpc.mjs p17setup|rpc17');
process.exit(2);
