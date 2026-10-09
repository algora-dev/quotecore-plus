// V2.21 hosted-verification helper: locate the nine-face quote + companion regression quotes,
// and provision a throwaway owner in the same company for browser login. Read-only queries + user insert.
import { readFileSync } from 'node:fs';
try {
  const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const m of envFile.matchAll(/^([A-Z_][A-Z_0-9_]*)=(.*)$/gm)) {
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const NINE_FACE_ID = '21d81080-89e0-45af-957d-d390bfafe81c';
const run = Date.now().toString(36);
const email = `qcp-v222-${run}@example.com`;
const PWD = 'Repro!2026x';

async function main() {
  // 1. The nine-face quote
  const q = await fetch(`${SUPA_URL}/rest/v1/quotes?id=eq.${NINE_FACE_ID}&select=id,quote_number,job_name,status,company_id,workspace:companies!quotes_company_id_fkey(id,slug,name)`, { headers: srH });
  if (!q.ok) throw new Error(`quote lookup ${q.status}: ${(await q.text()).slice(0, 300)}`);
  const quote = (await q.json())[0];
  if (!quote) throw new Error('Nine-face quote not found');
  console.log('NINE_FACE_QUOTE ' + JSON.stringify(quote));

  // 2. Saved offcut solution rows for this quote (journal + review + checkpoint)
  const j = await fetch(`${SUPA_URL}/rest/v1/takeoff_offcut_journals?quote_id=eq.${NINE_FACE_ID}&select=id,revision,engine_version,created_at&order=revision.desc&limit=3`, { headers: srH });
  if (j.ok) console.log('JOURNALS ' + JSON.stringify(await j.json())); else console.log('JOURNALS_ERR ' + j.status);
  const rv = await fetch(`${SUPA_URL}/rest/v1/takeoff_offcut_reviews?quote_id=eq.${NINE_FACE_ID}&select=id,revision,updated_at&order=revision.desc&limit=3`, { headers: srH });
  if (rv.ok) console.log('REVIEWS ' + JSON.stringify(await rv.json())); else console.log('REVIEWS_ERR ' + rv.status);
  const ck = await fetch(`${SUPA_URL}/rest/v1/takeoff_checkpoints?quote_id=eq.${NINE_FACE_ID}&select=id,revision,kind,updated_at&order=revision.desc&limit=3`, { headers: srH });
  if (ck.ok) console.log('CHECKPOINTS ' + JSON.stringify(await ck.json())); else console.log('CHECKPOINTS_ERR ' + ck.status);

  // 3. Other quotes in the same company (for the roofs regression list)
  const list = await fetch(`${SUPA_URL}/rest/v1/quotes?company_id=eq.${quote.company_id}&select=id,quote_number,job_name,status,created_at&order=created_at.desc&limit=25`, { headers: srH });
  if (list.ok) {
    for (const row of await list.json()) console.log(`QUOTE ${row.quote_number ?? '-'} | ${row.job_name ?? '-'} | ${row.status} | ${row.id} | ${row.created_at}`);
  } else console.log('LIST_ERR ' + list.status);

  // 4. Provision throwaway owner in the nine-face quote's company
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password: PWD, email_confirm: true }) });
  const ju = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`createAuthUser ${r.status}: ${JSON.stringify(ju).slice(0, 300)}`);
  const uid = ju.id;
  const u = await fetch(`${SUPA_URL}/rest/v1/users`, {
    method: 'POST',
    headers: { ...srH, Prefer: 'return=representation' },
    body: JSON.stringify([{ id: uid, company_id: quote.company_id, email, full_name: 'V222 Verify', role: 'owner' }]),
  });
  if (!u.ok) throw new Error(`users insert ${u.status}: ${(await u.text()).slice(0, 300)}`);
  console.log('LOGIN ' + JSON.stringify({ email, password: PWD, userId: uid }));
}
main().catch(e => { console.error(e.message); process.exit(1); });

