// One-off cleanup: delete throwaway repro users (auth + public.users rows).
// Users: qcp-repro-mujq0eyb (Phase 6 spot-check 2026-09-27) + qcp-repro-muij3acs
// (hover repro from 2026-09-26, deletion was pending owner hover confirmation).
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
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const ids = [
  '640c76e1-86fd-431b-871a-0ffe3bee0007', // mujq0eyb (today)
  '22215091-718f-4aa0-ac90-d296677ee97a', // muij3acs (yesterday)
];

async function main() {
  for (const uid of ids) {
    const a = await fetch(`${SUPA_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: srH });
    console.log(`auth ${uid}: ${a.status}`);
  }
  const d = await fetch(`${SUPA_URL}/rest/v1/users?id=in.(${ids.join(',')})`, { method: 'DELETE', headers: srH });
  console.log(`public.users rows delete: ${d.status}`);
  const v = await fetch(`${SUPA_URL}/rest/v1/users?id=in.(${ids.join(',')})&select=id,email`, { headers: srH });
  const vj = await v.json();
  console.log(`remaining rows (expect []): ${JSON.stringify(vj)}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
