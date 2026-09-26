// Throwaway login user for RS Roofing (test company) to reproduce the blank
// first row in the customer quote editor locally. Delete the user after use.
import { readFileSync } from 'node:fs';
try {
  const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const m of envFile.matchAll(/^([A-Z_][A-Z0-9_]*)=(.*)$/gm)) {
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY_ID = 'dd3b3943-c760-4c21-9a9a-3a516d0c3356';
const run = Date.now().toString(36);
const email = `qcp-repro-${run}@example.com`;
const PWD = 'Repro!2026x';
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

async function main() {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password: PWD, email_confirm: true }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`createAuthUser ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const uid = j.id;
  const u = await fetch(`${SUPA_URL}/rest/v1/users?select=*`, {
    method: 'POST',
    headers: { ...srH, Prefer: 'return=representation' },
    body: JSON.stringify([{ id: uid, company_id: COMPANY_ID, email, full_name: 'Blank Row Repro', role: 'owner' }]),
  });
  if (!u.ok) throw new Error(`users insert ${u.status}: ${(await u.text()).slice(0, 300)}`);
  console.log(JSON.stringify({ email, password: PWD, userId: uid }, null, 2));
}
main().catch(e => { console.error(e.message); process.exit(1); });
