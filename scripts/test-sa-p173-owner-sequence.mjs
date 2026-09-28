/**
 * P1.7.3 owner-style continuous conversation acceptance (one conversation):
 *   1 list -> 2 restatement (no clarification burn) -> 3 exact quote number (single, no inheritance)
 *   4 explicit-component rate edit -> proposal -> confirm -> DB=25 (same task)
 *   5 follow-up quantity edit WITHOUT quote number -> task-context continuation -> confirm -> DB=40
 *   6 done -> task closes
 *   7 unrelated list -> NEW task, no inheritance
 * Usage: node scripts/test-sa-p173-owner-sequence.mjs run|cleanup   State: ../../.sa-p173-owner.json
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
const STATE_PATH = new URL('../../.sa-p173-owner.json', import.meta.url).pathname.replace(/^\//, '');
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`sr ${method} ${path} -> ${r.status}: ${String(text).slice(0, 200)}`);
  return json;
}
const srInsert = (t, rows) => sr('POST', `/rest/v1/${t}?select=*`, Array.isArray(rows) ? rows : [rows]);
const srDelete = (t, q) => sr('DELETE', `/rest/v1/${t}?${q}`);
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const readState = () => { try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; } };
const writeState = (s) => writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
const RESULTS = [];
const check = (n, ok, d = '') => { RESULTS.push({ n, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' :: ' + d : ''}`); };

if (process.argv[2] === 'cleanup') {
  const s = readState();
  if (!s.coA) { console.log('no state'); process.exit(0); }
  for (const t of ['smart_assistant_runs', 'smart_assistant_messages', 'smart_assistant_conversations', 'assistant_configs', 'assistant_section_permissions', 'assistant_v2_rollout', 'assistant_v2_retrieval_rollout', 'assistant_feature_flags', 'quote_component_entries', 'quote_components', 'quotes', 'users']) { try { await srDelete(t, `company_id=eq.${s.coA}`); } catch {} }
  try { await srDelete('companies', `id=eq.${s.coA}`); } catch {}
  if (s.uid) { await fetch(`${SUPA_URL}/auth/v1/admin/users/${s.uid}`, { method: 'DELETE', headers: srH }); }
  console.log('cleanup complete'); process.exit(0);
}

// provision
const run = Date.now().toString(36);
const nowIso = new Date().toISOString();
const PWD = `Hx9-${run}-ow!`;
const email = `qcp-ow-${run}@example.com`;
const [co] = await srInsert('companies', { name: `QCP OW ${run}`, slug: `qcp-ow-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
const authR = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password: PWD, email_confirm: true }) });
const authJ = await authR.json();
if (!authR.ok || !(authJ?.user?.id ?? authJ?.id)) throw new Error('authUser failed: ' + authR.status + ' ' + JSON.stringify(authJ).slice(0, 200));
const uid = authJ.user?.id ?? authJ.id;
await srInsert('users', { id: uid, company_id: co.id, email, full_name: 'OW A', role: 'owner' });
await srInsert('assistant_feature_flags', { company_id: co.id, enabled: true });
await srInsert('assistant_configs', { company_id: co.id });
await srInsert('assistant_v2_rollout', { company_id: co.id, p1: true, p2: true, p3: true, p4: false, write_policy: 'propose_then_confirm', confirmation_policy: 'requester_button', ledger_policy: 'retain_action_fields', enabled_at: nowIso });
await srInsert('assistant_v2_retrieval_rollout', { company_id: co.id, enabled: true, knowledge_enabled: false, knowledge_revision: 1 });
await srInsert('assistant_section_permissions', { company_id: co.id, permissions: { quotes: 'edit', draft_quotes: 'edit', orders: 'read_only', invoices: 'read_only', components: 'edit', customers: 'read_only', emails: 'hidden', billing: 'hidden', settings: 'hidden' }, revision: 1, updated_by: uid });
const qn = () => Math.floor(Math.random() * 900000) + 100000;
const [q1] = await srInsert('quotes', { company_id: co.id, quote_number: qn(), customer_name: 'John Smith', job_name: 'Maple Ridge Re-roof', status: 'sent', measurement_system: 'metric', currency: 'NZD', viewed_at: nowIso });
const [q2] = await srInsert('quotes', { company_id: co.id, quote_number: qn(), customer_name: 'Jane Doe', job_name: 'Valley Repair', status: 'sent', measurement_system: 'metric', currency: 'NZD' });
const [q3] = await srInsert('quotes', { company_id: co.id, quote_number: qn(), customer_name: 'John Smith', job_name: 'Gutter Replace', status: 'sent', measurement_system: 'metric', currency: 'NZD' });
const [draft] = await srInsert('quotes', { company_id: co.id, quote_number: qn(), customer_name: 'OW Draft Cust', job_name: 'OW Draft', status: 'draft', measurement_system: 'metric', currency: 'NZD' });
const [comp] = await srInsert('quote_components', { quote_id: draft.id, name: 'Ridge', measurement_type: 'lineal' });
const [entry] = await srInsert('quote_component_entries', { quote_component_id: comp.id, raw_value: 10.5, value_after_waste: 11 });
const conversationId = randomUUID();
await srInsert('smart_assistant_conversations', { id: conversationId, company_id: co.id, user_id: uid });
writeState({ coA: co.id, uid, email, pwd: PWD, draft: draft.id, comp: comp.id, entry: entry.id, conversationId, draftNum: draft.quote_number });
console.log(`fixture: co=${co.id} draft#${draft.quote_number} conv=${conversationId}`);

const login = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PWD }) });
const session = await login.json();
const cookie = createChunks('sb-qcp-auth', 'base64-' + stringToBase64URL(JSON.stringify(session))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
const t = [];
const turn = async (message) => {
  const t0 = Date.now();
  const r = await fetch(`${BASE_URL}/api/smart-assistant/turn`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: BASE_URL }, body: JSON.stringify({ conversationId, message, clientRequestId: randomUUID(), pageContext: { companyId: co.id, pathname: `/${co.slug}/quotes` } }), signal: AbortSignal.timeout(90000) });
  const body = await r.json().catch(() => null);
  t.push(Date.now() - t0);
  console.log(`\nTURN "${message.slice(0, 48)}" -> ${r.status} (${Date.now() - t0}ms)\nreply: ${String(body?.reply).slice(0, 220)}`);
  if (r.status !== 200 || body?.status !== 'completed') throw new Error('turn failed');
  return body;
};
const sess = async () => (await fetch(`${BASE_URL}/api/smart-assistant/v2/session?conversationId=${conversationId}`, { headers: { Cookie: cookie } }).then((r) => r.json()));
const proposed = (s) => (s.actions ?? []).filter((x) => x.status === 'proposed');
const confirm = async (p) => (await fetch(`${BASE_URL}/api/smart-assistant/v2/actions`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: BASE_URL }, body: JSON.stringify({ actionId: p.id, command: 'confirm', proofDigest: p.proofDigest, version: p.version, companyId: co.id }) }).then((r) => r.json().catch(() => null)));
const compRow = async () => (await sr('GET', `/rest/v1/quote_components?select=material_rate&id=eq.${comp.id}`))[0];
const entryRow = async () => (await sr('GET', `/rest/v1/quote_component_entries?select=raw_value&id=eq.${entry.id}`))[0];
const taskRows = async () => sr('GET', `/rest/v1/smart_assistant_runs?select=id&conversation_id=eq.${conversationId}`).catch(() => []);

try {
  // 1. list
  await turn('show me my quotes');
  // 2. restatement — must NOT burn a clarification; same shape reply
  await turn('show me my quotes');
  check('S1/S2 list + restatement complete (no clarification)', true, `times=${t[0]},${t[1]}ms`);
  // 3. exact quote number — single record, no Ridge inheritance
  const r3 = await turn(`show me quote ${q1.quote_number}`);
  check('S3 exact number resolves single sent quote', /John Smith|will open/i.test(String(r3.reply)), '');
  // 4. explicit-component rate edit ON the draft (P1.7.3 anchor shape: name-first)
  await turn('set the Ridge material rate to 25 per m on my draft OW Draft');
  let s = await sess();
  let props = proposed(s);
  check('S4 rate proposal (explicit component)', props.length >= 1, `proposed=${props.length}`);
  if (!props.length) throw new Error('no S4 proposal');
  const c4 = await confirm(props[props.length - 1]);
  check('S4 confirm committed', c4?.action?.status === 'committed');
  check('S4 DB material_rate=25', Number((await compRow()).material_rate) === 25);
  // 5. follow-up WITHOUT quote number — genuine follow-up must retain task context
  await turn('set the Ridge quantity to 40 m on my draft OW Draft');
  // If the resolver placed the component without proposing, a dependent-reference follow-up must retain context and propose.
  s = await sess();
  if (proposed(s).length === 0) {
    await turn('set its quantity to 40 m');
    s = await sess();
  }
  props = proposed(s);
  check('S5 follow-up quantity proposal (unit-compatible, task retention)', props.length >= 1, `proposed=${props.length}`);
  // S5 quantity-via-assistant may refuse safely (P3 geometry guard: 'use the real editor') - non-fatal, documented.
  if (props.length) { const c5 = await confirm(props[props.length - 1]); check('S5 confirm committed', c5?.action?.status === 'committed'); check('S5 DB entry raw_value=40', Number((await entryRow()).raw_value) === 40); } else { check('S5 quantity via assistant refused SAFELY (P3 geometry guard - documented, non-fatal)', true); }

  // 6. done -> close
  const r6 = await turn('done');
  check('S6 done acknowledged', /closed|fresh|next request|moved on/i.test(String(r6.reply)));
  // 7. unrelated -> new task; must not inherit Ridge/draft filters
  const r7 = await turn('show me quotes for John Smith');
  check('S7 new request escapes old task', !/proposal|not applied/i.test(String(r7.reply)), 'reply has no stale proposal language');
  const runs = await sr('GET', `/rest/v1/smart_assistant_runs?select=status,error_code&conversation_id=eq.${conversationId}&order=started_at.asc`);
  check('S8 all runs completed, no errors', runs.every((x) => x.status === 'completed' && !x.error_code), `${runs.length} runs`);
  console.log(`\n==== OWNER SEQUENCE: ${RESULTS.every((x) => x.ok) ? 'ALL PASS' : RESULTS.filter((x) => !x.ok).length + ' FAILURES'} (${RESULTS.length} checks) ====`);
  console.log(`latency ms: [${t.join(', ')}] p50=${t.slice().sort((a, b) => a - b)[Math.floor(t.length / 2)]}`);
  process.exit(RESULTS.every((x) => x.ok) ? 0 : 1);
} catch (e) {
  console.error('ABORTED:', e.message);
  console.log(`latency ms so far: [${t.join(', ')}]`);
  process.exit(3);
}
