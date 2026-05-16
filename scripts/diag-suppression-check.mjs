// Diagnose why a manual follow-up to a suppressed address wasn't blocked.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}

const TARGET = 'secarter23@gmail.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

console.log(`\n=== Suppression rows for ${TARGET} ===`);
const { data: supps, error: sErr } = await supabase
  .from('message_suppressions')
  .select('id, company_id, email, reason, source_message_id, created_at')
  .ilike('email', TARGET);
if (sErr) { console.error(sErr); process.exit(1); }
console.log(JSON.stringify(supps, null, 2));

console.log(`\n=== Recent outbound_messages to ${TARGET} (last 10) ===`);
const { data: outs, error: oErr } = await supabase
  .from('outbound_messages')
  .select('id, company_id, recipient_email, status, subject, created_at, sent_at')
  .ilike('recipient_email', TARGET)
  .order('created_at', { ascending: false })
  .limit(10);
if (oErr) { console.error(oErr); process.exit(1); }
console.log(JSON.stringify(outs, null, 2));

console.log(`\n=== Recent scheduled_messages to ${TARGET} (via outbound_messages join) ===`);
const { data: sched, error: schErr } = await supabase
  .from('scheduled_messages')
  .select('id, company_id, quote_id, status, fires_at, created_at')
  .order('created_at', { ascending: false })
  .limit(20);
if (schErr) { console.error(schErr); }
else console.log(JSON.stringify(sched, null, 2));

// For each suppression company_id and each outbound message company_id, fetch the company name.
const companyIds = new Set();
(supps ?? []).forEach(r => r.company_id && companyIds.add(r.company_id));
(outs ?? []).forEach(r => r.company_id && companyIds.add(r.company_id));
(sched ?? []).forEach(r => r.company_id && companyIds.add(r.company_id));

if (companyIds.size) {
  console.log(`\n=== Companies referenced ===`);
  const { data: cos } = await supabase
    .from('companies')
    .select('id, name, slug, owner_user_id')
    .in('id', Array.from(companyIds));
  console.log(JSON.stringify(cos, null, 2));
}
