// Probe invoice status filter variants against a live admitted run.
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
const s = JSON.parse(readFileSync(new URL('../../.sa-p16-state.json', import.meta.url).pathname.replace(/^\//, ''), 'utf8'));
const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const convId = randomUUID();
await fetch(`${SUPA_URL}/rest/v1/smart_assistant_conversations`, { method: 'POST', headers: { ...srH, Prefer: 'return=representation' }, body: JSON.stringify({ id: convId, company_id: s.coA, user_id: s.uidA }) });
const turnPromise = fetch(`${BASE_URL}/api/smart-assistant/turn`, {
  method: 'POST', headers: { Cookie: s.cookieA, 'Content-Type': 'application/json', Origin: BASE_URL },
  body: JSON.stringify({ conversationId: convId, message: 'Summarise my invoices with totals', clientRequestId: randomUUID(), pageContext: { companyId: s.coA, pathname: `/${s.run}/quotes` } }),
});
const probe = async (plan) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/sa_v2_retrieval_query`, {
    method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${s.tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_run_id: runId, p_revision: s.revision ?? 1, p_plan: plan }),
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  if (Array.isArray(j)) j = j[0] ?? null;
  return { status: r.status, rows: Array.isArray(j?.rows) ? j.rows.length : null, msg: j?.message ?? null, sample: Array.isArray(j?.rows) && j.rows[0] ? { invoice_number: j.rows[0].invoice_number, status: j.rows[0].status } : null };
};
let runId = null;
for (let i = 0; i < 80 && !runId; i++) {
  await new Promise((r2) => setTimeout(r2, 250));
  const rows = await (await fetch(`${SUPA_URL}/rest/v1/smart_assistant_runs?conversation_id=eq.${convId}&select=id,status&order=started_at.desc&limit=1`, { headers: srH })).json();
  if (rows && rows.length && rows[0].status !== 'completed' && rows[0].status !== 'failed') runId = rows[0].id;
}
// wait for scope bind
for (let i = 0; i < 40; i++) {
  const p = await probe({ version: 1, source: 'invoices', mode: 'rows', limit: 3 });
  if (p.status === 200) break;
  await new Promise((r2) => setTimeout(r2, 400));
}
const variants = [
  ['status-neq-paid', { version: 1, source: 'invoices', mode: 'rows', filters: [{ field: 'status', op: 'neq', value: 'paid' }], limit: 5 }],
  ['status-eq-sent', { version: 1, source: 'invoices', mode: 'rows', filters: [{ field: 'status', op: 'eq', value: 'sent' }], limit: 5 }],
  ['status-in-sent-draft', { version: 1, source: 'invoices', mode: 'rows', filters: [{ field: 'status', op: 'in', value: ['sent', 'draft'] }], limit: 5 }],
  ['paid-at-null', { version: 1, source: 'invoices', mode: 'rows', filters: [{ field: 'paid_at', op: 'is_null', value: true }], limit: 5 }],
  ['no-filter', { version: 1, source: 'invoices', mode: 'rows', limit: 5 }],
];
for (const [name, plan] of variants) {
  const p = await probe(plan);
  console.log(`${name}: status=${p.status} rows=${p.rows} ${p.msg ? 'msg=' + p.msg : ''} ${p.sample ? JSON.stringify(p.sample) : ''}`);
}
await turnPromise.catch(() => {});
process.exit(0);
