// One-shot probe: ORPHANED-PROFILE ADOPT path on testing (deploy njfuv908z).
// Fabricates the exact stuck state (users row with a dead auth id holding the
// email + company), signs in a FRESH auth identity for that email via admin
// generateLink, cold-curls /auth/verify, and checks the resolver rebound the
// human to their old company. Cleans everything up afterwards.
const REF = 'bcqrrrvbzlfmfgvotzqw';
const SB = `https://${REF}.supabase.co`;
const MGT = process.env.SUPABASE_ACCESS_TOKEN;
let SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Local env can hold the OLD project's key - fetch the live one for this ref.
{
  const kr = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: 'Bearer ' + MGT } });
  const kj = await kr.json();
  const live = (kj.api_keys ?? kj).find?.(k => k.name === 'service_role');
  if (live?.api_key) {
    const envRef = (() => { try { return JSON.parse(Buffer.from((SR || '').split('.')[1] ?? '', 'base64').toString()).ref; } catch { return null; } })();
    const liveRef = (() => { try { return JSON.parse(Buffer.from(live.api_key.split('.')[1], 'base64').toString()).ref; } catch { return null; } })();
    if (envRef !== REF) console.log('NOTE: env SUPABASE_SERVICE_ROLE_KEY ref=' + envRef + ' (stale) - using live key for ' + liveRef);
    SR = live.api_key;
  } else {
    console.log('API-KEYS FETCH FAILED', JSON.stringify(kj).slice(0, 200));
  }
}
const PROBE_EMAIL = 'gavin.probe.adopt@gmail.com';
const COMPANY_SLUG = 'gavin-adopt-probe';
const V = crypto.randomUUID();

async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + MGT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  return r.json();
}

// Pre-clean any earlier probe run (idempotent).
await sql(`delete from users where company_id in (select id from companies where slug='${COMPANY_SLUG}'); delete from companies where slug='${COMPANY_SLUG}';`);

const setup = await sql(`insert into companies (name, slug, default_currency, default_measurement_system, default_tax_rate, plan_code, billing_model, subscription_status) values ('Gavin Adopt Probe','${COMPANY_SLUG}','USD','metric',0,'starter','custom_setup','active') returning id;`);
if (!Array.isArray(setup) || !setup[0]?.id) { console.log('SETUP FAIL', JSON.stringify(setup).slice(0, 300)); process.exit(1); }
const companyId = setup[0].id;
await sql(`insert into users (id, company_id, email, full_name, role) values ('${V}','${companyId}','${PROBE_EMAIL}','Old Orphan','owner');`);
console.log('SETUP ok: orphan profile', V, 'company', companyId);

const gl = await fetch(`${SB}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'signup', email: PROBE_EMAIL, password: 'Probe!12345678' }),
});
const glj = await gl.json();
if (!glj.hashed_token) { console.log('GENLINK FAIL', JSON.stringify(glj).slice(0, 400)); process.exit(1); }
const newAuthId = glj.properties?.user_id || glj.user?.id || null;
console.log('GENLINK ok: fresh auth user', newAuthId);

const vr = await fetch(`https://quotecore-plus-testing.vercel.app/auth/verify?token_hash=${encodeURIComponent(glj.hashed_token)}&type=signup`, { redirect: 'manual' });
console.log('VERIFY status=' + vr.status + ' location=' + vr.headers.get('location'));
const cookies = vr.headers.getSetCookie?.() ?? [];
console.log('cookies=' + cookies.map(c => c.split('=')[0]).join(','));

const rows = await sql(`select id,email from users where company_id='${companyId}' order by email;`);
for (const row of rows) console.log('ROW ' + row.id + ' ' + row.email);
const adopted = (rows || []).find(r => r.email === PROBE_EMAIL && r.id !== V);
const tombstoned = (rows || []).find(r => r.email.startsWith('orphan+'));
console.log('ADOPT=' + (adopted ? 'PASS' : 'FAIL') + ' TOMBSTONE=' + (tombstoned ? 'PASS' : 'FAIL'));

await sql(`delete from users where company_id='${companyId}';`);
await sql(`delete from companies where id='${companyId}';`);
if (adopted?.id) {
  const del = await fetch(`${SB}/auth/v1/admin/users/${adopted.id}`, { method: 'DELETE', headers: { apikey: SR, Authorization: 'Bearer ' + SR } });
  console.log('CLEANUP auth delete=' + del.status);
} else {
  console.log('CLEANUP: no adopted row to delete (manual check needed)');
}
