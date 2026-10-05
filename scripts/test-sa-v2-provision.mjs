/**
 * SA V2 P3 acceptance battery provisioner (2026-09-26).
 * Provisions a THROWAWAY company (never RS Roofing) with fixture rows,
 * creates conversation/cards/proposals through real assistant turns, and
 * writes the harness fixture JSON (outside the repo, never committed).
 *
 * Subcommands:
 *   node scripts/test-sa-v2-provision.mjs setup    # company+fixtures+cards -> fixtures phase 2
 *   node scripts/test-sa-v2-provision.mjs p3       # flip p3, propose via real turns -> fixtures phase 3
 *   node scripts/test-sa-v2-provision.mjs cleanup  # delete everything created
 *
 * Env (from .env.local or process env) + BASE_URL (default testing deployment).
 * Fixture file: SA_V2_FIXTURES path or default ../.sa-v2-fixtures.json (workspace).
 * See docs/SMART_ASSISTANT_P1_P4_ACCEPTANCE.md for the fixture contract.
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
const FIXTURES_PATH = process.env.SA_V2_FIXTURES
  || new URL('../../.sa-v2-fixtures.json', import.meta.url).pathname.replace(/^\//, '');
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
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j };
}
async function turn(cookie, conversationId, message, companyId, pathname) {
  // client_request_id must be a UUID: the app's fail-closed session parser
  // (parseRunOutcome) rejects non-UUID request ids and the whole session read
  // 503s. Real clients send UUIDs - found by this battery 2026-09-26.
  const r = await app('POST', '/api/smart-assistant/turn', cookie, {
    conversationId, message, clientRequestId: randomUUID(),
    pageContext: { companyId, pathname },
  });
  if (r.status !== 200 || r.body?.status !== 'completed') throw new Error(`turn "${message}" -> ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}
async function readSession(cookie, conversationId) {
  const r = await app('GET', `/api/smart-assistant/v2/session?conversationId=${conversationId}`, cookie);
  if (r.status !== 200) throw new Error(`session read -> ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}

const cmd = process.argv[2] ?? '';
const RUN = readState().run ?? '';
function readState() { try { return JSON.parse(readFileSync(new URL('../../.sa-v2-state.json', import.meta.url), 'utf8')); } catch { return {}; } }
function writeState(s) { writeFileSync(new URL('../../.sa-v2-state.json', import.meta.url), JSON.stringify(s, null, 2)); }

// ── setup ─────────────────────────────────────────────────────────
if (cmd === 'setup') {
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nowIso = new Date().toISOString();
  const PWD = `Hx9-${run}-sa!`;
  const state = { run };
  console.log(`setup run=${run} base=${BASE_URL}`);

  const [coA] = await srInsert('companies', { name: `QCP SA E2E ${run}`, slug: `qcp-sa-e2e-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
  const [coB] = await srInsert('companies', { name: `QCP SA Foreign ${run}`, slug: `qcp-sa-foreign-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
  const uidA = await createAuthUser(`qcp-sa-a-${run}@example.com`, PWD);
  const uidB = await createAuthUser(`qcp-sa-b-${run}@example.com`, PWD);
  const uidC = await createAuthUser(`qcp-sa-c-${run}@example.com`, PWD);
  await srInsert('users', [
    { id: uidA, company_id: coA.id, email: `qcp-sa-a-${run}@example.com`, full_name: 'SA E2E A', role: 'owner' },
    { id: uidB, company_id: coA.id, email: `qcp-sa-b-${run}@example.com`, full_name: 'SA E2E B', role: 'member' },
    { id: uidC, company_id: coB.id, email: `qcp-sa-c-${run}@example.com`, full_name: 'SA E2E C', role: 'owner' },
  ]);
  await srInsert('assistant_feature_flags', [{ company_id: coA.id, enabled: true }, { company_id: coB.id, enabled: true }]);
  await srInsert('assistant_v2_rollout', [
    { company_id: coA.id, p1: true, p2: true, p3: false, p4: false, write_policy: 'propose_then_confirm', confirmation_policy: 'requester_button', ledger_policy: 'retain_action_fields', enabled_at: nowIso },
    { company_id: coB.id, p1: true, p2: true, p3: false, p4: false, write_policy: 'propose_then_confirm', confirmation_policy: 'requester_button', ledger_policy: 'retain_action_fields', enabled_at: nowIso },
  ]);
  await srInsert('assistant_section_permissions', { company_id: coA.id, permissions: { quotes: 'edit', draft_quotes: 'edit', orders: 'read_only', invoices: 'read_only', components: 'edit', customers: 'read_only', emails: 'hidden', billing: 'hidden', settings: 'hidden' }, revision: 1, updated_by: uidA });
  Object.assign(state, { coA: coA.id, coB: coB.id, uidA, uidB, uidC, emailA: `qcp-sa-a-${run}@example.com`, emailB: `qcp-sa-b-${run}@example.com`, emailC: `qcp-sa-c-${run}@example.com`, pwd: PWD });
  writeState(state); // save early so cleanup always works
  console.log(`companies A=${coA.id} B=${coB.id} users A=${uidA} B=${uidB} C=${uidC}`);

  // Attention fixtures: 2 viewed sent quotes (not accepted), 1 overdue invoice, 1 supplier-waiting order.
  const qNum = () => Math.floor(Math.random() * 900000) + 100000;
  const [v1] = await srInsert('quotes', { company_id: coA.id, quote_number: qNum(), customer_name: 'Viewed One', job_name: 'Viewed Job One', status: 'sent', measurement_system: 'metric', currency: 'NZD', viewed_at: nowIso });
  const [v2] = await srInsert('quotes', { company_id: coA.id, quote_number: qNum(), customer_name: 'Viewed Two', job_name: 'Viewed Job Two', status: 'sent', measurement_system: 'metric', currency: 'NZD', viewed_at: nowIso });
  const [draft] = await srInsert('quotes', { company_id: coA.id, quote_number: qNum(), customer_name: 'SA P3 Draft', job_name: 'P3 Fixture Draft', status: 'draft', measurement_system: 'metric', currency: 'NZD' });
  const [comp] = await srInsert('quote_components', { quote_id: draft.id, name: 'Ridge', measurement_type: 'lineal' });
  await srInsert('quote_component_entries', { quote_component_id: comp.id, raw_value: 10.5, value_after_waste: 11 });
  const [inv] = await srInsert('invoices', { company_id: coA.id, invoice_number: `INV-${run}`, payment_reference: 'none', customer_name: 'Overdue Customer', status: 'sent', due_date: '2026-09-20', total: 100, currency: 'NZD' });
  const [ord] = await srInsert('material_orders', { company_id: coA.id, order_number: `PO-${run}`, supplier_name: 'Test Supplier', job_name: 'Awaiting Job', status: 'ordered', is_sent: true });
  Object.assign(state, { v1: v1.id, v2: v2.id, draft: draft.id, comp: comp.id, inv: inv.id, ord: ord.id });
  console.log(`fixtures quotes v1=${v1.id} v2=${v2.id} draft=${draft.id} comp=${comp.id} inv=${inv.id} ord=${ord.id}`);

  // Conversation via the same insert the app's createConversation action performs.
  const conversationId = randomUUID();
  await srInsert('smart_assistant_conversations', { id: conversationId, company_id: coA.id, user_id: uidA });
  const sessionA = await signIn(state.emailA, PWD);
  const cookieA = sessionCookieHeader(sessionA);
  const sessionB = await signIn(state.emailB, PWD);
  const cookieB = sessionCookieHeader(sessionB);
  const sessionC = await signIn(state.emailC, PWD);
  const cookieC = sessionCookieHeader(sessionC);

  await turn(cookieA, conversationId, 'what are my quotes', coA.id, `/${coA.slug}/quotes`);
  await turn(cookieA, conversationId, 'what needs my attention', coA.id, `/${coA.slug}/quotes`);
  const snap = await readSession(cookieA, conversationId);
  const recordsCard = snap.cards.find((c) => c.content?.kind === 'records');
  const attentionCard = snap.cards.find((c) => c.content?.kind === 'attention');
  if (!recordsCard) throw new Error('No records card in session after "what are my quotes"');
  if (!attentionCard) throw new Error('No attention card after "what needs my attention"');
  const target = recordsCard.content.options[0];
  // Sent/confirmed quotes deep-link to their summary view; drafts open the quote page.
  const targetDetail = snap.access ? null : null;
  const quoteStatus = (await sr('GET', `/rest/v1/quotes?select=status&id=eq.${target.id}`))[0]?.status;
  const expectedDestination = `/${coA.slug}/quotes/${target.id}${quoteStatus === 'sent' || quoteStatus === 'confirmed' ? '/summary' : ''}`;
  Object.assign(state, { conversationId });
  writeState(state);
  writeFileSync(FIXTURES_PATH, JSON.stringify({
    baseUrl: BASE_URL,
    workspaceSlug: coA.slug,
    phase: 2,
    a: { cookie: cookieA, userId: uidA, companyId: coA.id, conversationId, recordCardId: recordsCard.id, targetId: target.id, attentionCardId: attentionCard.id },
    b: { cookie: cookieB },
    foreign: { cookie: cookieC },
    expectedDestination,
    expectedAttention: {
      viewed_quotes: { state: 'available', count: 2 },
      supplier_waiting: { state: 'available', count: 1 },
      overdue_invoices: { state: 'available', count: 1 },
      followups: { state: 'hidden', count: null },
    },
  }, null, 2));
  console.log(`conversation=${conversationId}`);
  console.log(`recordCard=${recordsCard.id} target=${target.id} attentionCard=${attentionCard.id}`);
  console.log(`fixtures written: ${FIXTURES_PATH} (phase 2)`);
  process.exit(0);
}

// ── p3: flip + propose via real turns ────────────────────────────
if (cmd === 'p3') {
  const state = readState();
  await srPatch('assistant_v2_rollout', { p3: true, updated_at: new Date().toISOString() }, `company_id=eq.${state.coA}`);
  const sessionA = await signIn(state.emailA, state.pwd);
  const cookieA = sessionCookieHeader(sessionA);
  const slug = (await sr('GET', `/rest/v1/companies?select=slug&id=eq.${state.coA}`))[0]?.slug;
  await turn(cookieA, state.conversationId, `set the material rate on the Ridge component of my draft "SA P3 Draft" to 25 per m`, state.coA, `/${slug}/quotes`);
  await turn(cookieA, state.conversationId, `rename the job name on my draft "SA P3 Draft" to "Renamed Job"`, state.coA, `/${slug}/quotes`);
  const snap = await readSession(cookieA, state.conversationId);
  const proposed = (snap.actions ?? []).filter((x) => x.status === 'proposed');
  console.log('proposed actions:', JSON.stringify(proposed.map((x) => ({ id: x.id, title: x.title })), null, 2));
  if (proposed.length < 2) throw new Error(`Expected >=2 proposed actions, got ${proposed.length}. Model may not have proposed - inspect the transcript.`);
  const confirm = proposed.find((x) => /rate|material/i.test(x.title ?? '')) ?? proposed[0];
  const cancel = proposed.find((x) => x.id !== confirm.id);
  const f = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'));
  f.phase = 3;
  f.a.confirmActionId = confirm.id;
  f.a.cancelActionId = cancel.id;
  writeFileSync(FIXTURES_PATH, JSON.stringify(f, null, 2));
  console.log(`fixtures updated: phase 3 confirm=${confirm.id} cancel=${cancel.id}`);
  process.exit(0);
}

// ── cleanup ───────────────────────────────────────────────────────
if (cmd === 'cleanup') {
  const s = readState();
  if (!s.run) { console.error('No state'); process.exit(2); }
  const errs = [];
  const tables = ['assistant_v2_actions', 'sa_action_log', 'assistant_v2_cards', 'assistant_v2_context', 'smart_assistant_messages', 'smart_assistant_runs', 'assistant_turn_reservations', 'assistant_usage_events', 'assistant_events', 'smart_assistant_conversations', 'assistant_section_permissions', 'assistant_v2_rollout', 'assistant_feature_flags', 'quote_component_entries', 'quote_components', 'quotes', 'invoices', 'material_orders'];
  for (const cid of [s.coA, s.coB]) {
    if (!cid) continue;
    for (const t of tables) { try { await srDelete(t, `company_id=eq.${cid}`); } catch (e) { errs.push(`${t}: ${e.message.slice(0, 120)}`); } }
    try { await srDelete('users', `company_id=eq.${cid}`); } catch (e) { errs.push(`users: ${e.message.slice(0, 120)}`); }
    try { await srDelete('companies', `id=eq.${cid}`); } catch (e) { errs.push(`companies: ${e.message.slice(0, 120)}`); }
  }
  for (const [k, id] of [['A', s.uidA], ['B', s.uidB], ['C', s.uidC]]) if (id) { try { await deleteAuthUser(id); } catch (e) { errs.push(`auth${k}: ${e.message.slice(0, 120)}`); } }
  console.log(errs.length ? `cleanup finished with ${errs.length} notes:\n${errs.join('\n')}` : 'cleanup complete');
  process.exit(0);
}

console.error('usage: node scripts/test-sa-v2-provision.mjs setup|p3|cleanup');
process.exit(2);
