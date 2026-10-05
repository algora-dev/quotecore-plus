/**
 * P1.7.3 session-reader migration acceptance: before/after verification.
 * Fixture uses REAL app turns so the conversation is representative:
 *   turn 1 fired WITHOUT retrieval rollout row -> real FAILED run with error_code
 *   retrieval row added -> turn 2 -> real COMPLETED run
 * Usage: node scripts/test-sa-p173-session-read.mjs setup|before|after|crossuser|cleanup
 * State: ../../.sa-p173-state.json
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
const STATE_PATH = new URL('../../.sa-p173-state.json', import.meta.url).pathname.replace(/^\//, '');
if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(2); }
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`service-role ${method} ${path} -> ${r.status}: ${String(text).slice(0, 300)}`);
  return json;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);
const srPatch = (table, patch, query) => sr('PATCH', `/rest/v1/${table}?${query}`, patch);
const srDelete = (table, query) => sr('DELETE', `/rest/v1/${table}?${query}`);
async function createAuthUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`createAuthUser -> ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.user?.id ?? j.id;
}
async function deleteAuthUser(id) { await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: srH }); }
async function signIn(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn -> ${r.status}`);
  return j;
}
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const AUTH_COOKIE = 'sb-qcp-auth';
const sessionCookieHeader = (session) => createChunks(AUTH_COOKIE, 'base64-' + stringToBase64URL(JSON.stringify(session))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
async function fireTurn(cookie, conversationId, companyId, message) {
  const r = await fetch(`${BASE_URL}/api/smart-assistant/turn`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ conversationId, message, clientRequestId: randomUUID(), pageContext: { companyId, pathname: `/${companyId}/quotes` } }),
    signal: AbortSignal.timeout(60000),
  });
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
}
const readState = () => { try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; } };
const writeState = (s) => writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
const rpcAs = async (fn, body, token) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text.slice(0, 1500) };
};
const cmd = process.argv[2] ?? '';

if (cmd === 'cleanup') {
  const s = readState();
  if (!s.run) { console.error('No state'); process.exit(2); }
  const errs = [];
  for (const t of ['smart_assistant_runs', 'smart_assistant_messages', 'smart_assistant_conversations', 'assistant_configs', 'assistant_section_permissions', 'assistant_v2_rollout', 'assistant_v2_retrieval_rollout', 'assistant_feature_flags', 'users']) { try { await srDelete(t, `company_id=eq.${s.coA}`); } catch (e) { errs.push(`${t}: ${e.message.slice(0, 80)}`); } }
  for (const co of [s.coA, s.coB]) { if (co) { try { await srDelete('companies', `id=eq.${co}`); } catch (e) { errs.push(e.message.slice(0, 80)); } } }
  for (const [k, id] of [['A', s.uidA], ['B', s.uidB]]) if (id) { try { await deleteAuthUser(id); } catch (e) { errs.push(k); } }
  console.log(errs.length ? `cleanup notes: ${errs.length}` : 'cleanup complete');
  process.exit(0);
}

if (cmd === 'setup') {
  const run = Date.now().toString(36);
  const nowIso = new Date().toISOString();
  const PWD = `Hx9-${run}-p173!`;
  const emailA = `qcp-p173-${run}@example.com`;
  const emailB = `qcp-p173b-${run}@example.com`;
  const [coA] = await srInsert('companies', { name: `QCP P173 ${run}`, slug: `qcp-p173-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
  const [coB] = await srInsert('companies', { name: `QCP P173B ${run}`, slug: `qcp-p173b-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
  const uidA = await createAuthUser(emailA, PWD);
  const uidB = await createAuthUser(emailB, PWD);
  await srInsert('users', [
    { id: uidA, company_id: coA.id, email: emailA, full_name: 'P173 A', role: 'owner' },
    { id: uidB, company_id: coB.id, email: emailB, full_name: 'P173 B', role: 'owner' },
  ]);
  for (const co of [coA, coB]) {
    await srInsert('assistant_feature_flags', { company_id: co.id, enabled: true });
    await srInsert('assistant_configs', { company_id: co.id });
  }
  await srInsert('assistant_v2_rollout', [{ company_id: coA.id, p1: true, p2: true, p3: true, p4: false, write_policy: 'propose_then_confirm', confirmation_policy: 'requester_button', ledger_policy: 'retain_action_fields', enabled_at: nowIso }]);
  await srInsert('assistant_section_permissions', { company_id: coA.id, permissions: { quotes: 'read_only', draft_quotes: 'read_only', orders: 'read_only', invoices: 'read_only', components: 'read_only', customers: 'read_only', emails: 'hidden', billing: 'hidden', settings: 'hidden' }, revision: 1, updated_by: uidA });
  const conversationId = randomUUID();
  await srInsert('smart_assistant_conversations', { id: conversationId, company_id: coA.id, user_id: uidA });
  const s = { run, coA: coA.id, coB: coB.id, uidA, uidB, emailA, emailB, pwd: PWD, conversationId };
  writeState(s); // save early so cleanup always works
  const session = await signIn(emailA, PWD);
  const cookie = sessionCookieHeader(session);
  // Turn 1: NO retrieval rollout row -> on pre-P1.7.3 live code this fails and writes a real run with error_code.
  const t1 = await fireTurn(cookie, conversationId, coA.id, 'what are my quotes');
  console.log(`turn1 (no rollout row): status=${t1.status} reply=${String(t1.body?.reply ?? JSON.stringify(t1.body)).slice(0, 120)}`);
  // Add the retrieval rollout row -> task context ready.
  await srInsert('assistant_v2_retrieval_rollout', { company_id: coA.id, enabled: true, knowledge_enabled: false, knowledge_revision: 1 });
  const t2 = await fireTurn(cookie, conversationId, coA.id, 'what are my quotes');
  console.log(`turn2 (rollout row added): status=${t2.status} reply=${String(t2.body?.reply ?? JSON.stringify(t2.body)).slice(0, 120)}`);
  const runs = await sr('GET', `/rest/v1/smart_assistant_runs?select=status,error_code&conversation_id=eq.${conversationId}&order=started_at.asc`);
  for (const r of runs) console.log('run:', r.status, r.error_code);
  console.log(`fixture ready: coA=${coA.id} conversation=${conversationId}`);
  process.exit(0);
}

if (cmd === 'before' || cmd === 'after' || cmd === 'crossuser') {
  const s = readState();
  const email = cmd === 'crossuser' ? s.emailB : s.emailA;
  const session = await signIn(email, s.pwd);
  const res = await rpcAs('sa_v2_session_read', { p_conversation_id: s.conversationId }, session.access_token);
  console.log(`[${cmd}] status=${res.status}`);
  try {
    const parsed = JSON.parse(res.body);
    if (cmd === 'after') {
      console.log('recent_runs present:', Array.isArray(parsed.recent_runs));
      console.log('recent_runs count:', parsed.recent_runs?.length);
      for (const r of parsed.recent_runs ?? []) console.log(' ', r.status, r.error_code, r.started_at);
      console.log('session fields kept:', ['messages', 'runs', 'cards'].every((k) => k in parsed) || Object.keys(parsed).join(','));
    } else if (cmd === 'before') {
      console.log('recent_runs field present:', 'recent_runs' in parsed);
      console.log('top-level keys:', Object.keys(parsed).join(','));
    } else {
      console.log('crossuser body:', res.body.slice(0, 300));
    }
  } catch (e) { console.log('body:', res.body); }
  const fsx = await import('node:fs');
  fsx.writeFileSync(process.env.TEMP + '/p173-session-' + cmd + '.json', res.body);
  process.exit(0);
}
if (cmd === 'rollout') {
  const s = readState();
  // Remove the retrieval rollout row entirely -> missing-row class on LIVE P1.7.3 code.
  await srDelete('assistant_v2_retrieval_rollout', `company_id=eq.${s.coA}`);
  const session = await signIn(s.emailA, s.pwd);
  const cookie = sessionCookieHeader(session);
  const conv1 = randomUUID();
  await srInsert('smart_assistant_conversations', { id: conv1, company_id: s.coA, user_id: s.uidA });
  const t1 = await fireTurn(cookie, conv1, s.coA, 'what are my quotes');
  console.log(`[no-row] status=${t1.status} reply=${String(t1.body?.reply ?? JSON.stringify(t1.body)).slice(0, 140)}`);
  // Explicit disabled row -> must still fall back safely.
  await srInsert('assistant_v2_retrieval_rollout', { company_id: s.coA, enabled: false, knowledge_enabled: false, knowledge_revision: 1 });
  const conv2 = randomUUID();
  await srInsert('smart_assistant_conversations', { id: conv2, company_id: s.coA, user_id: s.uidA });
  const t2 = await fireTurn(cookie, conv2, s.coA, 'what are my quotes');
  console.log(`[disabled] status=${t2.status} reply=${String(t2.body?.reply ?? JSON.stringify(t2.body)).slice(0, 140)}`);
  // Re-enable -> task context path must work again.
  await srPatch('assistant_v2_retrieval_rollout', { enabled: true }, `company_id=eq.${s.coA}`);
  const conv3 = randomUUID();
  await srInsert('smart_assistant_conversations', { id: conv3, company_id: s.coA, user_id: s.uidA });
  const t3 = await fireTurn(cookie, conv3, s.coA, 'what are my quotes');
  console.log(`[enabled] status=${t3.status} reply=${String(t3.body?.reply ?? JSON.stringify(t3.body)).slice(0, 140)}`);
  const rows = await sr('GET', `/rest/v1/smart_assistant_runs?select=status,error_code&conversation_id=in.(${conv1},${conv2},${conv3})&order=started_at.asc`);
  for (const r of rows) console.log('run:', r.status, r.error_code);
  process.exit(0);
}
if (cmd === 'canary') {
  const s = readState();
  // Promote fixture user A to admin, then call the admin canary API route.
  await srPatch('users', { is_admin: true }, `id=eq.${s.uidA}`);
  const session = await signIn(s.emailA, s.pwd);
  const cookie = sessionCookieHeader(session);
  const r = await fetch(`${BASE_URL}/api/admin/smart-assistant/health`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: BASE_URL } });
  const body = await r.json().catch(() => null);
  console.log(`[canary] status=${r.status} body=${JSON.stringify(body).slice(0, 500)}`);
  await srPatch('users', { is_admin: false }, `id=eq.${s.uidA}`);
  const r2 = await fetch(`${BASE_URL}/api/admin/smart-assistant/health`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: BASE_URL } });
  console.log(`[canary-after-demote status=${r2.status}] (expect 403/redirect - admin gate holds)`);
  process.exit(0);
}
console.error('usage: setup|before|after|crossuser|rollout|canary|cleanup');
process.exit(2);
