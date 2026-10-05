// One-off live check: name-vs-number ("my 5 quote") on the fixed deployment.
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
const convId = randomUUID();
await fetch(`${SUPA_URL}/rest/v1/smart_assistant_conversations`, { method: 'POST', headers: { ...srH, Prefer: 'return=representation' }, body: JSON.stringify({ id: convId, company_id: s.coA, user_id: s.uidA }) });
const t0 = Date.now();
const r = await fetch(`${BASE_URL}/api/smart-assistant/turn`, {
  method: 'POST', headers: { Cookie: s.cookieA, 'Content-Type': 'application/json', Origin: BASE_URL },
  body: JSON.stringify({ conversationId: convId, message: 'What order is my 5 quote for?', clientRequestId: randomUUID(), pageContext: { companyId: s.coA, pathname: `/${s.run}/quotes` } }),
});
const body = await r.json().catch(() => null);
console.log(`status=${r.status} ms=${Date.now() - t0}`);
console.log('reply:', String(body?.reply).slice(0, 400));
