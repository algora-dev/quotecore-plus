// Smart Assistant end-to-end test harness (local dev server).
// Run: node scripts/test-smart-assistant.mjs   (needs `npm run dev` on :3000)
//
// Exercises the Smart Assistant API surface against a LOCAL dev server:
//   POST /api/smart-assistant/turn
//   GET  /api/smart-assistant/state
//   POST /api/smart-assistant/transcribe
// plus the tenant-scoped match_sa_chunks RPC (called directly against
// PostgREST with the USER's JWT - auth.uid() derived scope).
//
// Self-contained fixtures: creates two throwaway companies + auth users via
// the service-role key (company A = flag ON, company B = NO flag row), runs
// the scenarios, then deletes everything it created. No production rows are
// touched; quota changes are made only on the harness's own flag row and
// restored regardless of outcome.
//
// Env (from .env.local or process env):
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//   BASE_URL (default http://localhost:3000)
//   SMART_ASSISTANT_TEST_EMAIL / SMART_ASSISTANT_TEST_PASSWORD (optional
//     override - unused by default; the harness provisions its own users)

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// ── env ───────────────────────────────────────────────────────────────────
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

if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

// Exact chunker the app's server client uses (@supabase/ssr), so our
// hand-minted cookie parses identically to a browser session.
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const AUTH_COOKIE = 'sb-qcp-auth'; // app/lib/supabase/cookie-config.ts

