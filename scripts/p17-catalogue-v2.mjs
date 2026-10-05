/** P1.7 catalogue probes + caller-abort test, fired inside a proven-open live window. */
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
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_retrieval_query_v17`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_run_id: runId, p_revision: 1, p_plan: plan }), signal: AbortSignal.timeout(clientTimeoutMs ?? 60000) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (Array.isArray(json)) json = json[0] ?? null;
  return { status: r.status, ok: r.ok, ms: Date.now() - t0, data: json, message: (json?.message ?? text).slice(0, 160) };
}
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
let opened = false;
for (let i = 0; i < 40 && !opened; i++) {
  const p = await call(sess.access_token, runId, TRIVIAL);
  if (p.ok) opened = true; else await new Promise((r) => setTimeout(r, 300));
}
console.log('window open:', opened, `+${Date.now() - t0}ms`);
const out = { probes: [], abort: {} };
if (opened) {
  const timed = async (label, plan) => {
    const r = await call(sess.access_token, runId, plan);
    const rows = r.data?.rows ?? [];
    console.log(`${label}: ${r.status} ${r.ms}ms rows=${rows.length} sample=${JSON.stringify(rows[0] ?? r.data?.status ?? r.message).slice(0, 120)}`);
    out.probes.push({ label, status: r.status, ms: r.ms, rowCount: rows.length, first: rows[0] ?? null, refusal: r.data?.status ?? null });
  };
  await timed('catalogue-exact-unique', { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'P17 UNIQUE MARLEY MODERN 89.50', match: 'exact' }, limit: 5 });
  await timed('catalogue-words-dense', { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'p17 tile red', match: 'words' }, limit: 5 });
  await timed('catalogue-count-all', { version: 1, source: 'catalogue_rows', mode: 'aggregate', metrics: [{ op: 'count' }] });
  // caller-abort test: dense read with 120ms client abort
  let aborted = false, errKind = '';
  const ta = Date.now();
  try { await call(sess.access_token, runId, { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'p17 tile red', match: 'words' }, limit: 5 }, 120); }
  catch (e) { aborted = true; errKind = e.name; }
  console.log(`abort: client aborted=${aborted} (${errKind}) after ${Date.now() - ta}ms`);
  out.abort.client = { aborted, errKind, ms: Date.now() - ta };
  // observe server activity immediately
  const actSql = "SELECT pid, state, wait_event_type, now()-query_start AS age, left(query,140) AS q FROM pg_stat_activity WHERE query ILIKE '%catalog_rows%' AND pid <> pg_backend_pid() ORDER BY query_start;";
  const runAct = () => {
    writeFileSync('C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-activity.sql', actSql, 'utf8');
    return execFileSync('powershell', ['-File', 'C:/Users/Jimmy/.openclaw/workspace-gavin/.db-query.ps1', 'C:/Users/Jimmy/.openclaw/workspace-gavin/tmp-activity.sql'], { encoding: 'utf8', timeout: 60000 });
  };
  const act1 = await runAct();
  console.log('pg_stat_activity right after abort:', String(act1).replace(/\s+/g, ' ').slice(0, 400));
  out.abort.activityImmediately = String(act1).slice(0, 1500);
  await new Promise((r) => setTimeout(r, 3000));
  const act2 = await runAct();
  console.log('pg_stat_activity 3s later:', String(act2).replace(/\s+/g, ' ').slice(0, 400));
  out.abort.activity3sLater = String(act2).slice(0, 1500);
  // re-fire the same query normally
  const rf = await call(sess.access_token, runId, { version: 1, source: 'catalogue_rows', mode: 'rows', search: { text: 'p17 tile red', match: 'words' }, limit: 5 });
  console.log(`re-fire: ${rf.status} ${rf.ms}ms rows=${rf.data?.rows?.length ?? 0}`);
  out.abort.refire = { status: rf.status, ms: rf.ms, rows: rf.data?.rows?.length ?? 0 };
}
await turnP;
writeFileSync(new URL('../../.sa-p17-catalogue-probes.json', import.meta.url).pathname.replace(/^\//, ''), JSON.stringify(out, null, 2));
console.log('catalogue probes + abort test saved');
process.exit(0);
