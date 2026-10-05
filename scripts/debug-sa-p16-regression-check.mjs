// Verify: (1) p3 proposal payload from regression run, (2) canonical fast-count phrasing.
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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const s = JSON.parse(readFileSync(new URL('../../.sa-p16-state.json', import.meta.url).pathname.replace(/^\//, ''), 'utf8'));
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
// 1. check the p3 proposal payload from regression run
const acts = await (await fetch(`${SUPA_URL}/rest/v1/assistant_v2_actions?company_id=eq.${s.coA}&select=id,title,status,payload&order=created_at.desc&limit=3`, { headers: srH })).json();
for (const a of (acts ?? [])) console.log('ACTION', a.status, '|', a.title, '|', JSON.stringify(a.payload).slice(0, 300));
// 2. canonical fast-count phrasing on a fresh conversation
const convId = randomUUID();
await fetch(`${SUPA_URL}/rest/v1/smart_assistant_conversations`, { method: 'POST', headers: { ...srH, Prefer: 'return=representation' }, body: JSON.stringify({ id: convId, company_id: s.coA, user_id: s.uidA }) });
const r = await fetch(`${BASE_URL}/api/smart-assistant/turn`, {
  method: 'POST', headers: { Cookie: s.cookieA, 'Content-Type': 'application/json', Origin: BASE_URL },
  body: JSON.stringify({ conversationId: convId, message: 'How many quotes did I create this month?', clientRequestId: randomUUID(), pageContext: { companyId: s.coA, pathname: `/${s.run}/quotes` } }),
});
const body = await r.json();
const runs = await (await fetch(`${SUPA_URL}/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=tokens_in,tokens_out,status&order=started_at.asc&limit=1`, { headers: srH })).json();
console.log('CANONICAL-COUNT reply:', String(body?.reply).slice(0, 150));
console.log('CANONICAL-COUNT tokens:', runs?.[0]?.tokens_in, '/', runs?.[0]?.tokens_out, 'status', runs?.[0]?.status);
