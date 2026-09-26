/**
 * P1.7 latency/consistency repeat harness: fires identical prompts 5x in fresh
 * conversations against stable fixtures; records replies, timings, and run
 * token accounting for p50/p95 + consistency analysis. Read-only prompts.
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

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.BASE_URL || 'https://quotecore-plus-testing.vercel.app';
const STATE_PATH = new URL('../../.sa-p16-state.json', import.meta.url).pathname.replace(/^\//, '');
const OUT_PATH = new URL('../../.sa-p17-repeat-results.json', import.meta.url).pathname.replace(/^\//, '');
const s = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`sr ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text || 'null');
}
const signIn = async (email, password) => {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error('signIn ' + r.status);
  return j;
};
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const cookie = (sess) => createChunks('sb-qcp-auth', 'base64-' + stringToBase64URL(JSON.stringify(sess))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
const sess = await signIn(s.emailA, s.pwd);
const cookieA = cookie(sess);

const CASES = [
  { id: 'count-ridge', prompt: 'How many Ridge components are there across all my quotes and drafts?', expect: /3/ },
  { id: 'related-orders', prompt: 'Which material orders link to the Maple Ridge quote for John Smith?', expect: /PO-A1|Plumbing World/ },
  { id: 'composite-open', prompt: 'Show me the Ridge component on my 9th canvas test draft', expect: /9th canvas test/ },
  { id: 'unpaid-invoices', prompt: 'Which of my invoices are not paid yet?', expect: /INV-1001/ },
];
const REPEATS = 5;
const out = { baseUrl: BASE_URL, startedAt: new Date().toISOString(), repeats: REPEATS, cases: [] };

for (const c of CASES) {
  const runs = [];
  for (let i = 0; i < REPEATS; i++) {
    const convId = randomUUID();
    await sr('POST', '/rest/v1/smart_assistant_conversations', { id: convId, company_id: s.coA, user_id: s.uidA });
    const t0 = Date.now();
    const r = await fetch(`${BASE_URL}/api/smart-assistant/turn`, {
      method: 'POST',
      headers: { Cookie: cookieA, 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ conversationId: convId, message: c.prompt, clientRequestId: randomUUID(), pageContext: { companyId: s.coA, pathname: `/${s.run}/quotes` } }),
      signal: AbortSignal.timeout(180000),
    });
    const j = await r.json().catch(() => null);
    const ms = Date.now() - t0;
    const reply = j?.reply ?? j?.message ?? '';
    const runRows = await sr('GET', `/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status,tokens_in,tokens_out&order=started_at.asc`);
    runs.push({ i, convId, http: r.status, status: j?.status, ms, reply: String(reply).slice(0, 500),
      match: c.expect ? c.expect.test(String(reply)) : null,
      runs: runRows.map((x) => ({ status: x.status, tin: x.tokens_in, tout: x.tokens_out })) });
    console.log(`${c.id}[${i}] ${r.status}/${j?.status} ${ms}ms match=${c.expect ? c.expect.test(String(reply)) : 'n/a'}`);
    await new Promise((r2) => setTimeout(r2, 1500));
  }
  const times = runs.map((x) => x.ms).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length / 2)];
  const p95 = times[Math.ceil(times.length * 0.95) - 1];
  const matches = runs.filter((x) => x.match === true).length;
  out.cases.push({ id: c.id, prompt: c.prompt, p50, p95, min: times[0], max: times[times.length - 1], matches, total: REPEATS, runs });
  console.log(`  => ${c.id}: ${matches}/${REPEATS} match, p50=${p50}ms p95=${p95}ms min=${times[0]} max=${times[times.length-1]}`);
}
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log('saved', OUT_PATH);
