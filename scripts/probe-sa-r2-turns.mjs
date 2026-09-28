// Probe: same throwaway company, one fast-path turn + one action turn.
// Discriminates fixture/auth problems (both fail) vs model-path-only failure.
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
const BASE_URL = process.env.BASE_URL || 'https://quotecore-plus-testing.vercel.app';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const s = JSON.parse(readFileSync(new URL('../../.sa-r2-state.json', import.meta.url), 'utf8'));
const { createChunks, stringToBase64URL } = require('@supabase/ssr/dist/main/utils/index.js');
const AUTH_COOKIE = 'sb-qcp-auth';
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const r0 = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: s.emailA, password: s.pwd }) });
const session = await r0.json();
if (!r0.ok) throw new Error('signIn ' + r0.status);
const cookie = createChunks(AUTH_COOKIE, 'base64-' + stringToBase64URL(JSON.stringify(session))).map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
const slug = (await (await fetch(`${SUPA_URL}/rest/v1/companies?select=slug&id=eq.${s.coA}`, { headers: srH })).json())[0].slug;
const convId = randomUUID();
await fetch(`${SUPA_URL}/rest/v1/smart_assistant_conversations`, { method: 'POST', headers: { ...srH, Prefer: 'return=representation' }, body: JSON.stringify({ id: convId, company_id: s.coA, user_id: s.uidA }) });
for (const msg of ['what are my quotes', 'set the material rate on the Ridge component of my draft "SA R2 Draft" to 30 per m']) {
  const t0 = Date.now();
  const r = await fetch(`${BASE_URL}/api/smart-assistant/turn`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ conversationId: convId, message: msg, clientRequestId: randomUUID(), pageContext: { companyId: s.coA, pathname: `/${slug}/quotes` } }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await r.json().catch(() => null);
  console.log(`\n"${msg.slice(0, 40)}" -> ${r.status} (${Date.now() - t0}ms)`);
  console.log('reply:', String(body?.reply ?? JSON.stringify(body)).slice(0, 300));
}
const runs = await (await fetch(`${SUPA_URL}/rest/v1/smart_assistant_runs?select=status,error_code,tokens_in,tokens_out&conversation_id=eq.${convId}`, { headers: srH })).json();
console.log('\nruns:', JSON.stringify(runs));
