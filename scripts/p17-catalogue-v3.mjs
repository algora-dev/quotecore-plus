/** P1.7 catalogue scale probes v3: one probe per admitted window (words-dense first),
 * plus a REAL client-abort test (long catalogue query aborted at 500ms client-side,
 * server-side activity observed at 0s/2s/9s). */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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
async function call(token, runId, plan, clientTimeoutMs) {
  const t0 = Date.now();
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_retrieval_query_v17`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_run_id: runId, p_revision: 1, p_plan: plan }), signal: AbortSignal.timeout(clientTimeoutMs ?? 90000) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (Array.isArray(json)) json = json[0] ?? null;
  return { status: r.status, ok: r.ok, ms: Date.now() - t0, data: json, message: (json?.message ?? text).slice(0, 160) };
}
async function admitWindow(sess) {
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
  let opened = false;
  for (let i = 0; i < 40 && !opened; i++) {
    const p = await call(sess.access_token, runId, { version: 1, source: 'quotes', mode: 'rows', limit: 3 });
    if (p.ok) opened = true; else await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`window ${opened ? 'open' : 'FAILED'} run=${runId} +${Date.now() - t0}ms`);
  return { turnP, runId };
}
const actSql = "SELECT pid, state, wait_event_type, now()-query_start AS age, left(query,120) AS q FROM pg_stat_activity WHERE query ILIKE '%catalog_rows%' AND pid <> pg_backend_pid() ORDER BY query_start;";
const runAct = () => {
  writeFileSync('C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-activity.sql', actSql, 'utf8');
  return execFileSync('powershell', ['-File', 'C:/Users/Jimmy/.openclaw/workspace-gavin/.db-query.ps1', 'C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-activity.sql'], { encoding: 'utf8', timeout: 60000 });
};
const sess = await signIn(state.email, state.pwd);
const out = { probes: [], abort: {} };
const DENSE = { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'p17 tile red', match: 'words' }, limit: 5 };

// Window 1: timed words-dense + REAL abort test in parallel
{
  const { turnP, runId } = await admitWindow(sess);
  const abortP = (async () => {
    const t0 = Date.now();
    try { await call(sess.access_token, runId, DENSE, 500); return { aborted: false, ms: Date.now() - t0 }; }
    catch (e) { return { aborted: true, kind: e.name, ms: Date.now() - t0 }; }
  })();
  const timed = await call(sess.access_token, runId, DENSE);
  console.log(`catalogue-words-dense: ${timed.status} ${timed.ms}ms rows=${timed.data?.rows?.length ?? 0}`);
  out.probes.push({ label: 'catalogue-words-dense', status: timed.status, ms: timed.ms, rowCount: timed.data?.rows?.length ?? 0 });
  const ab = await abortP;
  console.log(`abort client: ${JSON.stringify(ab)}`);
  out.abort.client = ab;
  const a0 = await runAct();
  console.log('activity right after abort:', String(a0).replace(/\s+/g, ' ').slice(0, 300));
  out.abort.at0 = String(a0).slice(0, 1200);
  await new Promise((r) => setTimeout(r, 2000));
  const a2 = await runAct();
  console.log('activity +2s:', String(a2).replace(/\s+/g, ' ').slice(0, 300));
  out.abort.at2s = String(a2).slice(0, 1200);
  await new Promise((r) => setTimeout(r, 7000));
  const a9 = await runAct();
  console.log('activity +9s:', String(a9).replace(/\s+/g, ' ').slice(0, 300));
  out.abort.at9s = String(a9).slice(0, 1200);
  await turnP;
}

// Window 2: count over full population
{
  const { turnP, runId } = await admitWindow(sess);
  const timed = await call(sess.access_token, runId, { version: 1, source: 'catalogue_rows', mode: 'aggregate', metrics: [{ op: 'count' }] });
  console.log(`catalogue-count-all: ${timed.status} ${timed.ms}ms rows0=${JSON.stringify(timed.data?.rows?.[0] ?? timed.message).slice(0, 120)}`);
  out.probes.push({ label: 'catalogue-count-all', status: timed.status, ms: timed.ms, first: timed.data?.rows?.[0] ?? timed.message });
  await turnP;
}

// Window 3: exact-unique with corrected text (description only, no price suffix)
{
  const { turnP, runId } = await admitWindow(sess);
  const timed = await call(sess.access_token, runId, { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'P17 UNIQUE MARLEY MODERN', match: 'exact' }, limit: 5 });
  console.log(`catalogue-exact-unique: ${timed.status} ${timed.ms}ms rows=${timed.data?.rows?.length ?? 0} first=${JSON.stringify(timed.data?.rows?.[0] ?? timed.message).slice(0, 140)}`);
  out.probes.push({ label: 'catalogue-exact-unique', status: timed.status, ms: timed.ms, rowCount: timed.data?.rows?.length ?? 0, first: timed.data?.rows?.[0] ?? timed.message });
  await turnP;
}

writeFileSync(new URL('../../.sa-p17-catalogue-v3.json', import.meta.url).pathname.replace(/^\//, ''), JSON.stringify(out, null, 2));
console.log('v3 catalogue probes + abort saved');
process.exit(0);
