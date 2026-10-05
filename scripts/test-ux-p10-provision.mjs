/**
 * Phase 10 UX runtime-acceptance fixture (2026-09-28).
 * Disposable company + owner + minimal data for browser-driven acceptance.
 *   node scripts/test-ux-p10-provision.mjs setup|cleanup
 * State: ../../.ux-p10-state.json (workspace, never committed)
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATE_PATH = new URL('../../.ux-p10-state.json', import.meta.url).pathname.replace(/^\//, '');
if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(2); }
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`service-role ${method} ${path} -> ${r.status}: ${String(text).slice(0, 300)}`);
  return json;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);
const srDelete = (table, query) => sr('DELETE', `/rest/v1/${table}?${query}`);
async function createAuthUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`createAuthUser -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.user?.id ?? j.id;
}
async function deleteAuthUser(id) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: srH });
  if (!r.ok) console.error(`deleteAuthUser ${id} -> ${r.status}`);
}
const readState = () => { try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); } catch { return {}; } };
const writeState = (s) => writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
const cmd = process.argv[2] ?? '';

if (cmd === 'cleanup') {
  const s = readState();
  if (!s.run) { console.error('No state'); process.exit(2); }
  const errs = [];
  const tables = ['quote_component_entries', 'quote_components', 'quotes', 'catalog_rows', 'catalogs', 'users'];
  for (const t of tables) { try { await srDelete(t, `company_id=eq.${s.coA}`); } catch (e) { errs.push(`${t}: ${e.message.slice(0, 100)}`); } }
  try { await srDelete('companies', `id=eq.${s.coA}`); } catch (e) { errs.push(`companies: ${e.message.slice(0, 100)}`); }
  if (s.uidA) { try { await deleteAuthUser(s.uidA); } catch (e) { errs.push(`auth: ${e.message.slice(0, 100)}`); } }
  console.log(errs.length ? `cleanup notes:\n${errs.join('\n')}` : 'cleanup complete');
  process.exit(0);
}

// setup
const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nowIso = new Date().toISOString();
const PWD = `Hx9-${run}-p10!`;
const emailA = `qcp-p10-${run}@example.com`;
const [coA] = await srInsert('companies', { name: `QCP P10 ${run}`, slug: `qcp-p10-${run}`, onboarding_completed_at: nowIso, plan_code: 'pro', subscription_status: 'active' });
const uidA = await createAuthUser(emailA, PWD);
await srInsert('users', [{ id: uidA, company_id: coA.id, email: emailA, full_name: 'P10 Fixture', role: 'owner' }]);
const [draft] = await srInsert('quotes', { company_id: coA.id, quote_number: 551001, customer_name: 'P10 Customer', job_name: 'P10 Fixture Draft', status: 'draft', measurement_system: 'metric' });
const [sent] = await srInsert('quotes', { company_id: coA.id, quote_number: 551002, customer_name: 'P10 Customer', job_name: 'P10 Fixture Sent', status: 'sent', measurement_system: 'metric', viewed_at: nowIso });
const [cat] = await srInsert('catalogs', { company_id: coA.id, name: 'P10 Catalog', original_filename: 'p10.csv', status: 'ready', row_count: 3 });
await srInsert('catalog_rows', [
  { catalog_id: cat.id, company_id: coA.id, row_index: 0, raw_row: { code: 'RDG-01', description: 'Ridge cap', unit: 'm', price: 12.5 }, search_text: 'rdg-01 ridge cap m 12.5' },
  { catalog_id: cat.id, company_id: coA.id, row_index: 1, raw_row: { code: 'GUT-02', description: 'Gutter', unit: 'm', price: 18.0 }, search_text: 'gut-02 gutter m 18.0' },
  { catalog_id: cat.id, company_id: coA.id, row_index: 2, raw_row: { code: 'FLS-03', description: 'Flashing', unit: 'm', price: 9.25 }, search_text: 'fls-03 flashing m 9.25' },
]);
writeState({ run, coA: coA.id, uidA, emailA, pwd: PWD, slug: coA.slug, draft: draft.id, sent: sent.id, catalog: cat.id });
console.log(`company=${coA.id} slug=${coA.slug} user=${emailA} draft=${draft.id} sent=${sent.id} catalog=${cat.id}`);
