/** Diagnostic: during a live D-company turn, poll capabilities + trivial query_v17
 * + run status every 250ms to find the exact window where each succeeds/fails. */
import { readFileSync } from 'node:fs';
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
const state = JSON.parse(readFileSync(new URL('../../.sa-p17-scale-state.json', import.meta.url).pathname.replace(/^\//, ''), 'utf8'));
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const sr = async (path) => (await fetch(`${SUPA_URL}${path}`, { headers: srH })).json();
const signIn = async (email, password) => {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error('signIn ' + r.status);
  return j;
};
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const cookieOf = (s) => createChunks('sb-qcp-auth', 'base64-' + stringToBase64URL(JSON.stringify(s))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
const sess = await signIn(state.email, state.pwd);
const token = sess.access_token;
const convId = randomUUID();
await fetch(`${SUPA_URL}/rest/v1/smart_assistant_conversations`, { method: 'POST', headers: { ...srH, Prefer: 'return=representation' }, body: JSON.stringify({ id: convId, company_id: state.coD, user_id: state.uidD }) });
const t0 = Date.now();
const turnP = fetch(`${BASE_URL}/api/smart-assistant/turn`, { method: 'POST', headers: { Cookie: cookieOf(sess), 'Content-Type': 'application/json', Origin: BASE_URL }, body: JSON.stringify({ conversationId: convId, message: 'Summarise my quotes, material orders and invoices with their totals', clientRequestId: randomUUID(), pageContext: { companyId: state.coD, pathname: `/${state.run}/quotes` } }), signal: AbortSignal.timeout(180000) }).catch((e) => ({ err: e.message }));
let runId = null;
for (let i = 0; i < 80 && !runId; i++) {
  await new Promise((r) => setTimeout(r, 250));
  const rows = await sr(`/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`);
  if (rows?.length && rows[0].status !== 'completed' && rows[0].status !== 'failed') runId = rows[0].id;
}
console.log(`run captured at +${Date.now() - t0}ms: ${runId}`);
const call = async (fn, body) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  return { s: r.status, m: text.slice(0, 120) };
};
for (let i = 0; i < 40; i++) {
  const at = Date.now() - t0;
  const run = await sr(`/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=status&order=started_at.desc&limit=1`);
  const cap = await call('sa_v2_retrieval_capabilities', { p_run_id: runId, p_revision: 1 });
  const q = await call('sa_v2_retrieval_query_v17', { p_run_id: runId, p_revision: 1, p_plan: { version: 1, source: 'quotes', mode: 'rows', limit: 3 } });
  const agg = await call('sa_v2_retrieval_query_v17', { p_run_id: runId, p_revision: 1, p_plan: { version: 1, source: 'quotes', mode: 'aggregate', quoteScope: 'quotes', search: { text: 'P17 ENGINE200', match: 'words' }, metrics: [{ field: 'builder_total', op: 'sum' }] } });
  console.log(`+${at}ms run=${run?.[0]?.status} cap=${cap.s} rows=${q.s} agg=${agg.s}${agg.s !== 200 ? ' AGG-ERR:' + agg.m.replace(/\s+/g, ' ').slice(0, 150) : ' agg-mode=' + (agg.m.match(/"mode":"(\w+)"/)?.[1] ?? '?')}`);
  if (run?.[0]?.status === 'completed' && i > 2) break;
  await new Promise((r) => setTimeout(r, 250));
}
await turnP;
console.log('turn done at +' + (Date.now() - t0) + 'ms');