// ── tiny test runner ──────────────────────────────────────────────────────
const results = [];
let bugNotes = [];
function record(name, status, detail = '') {
  results.push({ name, status, detail });
  const tag = status === 'PASS' ? 'PASS' : status === 'SKIP' ? 'SKIP' : 'FAIL';
  console.log(`  [${tag}] ${name}${detail ? ' - ' + detail : ''}`);
}
async function scenario(name, fn) {
  try {
    await fn();
  } catch (err) {
    record(name, 'FAIL', `threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── supabase helpers ──────────────────────────────────────────────────────
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`service-role ${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  return json;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);
const srSelect = (table, query) => sr('GET', `/rest/v1/${table}?${query}`);
const srPatch = (table, patch, query) => sr('PATCH', `/rest/v1/${table}?${query}`, patch);
const srDelete = (table, query) => sr('DELETE', `/rest/v1/${table}?${query}`);

async function createAuthUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: srH,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`createAuthUser ${email} -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.user?.id ?? j.id;
}
async function signIn(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn ${email} -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
/** Cookie header value replicating the app's @supabase/ssr session cookie. */
function sessionCookieHeader(session) {
  const encoded = 'base64-' + stringToBase64URL(JSON.stringify(session));
  const chunks = createChunks(AUTH_COOKIE, encoded);
  return chunks.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
}
function userClient(session) {
  const cookie = sessionCookieHeader(session);
  const jwt = session.access_token;
  return {
    async api(path, opts = {}) {
      const r = await fetch(`${BASE_URL}${path}`, { ...opts, headers: { ...opts.headers, Cookie: cookie } });
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      return { status: r.status, json, text };
    },
    /** RPC as the USER (auth.uid() engaged) straight against PostgREST. */
    async rpc(fn, params) {
      const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(params),
      });
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = text; }
      return { status: r.status, json, text };
    },
  };
}

// ── fixtures ──────────────────────────────────────────────────────────────
const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const PASSWORD = `Hx9-${RUN}-harness!`;
const A = { email: `qcp-harness-a-${RUN}@example.com` };
const B = { email: `qcp-harness-b-${RUN}@example.com` };
let convA, convB, happyReqId, happyRunId;
let originalQuota = null;

async function setup() {
  console.log(`\nSetup: provisioning throwaway fixtures (run tag ${RUN})`);
  // Companies (onboarding_completed_at set so requireCompanyContext doesn't redirect)
  const nowIso = new Date().toISOString();
  [A.company] = (await srInsert('companies', { name: `QCP Harness A ${RUN}`, slug: `qcp-harness-a-${RUN}`, onboarding_completed_at: nowIso })).map(r => r.id);
  [B.company] = (await srInsert('companies', { name: `QCP Harness B ${RUN}`, slug: `qcp-harness-b-${RUN}`, onboarding_completed_at: nowIso })).map(r => r.id);
  // Auth users + profiles
  A.uid = await createAuthUser(A.email, PASSWORD);
  B.uid = await createAuthUser(B.email, PASSWORD);
  await srInsert('users', [
    { id: A.uid, company_id: A.company, email: A.email, full_name: 'Harness A', role: 'owner' },
    { id: B.uid, company_id: B.company, email: B.email, full_name: 'Harness B', role: 'owner' },
  ]);
  // Flag row ONLY for company A (enabled)
  await srInsert('assistant_feature_flags', { company_id: A.company, enabled: true, quota_monthly_turns: 500 });
  originalQuota = 500;
  // Conversations (service-role; RLS owner-only insert is fine to bypass for fixtures)
  [convA] = (await srInsert('smart_assistant_conversations', { company_id: A.company, user_id: A.uid, title: 'harness A' })).map(r => r.id);
  [convB] = (await srInsert('smart_assistant_conversations', { company_id: B.company, user_id: B.uid, title: 'harness B' })).map(r => r.id);
  // Sessions
  A.session = await signIn(A.email, PASSWORD);
  B.session = await signIn(B.email, PASSWORD);
  A.client = userClient(A.session);
  B.client = userClient(B.session);
}

async function cleanup() {
  console.log('\nCleanup: removing harness fixtures');
  const errs = [];
  try {
    if (originalQuota !== null && A?.company) await srPatch('assistant_feature_flags', { quota_monthly_turns: originalQuota }, `company_id=eq.${A.company}`);
  } catch (e) { errs.push('quota restore: ' + e.message); }
  for (const c of [A?.company, B?.company].filter(Boolean)) {
    try { await srDelete('smart_assistant_runs', `company_id=eq.${c}`); } catch (e) { errs.push(`runs ${c}: ` + e.message); }
    try { await srDelete('companies', `id=eq.${c}`); } catch (e) { errs.push(`company ${c}: ` + e.message); }
  }
  for (const u of [A?.uid, B?.uid].filter(Boolean)) {
    try { await fetch(`${SUPA_URL}/auth/v1/admin/users/${u}`, { method: 'DELETE', headers: srH }); } catch (e) { errs.push(`auth user ${u}: ` + e.message); }
  }
  if (errs.length) console.log('  cleanup warnings:', errs.join(' | '));
  else console.log('  all test rows removed (companies cascade conversations/runs/messages/flags/reservations/usage)');
}

const turn = (client, conversationId, message, clientRequestId) =>
  client.api('/api/smart-assistant/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message, clientRequestId }),
  });

async function monthReservations(companyId) {
  const rows = await srSelect('assistant_turn_reservations', `company_id=eq.${companyId}&select=run_id,created_at`);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  return rows.filter((r) => new Date(r.created_at) >= monthStart).length;
}

// ── scenarios ─────────────────────────────────────────────────────────────
const scenarios = [
  ['1. Flag gating (no assistant_feature_flags row): turn', async () => {
    const r = await turn(B.client, convB, 'hello flag gate', 'harness-' + RUN + '-flagoff');
    assert(r.status === 404, `expected 404, got ${r.status}: ${r.text?.slice(0, 200)}`);
    assert(r.json?.error_code === 'flag_off', `expected error_code flag_off, got ${r.json?.error_code}`);
    record('1. Flag gating (no assistant_feature_flags row): turn', 'PASS', `404 flag_off`);
  }],
  ['1. Flag gating: state', async () => {
    const r = await B.client.api(`/api/smart-assistant/state?conversationId=${convB}`);
    if (r.status === 404) {
      record('1. Flag gating: state', 'PASS', '404 refused');
    } else {
      bugNotes.push(`BUG 2: /api/smart-assistant/state returns ${r.status} with full state for a flag-OFF company (no assistant_feature_flags row). Repro: authenticated user whose company has no flag row + a conversation they own -> GET /api/smart-assistant/state?conversationId=<id> returns 200 {conversation_id, active_run_id, run_status, messages}. app/api/smart-assistant/state/route.ts (no smart_assistant_enabled check) + public.sa_get_state (quotecore_v2_patch_043) also has none. Only owner-scoped data is exposed (no cross-tenant leak), but it contradicts patch_042's "flag off = assistant invisible everywhere".`);
      record('1. Flag gating: state', 'FAIL', `expected refusal (404), got ${r.status} - see bug notes`);
    }
  }],
  ['1. Flag gating: transcribe', async () => {
    const fd = new FormData();
    fd.append('audio', new File([new Uint8Array([1, 2, 3])], 'a.webm', { type: 'audio/webm' }));
    const r = await B.client.api('/api/smart-assistant/transcribe', { method: 'POST', body: fd });
    assert(r.status === 404, `expected 404, got ${r.status}: ${r.text?.slice(0, 200)}`);
    record('1. Flag gating: transcribe', 'PASS', '404 refused');
  }],
  ['1. Unauthenticated turn/state/transcribe refused', async () => {
    const noAuth = await fetch(`${BASE_URL}/api/smart-assistant/turn`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convA, message: 'x'.repeat(20), clientRequestId: 'harness-' + RUN + '-noauth' }),
    });
    const noAuthState = await fetch(`${BASE_URL}/api/smart-assistant/state?conversationId=${convA}`);
    const noAuthTr = await fetch(`${BASE_URL}/api/smart-assistant/transcribe`, { method: 'POST' });
    assert(noAuth.status === 401 && noAuthState.status === 401 && noAuthTr.status === 401,
      `expected 401s, got turn=${noAuth.status} state=${noAuthState.status} transcribe=${noAuthTr.status}`);
    record('1. Unauthenticated turn/state/transcribe refused', 'PASS', '401 x3');
  }],
  ['2. Turn happy path + quota reservation', async () => {
    happyReqId = 'harness-' + RUN + '-happy';
    const before = await monthReservations(A.company);
    const r = await turn(A.client, convA, 'Reply with exactly the word OK and nothing else.', happyReqId);
    if (r.status !== 200 || r.json?.status !== 'completed') {
      throw new Error(`expected 200 completed, got ${r.status}: ${r.text?.slice(0, 300)}`);
    }
    happyRunId = r.json.run_id;
    assert(typeof r.json.reply === 'string' && r.json.reply.length > 0, 'expected non-empty reply');
    const after = await monthReservations(A.company);
    assert(after === before + 1, `reservation count expected ${before + 1}, got ${after}`);
    const [run] = await srSelect('smart_assistant_runs', `id=eq.${happyRunId}&select=status,tokens_in,tokens_out`);
    assert(run?.status === 'completed', `run status ${run?.status}`);
    const ev = await srSelect('assistant_usage_events', `run_id=eq.${happyRunId}&select=id`);
    assert(ev.length === 1, 'expected exactly one usage event');
    record('2. Turn happy path + quota reservation', 'PASS', `run=${happyRunId.slice(0, 8)} reply=${r.json.reply.slice(0, 30).replace(/\n/g, ' ')}`);
  }],
  ['3. Duplicate submit dedup (no double charge)', async () => {
    const before = await monthReservations(A.company);
    const r = await turn(A.client, convA, 'Reply with exactly the word OK and nothing else.', happyReqId);
    if (r.status === 200 && r.json?.status === 'duplicate' && r.json?.run_id === happyRunId) {
      const after = await monthReservations(A.company);
      assert(after === before, `reservation count changed: ${before} -> ${after}`);
      record('3. Duplicate submit dedup (no double charge)', 'PASS', `same run, reservations ${before}==${after}`);
      return;
    }
    if (r.status === 500 && /smart_assistant_runs_conversation_id_client_request_id_key/.test(String(r.json?.error))) {
      bugNotes.push(`BUG 1 (confirmed live): duplicate replay of an admitted/completed request returns HTTP 500 with Postgres unique-violation instead of {status:'duplicate'}. Root cause: the LIVE database function public.sa_admit_run's idempotency block is missing the bare RETURN; statements after the 'request_id_conflict' and 'duplicate' RETURN QUERY ... rows, so execution falls through to the smart_assistant_runs INSERT (23505). The migration file backend/supabase/migrations/quotecore_v2_patch_045_smart_assistant_hardening.sql contains the correct RETURN;s - the live DB definition is out of sync with it (verify: SELECT pg_get_functiondef('sa_admit_run'::regproc); the duplicate branch ends with END IF and no RETURN). Repro: (1) auth user, flag-on company, conversation; (2) POST /api/smart-assistant/turn with clientRequestId X -> completes; (3) POST same conversationId+message+clientRequestId X again -> 500 {"error":"duplicate key value violates unique constraint smart_assistant_runs_conversation_id_client_request_id_key"}. Side effect of same bug: while a run is active, the RPC returns TWO rows (duplicate + run_in_progress); the route reads row[0] and masks it. Also means dedup-before-quota (MEMORY invariant) breaks with 500 once quota is exhausted.`);
      record('3. Duplicate submit dedup (no double charge)', 'FAIL', '500 unique-violation - live sa_admit_run missing RETURN; in dedup block (see BUG 1)');
      return;
    }
    throw new Error(`expected 200 duplicate, got ${r.status}: ${r.text?.slice(0, 200)}`);
  }],
  ['4. request_id conflict (same id, different payload)', async () => {
    const r = await turn(A.client, convA, 'DIFFERENT payload entirely.', happyReqId);
    if (r.status === 409 && r.json?.error_code === 'request_id_conflict') {
      record('4. request_id conflict (same id, different payload)', 'PASS', '409 request_id_conflict');
      return;
    }
    if (r.status === 500 && /smart_assistant_runs_conversation_id_client_request_id_key/.test(String(r.json?.error))) {
      record('4. request_id conflict (same id, different payload)', 'FAIL', 'same root cause as BUG 1: conflict branch falls through to INSERT -> 500 instead of 409 (see BUG 1)');
      return;
    }
    throw new Error(`expected 409, got ${r.status}: ${r.text?.slice(0, 200)}`);
  }],
  ['5. One-active-run slot (second turn busy)', async () => {
    // Deterministic: plant an in-flight run directly (service role) so no
    // timing race - exactly what a live run looks like to sa_admit_run.
    const [run] = await srInsert('smart_assistant_runs', {
      conversation_id: convA, user_id: A.uid, company_id: A.company,
      client_request_id: 'harness-' + RUN + '-inflight', payload_hash: 'x', status: 'running',
    });
    A.inflightRunId = run.id;
    await srPatch('smart_assistant_conversations', { active_run_id: run.id }, `id=eq.${convA}`);
    const r = await turn(A.client, convA, 'Should be busy.', 'harness-' + RUN + '-busy');
    assert(r.status === 409, `expected 409, got ${r.status}: ${r.text?.slice(0, 200)}`);
    assert(r.json?.error_code === 'run_in_progress', `expected run_in_progress, got ${r.json?.error_code}`);
    record('5. One-active-run slot (second turn busy)', 'PASS', '409 run_in_progress');
  }],
  ['7. Reconnect state (mid-run status, no auto-resubmit)', async () => {
    // Run #5's in-flight run is still active on convA.
    const r1 = await A.client.api(`/api/smart-assistant/state?conversationId=${convA}`);
    assert(r1.status === 200, `expected 200, got ${r1.status}`);
    assert(r1.json?.active_run_id === A.inflightRunId, `active_run_id mismatch: ${r1.json?.active_run_id}`);
    assert(r1.json?.run_status === 'running', `run_status: ${r1.json?.run_status}`);
    const msgsAfter = await srSelect('smart_assistant_messages', `conversation_id=eq.${convA}&select=id`);
    const runsAfter = await srSelect('smart_assistant_runs', `conversation_id=eq.${convA}&select=id`);
    const r2 = await A.client.api(`/api/smart-assistant/state?conversationId=${convA}`);
    const msgsAfter2 = await srSelect('smart_assistant_messages', `conversation_id=eq.${convA}&select=id`);
    const runsAfter2 = await srSelect('smart_assistant_runs', `conversation_id=eq.${convA}&select=id`);
    assert(runsAfter2.length === runsAfter.length, `GET state created a run (${runsAfter.length} -> ${runsAfter2.length})`);
    assert(msgsAfter2.length === msgsAfter.length, `GET state created messages (${msgsAfter.length} -> ${msgsAfter2.length})`);
    record('7. Reconnect state (mid-run status, no auto-resubmit)', 'PASS', `run_status=running, idempotent across GETs`);
  }],
  ['6. Quota cap enforced + restored', async () => {
    // Release the scenario-5 planted run so turns can be admitted again.
    await srPatch('smart_assistant_conversations', { active_run_id: null }, `id=eq.${convA}`);
    await srDelete('smart_assistant_runs', `id=eq.${A.inflightRunId}`);
    const used = await monthReservations(A.company);
    await srPatch('assistant_feature_flags', { quota_monthly_turns: used }, `company_id=eq.${A.company}`); // cap == used => over limit
    const over = await turn(A.client, convA, 'Should hit quota.', 'harness-' + RUN + '-overquota');
    assert(over.status === 429, `expected 429, got ${over.status}: ${over.text?.slice(0, 200)}`);
    assert(over.json?.error_code === 'quota_exceeded', `expected quota_exceeded, got ${over.json?.error_code}`);
    // MEMORY invariant: duplicate replay resolves BEFORE quota refusal.
    // (Currently broken by BUG 1: the fall-through hits the runs INSERT -> 500.)
    const dup = await turn(A.client, convA, 'Reply with exactly the word OK and nothing else.', happyReqId);
    record('6a. Dedup-before-quota (MEMORY invariant)',
      dup.status === 200 && dup.json?.status === 'duplicate' ? 'PASS' : 'FAIL',
      dup.status === 200 ? 'duplicate ok' : `got ${dup.status} ${String(dup.json?.error).slice(0, 90)} - consequence of BUG 1`);
    await srPatch('assistant_feature_flags', { quota_monthly_turns: originalQuota }, `company_id=eq.${A.company}`);
    const ok = await turn(A.client, convA, 'One more turn after restore.', 'harness-' + RUN + '-postquota');
    assert(ok.status === 200 && ok.json?.status === 'completed', `post-restore turn failed: ${ok.status} ${ok.text?.slice(0, 200)}`);
    const [flag] = await srSelect('assistant_feature_flags', `company_id=eq.${A.company}&select=quota_monthly_turns`);
    assert(flag.quota_monthly_turns === originalQuota, `quota not restored: ${flag.quota_monthly_turns}`);
    record('6. Quota cap enforced + restored', 'PASS', `cap=${used} -> 429 quota_exceeded; dedup still 200; quota restored to ${originalQuota}`);
  }],
  ['8. Cross-tenant RLS: match_sa_chunks scoped to auth.uid()', async () => {
    // Seed: B secret chunk + A own chunk, both "ready", identical embeddings.
    const vec = '[' + Array(1536).fill(0).map((_, i) => (i === 0 ? 1 : 0)).join(',') + ']';
    const [docB] = (await srInsert('assistant_knowledge_docs', { company_id: B.company, file_name: 'b.txt', storage_path: 'harness/b.txt', status: 'ready' })).map(r => r.id);
    const [docA] = (await srInsert('assistant_knowledge_docs', { company_id: A.company, file_name: 'a.txt', storage_path: 'harness/a.txt', status: 'ready' })).map(r => r.id);
    await srInsert('assistant_knowledge_chunks', [
      { doc_id: docB, company_id: B.company, chunk_index: 0, content: `SECRET-B-${RUN}`, embedding: vec },
      { doc_id: docA, company_id: A.company, chunk_index: 0, content: `OWN-A-${RUN}`, embedding: vec },
    ]);
    A.docId = docA; B.docId = docB;
    // User A explicitly asks for company B's scope: must still get own-scope only.
    const r = await A.client.rpc('match_sa_chunks', { p_query_embedding: vec, p_match_count: 20, p_company: B.company });
    assert(r.status === 200, `rpc status ${r.status}: ${r.text?.slice(0, 200)}`);
    const rows = r.json ?? [];
    for (const row of rows) {
      assert(row.company_id === A.company, `cross-tenant leak: got chunk of company ${row.company_id}`);
      assert(!String(row.content).includes('SECRET-B'), 'cross-tenant leak: B content returned');
    }
    const sawOwn = rows.some((row) => row.content === `OWN-A-${RUN}`);
    record('8. Cross-tenant RLS: match_sa_chunks scoped to auth.uid()', 'PASS',
      `${rows.length} row(s)${sawOwn ? ', own chunk present' : ', own chunk absent (own-scope may be empty - never B rows)'}`);
  }],
  ['9. Transcribe: unauth refused', async () => {
    const r = await fetch(`${BASE_URL}/api/smart-assistant/transcribe`, { method: 'POST' });
    assert(r.status === 401, `expected 401, got ${r.status}`);
    record('9. Transcribe: unauth refused', 'PASS', '401');
  }],
  ['9. Transcribe: size cap (15MB) enforced', async () => {
    const post = async (size) => {
      const fd = new FormData();
      fd.append('audio', new File([new Uint8Array(size)], 'big.webm', { type: 'audio/webm' }));
      return A.client.api('/api/smart-assistant/transcribe', { method: 'POST', body: fd });
    };
    // Small garbage audio proves the auth+flag+parse path works (expect a
    // 502 from OpenAI rejecting non-audio bytes, NOT a parse error).
    const small = await post(64 * 1024);
    assert(small.status !== 400 || !/Audio upload required/.test(String(small.json?.error)), `64KB upload failed to parse: ${small.text?.slice(0, 150)}`);
    const r = await post(15 * 1024 * 1024 + 1);
    if (r.status === 413) {
      record('9. Transcribe: size cap (15MB) enforced', 'PASS', '413 for 15MB+1');
      return;
    }
    if (r.status === 400) {
      bugNotes.push(`BUG 3: transcribe 15MB+1 upload returns 400 "Audio upload required" (formData() parse failure) instead of the intended 413 "Recording too long" - the size cap in app/api/smart-assistant/transcribe/route.ts (MAX_BYTES check, ~line 48) is unreachable for large multipart bodies on local Next.js dev: req.formData() throws before the file size is inspected. Repro: POST /api/smart-assistant/transcribe (authenticated, flag-on company) with a 15MB+1 byte 'audio' file -> 400 {"error":"Audio upload required"}.`);
      record('9. Transcribe: size cap (15MB) enforced', 'FAIL', `got 400 (formData parse throws before size check) - see BUG 3`);
      return;
    }
    throw new Error(`expected 413, got ${r.status}: ${r.text?.slice(0, 200)}`);
  }],
];

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Smart Assistant harness -> ${BASE_URL}`);
  // Server up?
  try {
    await fetch(BASE_URL, { method: 'HEAD' });
  } catch {
    console.error(`Dev server not reachable at ${BASE_URL}. Start it with: npm run dev`);
    process.exit(2);
  }
  await setup();
  try {
    for (const [name, fn] of scenarios) await scenario(name, fn);
  } finally {
    await cleanup();
  }
  // Summary
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;
  console.log('\n==================== SUMMARY ====================');
  for (const r of results) console.log(`  ${r.status.padEnd(4)} ${r.name}`);
  console.log(`  PASS=${pass}  FAIL=${fail}  SKIP=${skip}`);
  if (bugNotes.length) {
    console.log('\nBUGS / FINDINGS (not fixed, per instructions):');
    bugNotes.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
  }
  console.log(`Quota for harness company restored to ${originalQuota} (company itself deleted).`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error('HARNESS ERROR:', err); process.exit(2); });
