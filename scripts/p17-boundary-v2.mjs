/** P1.7 engine boundary gate v2: poll live window with trivial probe; when open,
 * fire engine-200 and engine-201 sequentially in-window (retry on transient 403). */
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
const state = JSON.parse(readFileSync(new URL('../../.sa-p17-scale-state.json', import.meta.url).pathname.replace(/^\//, ''), 'utf8'));
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const signIn = async (email, password) => {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error('signIn ' + r.status);
  return j;
};
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const cookieOf = (s) => createChunks('sb-qcp-auth', 'base64-' + stringToBase64URL(JSON.stringify(s))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
const call = async (token, runId, plan) => {
  const t0 = Date.now();
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_retrieval_query_v17`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_run_id: runId, p_revision: 1, p_plan: plan }), signal: AbortSignal.timeout(60000) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (Array.isArray(json)) json = json[0] ?? null;
  return { status: r.status, ok: r.ok, ms: Date.now() - t0, data: json, message: json?.message ?? text.slice(0, 160) };
};
const sess = await signIn(state.email, state.pwd);
const convId = randomUUID();
await fetch(`${SUPA_URL}/rest/v1/smart_assistant_conversations`, { method: 'POST', headers: { ...srH, Prefer: 'return=representation' }, body: JSON.stringify({ id: convId, company_id: state.coD, user_id: state.uidD }) });
const t0 = Date.now();
const turnP = fetch(`${BASE_URL}/api/smart-assistant/turn`, { method: 'POST', headers: { Cookie: cookieOf(sess), 'Content-Type': 'application/json', Origin: BASE_URL }, body: JSON.stringify({ conversationId: convId, message: 'Summarise my quotes, material orders and invoices with their totals', clientRequestId: randomUUID(), pageContext: { companyId: state.coD, pathname: `/${state.run}/quotes` } }), signal: AbortSignal.timeout(180000) }).catch((e) => ({ err: e.message }));
let runId = null;
for (let i = 0; i < 80 && !runId; i++) {
  await new Promise((r) => setTimeout(r, 250));
  const rows = await (await fetch(`${SUPA_URL}/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`, { headers: srH })).json();
  if (rows?.length && rows[0].status !== 'completed' && rows[0].status !== 'failed') runId = rows[0].id;
}
console.log('run captured:', runId, `+${Date.now() - t0}ms`);
const TRIVIAL = { version: 1, source: 'quotes', mode: 'rows', limit: 3 };
const aggPlan = (text) => ({ version: 1, source: 'quotes', mode: 'aggregate', quoteScope: 'quotes', search: { text, match: 'words' }, metrics: [{ field: 'builder_total', op: 'sum' }] });
let res200 = null, res201 = null;
for (let i = 0; i < 40 && (!res200 || !res201); i++) {
  const at = Date.now() - t0;
  const probe = await call(sess.access_token, runId, TRIVIAL);
  if (!probe.ok) { console.log(`+${at}ms window closed/not open (${probe.status})`); await new Promise((r) => setTimeout(r, 400)); continue; }
  if (!res200) {
    const r = await call(sess.access_token, runId, aggPlan('P17 ENGINE200'));
    console.log(`+${at}ms engine-200: ${r.status} ${r.ms}ms mode=${r.data?.mode} complete=${r.data?.complete} status=${r.data?.status} rows=${r.data?.rows?.length ?? '-'} warn=${JSON.stringify(r.data?.warnings)?.slice(0, 120)}`);
    if (r.ok || (r.data?.status && r.data?.status !== undefined)) res200 = { status: r.status, ms: r.ms, mode: r.data?.mode, complete: r.data?.complete, refusal: r.data?.status };
    if (!r.ok && r.message.includes('access_changed')) continue; // window closed mid-fire; retry
  }
  if (res200 && !res201) {
    const r = await call(sess.access_token, runId, aggPlan('P17 ENGINE201'));
    console.log(`+${at}ms engine-201: ${r.status} ${r.ms}ms mode=${r.data?.mode} complete=${r.data?.complete} status=${r.data?.status} warn=${JSON.stringify(r.data?.warnings)?.slice(0, 160)}`);
    if (r.ok || r.data?.status) res201 = { status: r.status, ms: r.ms, mode: r.data?.mode, complete: r.data?.complete, refusal: r.data?.status };
    if (!r.ok && r.message.includes('access_changed')) continue;
  }
}
await turnP;
console.log('turn done');
writeFileSync(new URL('../../.sa-p17-boundary.json', import.meta.url).pathname.replace(/^\//, ''), JSON.stringify({ res200, res201 }, null, 2));
const pass = res200?.mode === 'engine_inputs' && res200?.complete === true && res201?.refusal === 'too_broad';
console.log('boundary gate:', pass ? 'PASS' : 'FAIL', JSON.stringify({ res200, res201 }));
process.exit(pass ? 0 : 1);
