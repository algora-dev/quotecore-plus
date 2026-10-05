// Inspect the last propose-turn outcome on company A.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const s = JSON.parse(readFileSync(new URL('../../.sa-p16-state.json', import.meta.url).pathname.replace(/^\//, ''), 'utf8'));
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const runs = await (await fetch(`${SUPA_URL}/rest/v1/smart_assistant_runs?company_id=eq.${s.coA}&select=id,conversation_id,status,tokens_in,tokens_out&order=started_at.desc&limit=4`, { headers: srH })).json();
for (const r of (runs ?? [])) console.log('RUN', r.status, r.conversation_id.slice(0, 8), 'tok', r.tokens_in + '/' + r.tokens_out);
const lastConv = runs?.[0]?.conversation_id;
if (lastConv) {
  const msgs = await (await fetch(`${SUPA_URL}/rest/v1/smart_assistant_messages?conversation_id=eq.${lastConv}&select=role,content&order=created_at.asc`, { headers: srH })).json();
  for (const m of (msgs ?? [])) console.log('MSG', m.role, '::', String(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).slice(0, 240));
  const acts = await (await fetch(`${SUPA_URL}/rest/v1/assistant_v2_actions?company_id=eq.${s.coA}&select=id,title,status&order=created_at.desc&limit=3`, { headers: srH })).json();
  for (const a of (acts ?? [])) console.log('ACTION', a.status, a.title);
}
