/**
 * SA P1.7.2 ROUND-2 live battery (2026-09-28): full draft-quote action flow
 * under the task-context layer, on the testing deployment.
 *
 * Scenario (one continuous conversation, throwaway company):
 *   T1 propose rate 30 on draft "SA R2 Draft" Ridge  -> confirm -> DB material_rate=30
 *   T2 "actually make it 25" (correction)           -> confirm -> DB material_rate=25
 *   T3 "set the Ridge quantity to 40" (continue)     -> confirm -> DB entry raw_value=40
 *   T4 "done"                                        -> task closed
 *   T5 "what are my quotes" (unrelated)              -> NEW task, no inheritance
 *
 * Usage:  node scripts/test-sa-task-round2-draft.mjs run|cleanup
 * State:  .sa-r2-state.json (workspace, never committed)
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

const BASE_URL = process.env.BASE_URL || 'https://quotecore-plus-testing.vercel.app';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATE_PATH = new URL('../../.sa-r2-state.json', import.meta.url).pathname.replace(/^\//, '');
if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(2); }

const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const AUTH_COOKIE = 'sb-qcp-auth';
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`service-role ${method} ${path} -> ${r.status}: ${String(text).slice(0, 300)}`);
  return json;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);
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
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j };
}
const RESULTS = [];
function check(name, ok, detail = '') {
  RESULTS.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
}
function readState() { try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; } }
function writeState(s) { writeFileSync(STATE_PATH, JSON.stringify(s, null, 2)); }

// ── cleanup ───────────────────────────────────────────────────────
if (process.argv[2] === 'cleanup') {
  const s = readState();
  if (!s.run) { console.error('No state'); process.exit(2); }
  const errs = [];
  const tables = ['assistant_v2_task_runs', 'assistant_v2_task_context', 'assistant_v2_retrieval_rollout', 'assistant_v2_actions', 'sa_action_log', 'assistant_v2_cards', 'assistant_v2_context', 'smart_assistant_messages', 'smart_assistant_runs', 'assistant_turn_reservations', 'assistant_usage_events', 'assistant_events', 'smart_assistant_conversations', 'assistant_section_permissions', 'assistant_v2_rollout', 'assistant_feature_flags', 'quote_component_entries', 'quote_components', 'quotes'];
  for (const t of tables) { try { await srDelete(t, `company_id=eq.${s.coA}`); } catch (e) { errs.push(`${t}: ${e.message.slice(0, 120)}`); } }
  try { await srDelete('users', `company_id=eq.${s.coA}`); } catch (e) { errs.push(`users: ${e.message.slice(0, 120)}`); }
  try { await srDelete('companies', `id=eq.${s.coA}`); } catch (e) { errs.push(`companies: ${e.message.slice(0, 120)}`); }
  if (s.uidA) { try { await deleteAuthUser(s.uidA); } catch (e) { errs.push(`authA: ${e.message.slice(0, 120)}`); } }
  console.log(errs.length ? `cleanup finished with ${errs.length} notes:\n${errs.join('\n')}` : 'cleanup complete');
  process.exit(0);
}

// ── provision + run ───────────────────────────────────────────────
const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nowIso = new Date().toISOString();
const PWD = `Hx9-${run}-r2!`;
const emailA = `qcp-r2-${run}@example.com`;

console.log(`provision run=${run} base=${BASE_URL}`);
const [coA] = await srInsert('companies', { name: `QCP SA R2 ${run}`, slug: `qcp-sa-r2-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
const uidA = await createAuthUser(emailA, PWD);
await srInsert('users', [{ id: uidA, company_id: coA.id, email: emailA, full_name: 'SA R2 A', role: 'owner' }]);
await srInsert('assistant_feature_flags', [{ company_id: coA.id, enabled: true }]);
await srInsert('assistant_v2_rollout', [{ company_id: coA.id, p1: true, p2: true, p3: true, p4: false, write_policy: 'propose_then_confirm', confirmation_policy: 'requester_button', ledger_policy: 'retain_action_fields', enabled_at: nowIso }]);
// P1.7.2 task layer (enabled on testing via TASK_CONTEXT+RESOLVER env pair) hard-requires
// the P1.6/P1.7 retrieval reader per company: resolverAvailable() = resolver env flag
// && rollout row enabled && intelligence v1. Without this row every turn 503s
// 'migration_required' (mis-surfaced as pipeline_error). Same shape as RS Roofing.
await srInsert('assistant_v2_retrieval_rollout', [{ company_id: coA.id, enabled: true, knowledge_enabled: false, knowledge_revision: 1 }]);
await srInsert('assistant_section_permissions', { company_id: coA.id, permissions: { quotes: 'edit', draft_quotes: 'edit', orders: 'read_only', invoices: 'read_only', components: 'edit', customers: 'read_only', emails: 'hidden', billing: 'hidden', settings: 'hidden' }, revision: 1, updated_by: uidA });
const [draft] = await srInsert('quotes', { company_id: coA.id, quote_number: Math.floor(Math.random() * 900000) + 100000, customer_name: 'R2 Customer', job_name: 'SA R2 Draft', status: 'draft', measurement_system: 'metric', currency: 'NZD' });
const [comp] = await srInsert('quote_components', { quote_id: draft.id, name: 'Ridge', measurement_type: 'lineal' });
const [entry] = await srInsert('quote_component_entries', { quote_component_id: comp.id, raw_value: 10.5, value_after_waste: 11 });
const conversationId = randomUUID();
await srInsert('smart_assistant_conversations', { id: conversationId, company_id: coA.id, user_id: uidA });
const state = { run, coA: coA.id, uidA, emailA, pwd: PWD, draft: draft.id, comp: comp.id, entry: entry.id, conversationId };
writeState(state); // save early so cleanup always works
console.log(`company=${coA.id} draft=${draft.id} comp=${comp.id} entry=${entry.id}`);

const sessionA = await signIn(emailA, PWD);
const cookieA = sessionCookieHeader(sessionA);
const PATH = `/${coA.slug}/quotes`;

async function turn(message) {
  const t0 = Date.now();
  const r = await app('POST', '/api/smart-assistant/turn', cookieA, { conversationId, message, clientRequestId: randomUUID(), pageContext: { companyId: coA.id, pathname: PATH } });
  console.log(`\nTURN "${message}" -> ${r.status} (${Date.now() - t0}ms) status=${r.body?.status}`);
  console.log(`reply: ${String(r.body?.reply).slice(0, 300)}`);
  if (r.status !== 200 || r.body?.status !== 'completed') throw new Error(`turn failed: ${JSON.stringify(r.body).slice(0, 400)}`);
  return r.body;
}
async function session() {
  const r = await app('GET', `/api/smart-assistant/v2/session?conversationId=${conversationId}`, cookieA);
  if (r.status !== 200) throw new Error(`session read -> ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}
async function confirm(proposed) {
  const r = await app('POST', '/api/smart-assistant/v2/actions', cookieA, { actionId: proposed.id, command: 'confirm', proofDigest: proposed.proofDigest, version: proposed.version, companyId: coA.id });
  console.log(`confirm ${proposed.id} -> ${r.status} action.status=${r.body?.action?.status}`);
  return r;
}
const compRow = async () => (await sr('GET', `/rest/v1/quote_components?select=*&id=eq.${comp.id}`))[0];
const entryRow = async () => (await sr('GET', `/rest/v1/quote_component_entries?select=*&id=eq.${entry.id}`))[0];
// Task tables deny direct REST reads (even service role) - use the authenticated RPC snapshot.
const taskSnapshot = async () => {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_task_snapshot`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${sessionA.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_conversation_id: conversationId }) });
  if (!r.ok) throw new Error(`task snapshot -> ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return await r.json();
};
const closeTaskEndpoint = (task) => app('POST', '/api/smart-assistant/v2/task', cookieA, { companyId: coA.id, conversationId, taskId: task.id, version: task.version, command: 'done' });
const proposed = (snap) => (snap.actions ?? []).filter((x) => x.status === 'proposed');

try {
  // T1: propose rate 30
  await turn('set the material rate on the Ridge component of my draft "SA R2 Draft" to 30 per m');
  let snap = await session();
  let props = proposed(snap);
  check('T1 proposal card present', props.length >= 1, `proposed=${props.length}`);
  if (!props.length) throw new Error('No proposal after T1 - inspect transcript');
  const r1 = await confirm(props[props.length - 1]);
  check('T1 confirm committed', r1.status === 200 && r1.body?.action?.status === 'committed');
  let c = await compRow();
  check('T1 DB material_rate = 30', Number(c.material_rate) === 30, `material_rate=${c.material_rate}`);
  let tsnap = await taskSnapshot();
  check('T1 task open', !!tsnap.task && tsnap.task.status !== 'closed', `status=${tsnap.task?.status}`);
  const t1TaskId = tsnap.task?.id;

  // T2: correction to 25
  await turn('actually make it 25 per m');
  snap = await session();
  props = proposed(snap);
  check('T2 correction proposal present', props.length >= 1, `proposed=${props.length}`);
  if (!props.length) throw new Error('No proposal after T2 - inspect transcript');
  const r2 = await confirm(props[props.length - 1]);
  check('T2 confirm committed', r2.status === 200 && r2.body?.action?.status === 'committed');
  c = await compRow();
  check('T2 DB material_rate = 25', Number(c.material_rate) === 25, `material_rate=${c.material_rate}`);
  tsnap = await taskSnapshot();
  check('T2 SAME task continues', tsnap.task?.id === t1TaskId, `task=${tsnap.task?.id} status=${tsnap.task?.status}`);

  // T3: quantity 40
  await turn('set the Ridge quantity to 40');
  snap = await session();
  props = proposed(snap);
  check('T3 quantity proposal present', props.length >= 1, `proposed=${props.length}`);
  if (!props.length) throw new Error('No proposal after T3 - inspect transcript');
  const r3 = await confirm(props[props.length - 1]);
  check('T3 confirm committed', r3.status === 200 && r3.body?.action?.status === 'committed');
  const e = await entryRow();
  check('T3 DB entry raw_value = 40', Number(e.raw_value) === 40, `raw_value=${e.raw_value}`);
  tsnap = await taskSnapshot();
  check('T3 SAME task continues', tsnap.task?.id === t1TaskId, `task=${tsnap.task?.id} status=${tsnap.task?.status}`);

  // T4: done -> close
  const t4 = await turn('done');
  tsnap = await taskSnapshot();
  if (tsnap.task && tsnap.task.status !== 'closed') {
    // The real client calls the metadata-only close endpoint when a turn routes 'close'.
    const cr = await closeTaskEndpoint(tsnap.task);
    console.log(`close endpoint -> ${cr.status} ${JSON.stringify(cr.body).slice(0, 200)}`);
    tsnap = await taskSnapshot();
  }
  check('T4 task closed', !tsnap.task || tsnap.task.status === 'closed', `task=${tsnap.task?.id} status=${tsnap.task?.status}`);
  check('T4 close acknowledged in reply', /closed|fresh|next request/i.test(String(t4.reply)) || /closed|fresh/i.test(String(t4.text ?? '')));

  // T5: unrelated -> NEW task, no inheritance
  await turn('what are my quotes');
  snap = await session();
  tsnap = await taskSnapshot();
  check('T5 NEW task (different id, no inheritance)', !!tsnap.task && tsnap.task.id !== t1TaskId && tsnap.task.status !== 'closed', `task=${tsnap.task?.id} status=${tsnap.task?.status}`);
  check('T5 records card present', (snap.cards ?? []).some((x) => x.content?.kind === 'records'));

  // Evidence dump
  const runsRows = await sr('GET', `/rest/v1/smart_assistant_runs?select=id,status,error_code,tokens_in,tokens_out,created_at&conversation_id=eq.${conversationId}&order=created_at.asc`);
  console.log('\n--- RUNS ---');
  for (const rr of runsRows) console.log(JSON.stringify(rr));
  console.log('--- TASK SNAPSHOT ---');
  console.log(JSON.stringify(tsnap).slice(0, 600));
  check('No upstream_error in runs', runsRows.every((rr) => !rr.error_code), runsRows.filter((rr) => rr.error_code).map((rr) => rr.error_code).join('; ').slice(0, 200));

  const failed = RESULTS.filter((x) => !x.ok);
  console.log(`\n==== ROUND-2 BATTERY: ${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAILURES`} (${RESULTS.length} checks) ====`);
  process.exit(failed.length === 0 ? 0 : 1);
} catch (e) {
  console.error(`\nABORTED: ${e.message}`);
  console.log(`==== ROUND-2 BATTERY: ABORTED (state saved for inspection; cleanup with: node scripts/test-sa-task-round2-draft.mjs cleanup) ====`);
  process.exit(3);
}
