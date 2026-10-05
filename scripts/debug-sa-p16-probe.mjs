// Debug: probe sa_v2_retrieval_query every 400ms during a live turn,
// recording run status + probe outcome at each step.
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
const STATE_PATH = new URL('../../.sa-p16-state.json', import.meta.url).pathname.replace(/^\//, '');
const s = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const srGet = async (path) => (await fetch(`${SUPA_URL}${path}`, { headers: srH })).json();
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const cookieA = s.cookieA;
const convId = randomUUID();
await fetch(`${SUPA_URL}/rest/v1/smart_assistant_conversations`, { method: 'POST', headers: { ...srH, Prefer: 'return=representation' }, body: JSON.stringify({ id: convId, company_id: s.coA, user_id: s.uidA }) });

const turnPromise = fetch(`${BASE_URL}/api/smart-assistant/turn`, {
  method: 'POST', headers: { Cookie: cookieA, 'Content-Type': 'application/json', Origin: BASE_URL },
  body: JSON.stringify({ conversationId: convId, message: 'Summarise my quotes, material orders and invoices with their totals', clientRequestId: randomUUID(), pageContext: { companyId: s.coA, pathname: `/${s.run}/quotes` } }),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const probe = async (plan) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_retrieval_query`, {
    method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${s.tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_run_id: runId, p_revision: s.revision ?? 1, p_plan: plan }),
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, msg: (j?.message ?? (typeof j === 'object' && j !== null && !j.message) ? 'OK-rows:' + (Array.isArray(j?.rows) ? j.rows.length : '?') : String(text).slice(0, 60)) };
};

let runId = null;
const trace = [];
for (let i = 0; i < 120 && !runId; i++) {
  await new Promise((r) => setTimeout(r, 250));
  const rows = await srGet(`/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`);
  if (rows && rows.length && rows[0].status !== 'completed' && rows[0].status !== 'failed') runId = rows[0].id;
  if (i === 119) runId = rows?.[0]?.id ?? 'none';
}
console.log('captured run', runId);
const simplePlan = { version: '1', source: 'quotes', mode: 'rows', search: { text: 'Maple Ridge', match: 'words' }, limit: 5 };
for (let i = 0; i < 40; i++) {
  const runRow = (await srGet(`/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=status&order=started_at.desc&limit=1`))[0];
  const p = await probe(simplePlan);
  trace.push({ t: i, runStatus: runRow?.status, probeStatus: p.status, msg: p.msg });
  console.log(`t${i} run=${runRow?.status} probe=${p.status} ${p.msg}`);
  if (runRow?.status === 'completed' || runRow?.status === 'failed') break;
  await new Promise((r) => setTimeout(r, 400));
}
const tr = await turnPromise;
console.log('turn done', tr.status, JSON.stringify(tr.body?.reply ?? '').slice(0, 150));
writeFileSync(new URL('../../.sa-p16-probe-trace.json', import.meta.url).pathname.replace(/^\//, ''), JSON.stringify(trace, null, 2));
