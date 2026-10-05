/**
 * P1.7 live-turn probe: fires natural-language composite/retrieval prompts as
 * fixture user A on the testing deployment and records responses + timings.
 * Read-only prompts only (no confirmation presses). Billing: real Luna turns.
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
const OUT_PATH = new URL('../../.sa-p17-live-turns.json', import.meta.url).pathname.replace(/^\//, '');
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
const convId = randomUUID();
await sr('POST', '/rest/v1/smart_assistant_conversations', { id: convId, company_id: s.coA, user_id: s.uidA });

const CASES = process.argv[2] === 'happy' ? [
  { id: 'composite-open-happy', prompt: 'Open the Ridge component on my draft 9th canvas test' },
  { id: 'proposal-prep-happy', prompt: 'Set the material rate on the Ridge component of my draft 9th canvas test to 30 dollars per metre' },
] : [
  { id: 'composite-open', prompt: 'Open the Ridge component on my draft 9th canvas test' },
  { id: 'semantic-unpaid', prompt: 'How many unpaid invoices do I have?' },
  { id: 'ranking-orders', prompt: 'Show my order lines with the biggest quantities' },
  { id: 'engine-total', prompt: "What's my total saved quote value across non-draft quotes?" },
  { id: 'proposal-prep', prompt: 'Set the material rate on the Ridge component of my draft 9th canvas test to 30 dollars per metre' },
];

const out = { baseUrl: BASE_URL, conversationId: convId, startedAt: new Date().toISOString(), cases: [] };
for (const c of CASES) {
  const t0 = Date.now();
  const r = await fetch(`${BASE_URL}/api/smart-assistant/turn`, {
    method: 'POST',
    headers: { Cookie: cookieA, 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ conversationId: convId, message: c.prompt, clientRequestId: randomUUID(), pageContext: { companyId: s.coA, pathname: `/${s.run}/quotes` } }),
    signal: AbortSignal.timeout(180000),
  });
  const j = await r.json().catch(() => null);
  const ms = Date.now() - t0;
  const reply = j?.reply ?? j?.message ?? j?.assistantMessage ?? null;
  const cards = j?.cards ?? j?.v2?.cards ?? null;
  out.cases.push({ id: c.id, prompt: c.prompt, status: r.status, bodyStatus: j?.status, ms,
    reply: typeof reply === 'string' ? reply.slice(0, 600) : JSON.stringify(reply)?.slice(0, 600),
    cards: JSON.stringify(cards)?.slice(0, 400), raw: JSON.stringify(j)?.slice(0, 900) });
  console.log(`${c.id}: http=${r.status} body=${j?.status} ${ms}ms`);
  console.log('  reply:', (typeof reply === 'string' ? reply : JSON.stringify(reply) ?? '').slice(0, 300).replace(/\n/g, ' '));
  await new Promise((r2) => setTimeout(r2, 1200));
}
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log('saved', OUT_PATH);
