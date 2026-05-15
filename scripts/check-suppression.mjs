// One-off diagnostic: inspect message_suppressions rows for a given email
// + look for any clues about how/when it was re-added.
// Run: node scripts/check-suppression.mjs [email]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Minimal .env.local loader so we don't need dotenv as a dep.
try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
} catch (err) {
  console.warn('Could not read .env.local:', err.message);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const email = process.argv[2] ?? 'secarter23@gmail.com';

async function main() {
  console.log(`\n=== message_suppressions for ${email} ===\n`);

  const { data: rows, error } = await supabase
    .from('message_suppressions')
    .select('id, company_id, email, reason, source_message_id, created_at')
    .eq('email', email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Query failed:', error);
    process.exit(2);
  }

  console.log(`Rows: ${rows.length}`);
  for (const row of rows) console.log(JSON.stringify(row, null, 2));

  // Pull the source message if there is one.
  for (const row of rows) {
    if (!row.source_message_id) continue;
    const { data: msg } = await supabase
      .from('outbound_messages')
      .select('id, created_at, subject, kind, related_quote_id, recipient_email, status')
      .eq('id', row.source_message_id)
      .maybeSingle();
    console.log(`\n  source_message_id ${row.source_message_id} -> ${msg ? JSON.stringify(msg) : '<not found>'}`);
  }

  // ---- Outbound history to this address ------------------------------------
  console.log(`\n=== Recent outbound_messages to ${email} (last 30) ===\n`);
  const { data: recent } = await supabase
    .from('outbound_messages')
    .select('id, created_at, status, kind, subject, sent_at, related_quote_id')
    .eq('recipient_email', email)
    .order('created_at', { ascending: false })
    .limit(30);
  for (const m of recent ?? []) {
    console.log(
      `  ${m.created_at}  status=${m.status.padEnd(11)} kind=${(m.kind ?? '').padEnd(17)} ${m.subject}`,
    );
  }

  // ---- Audit / alert rows that might hint at the timeline ------------------
  console.log(`\n=== alerts mentioning this email (last 20) ===\n`);
  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, alert_type, title, message, created_at')
    .or(`title.ilike.%${email}%,message.ilike.%${email}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  for (const a of alerts ?? []) {
    console.log(`  ${a.created_at}  ${a.alert_type.padEnd(20)} ${a.title}`);
  }

  // ---- Any other suppression rows for this company? ------------------------
  if (rows.length > 0) {
    const companyId = rows[0].company_id;
    console.log(`\n=== ALL message_suppressions rows for company ${companyId} ===\n`);
    const { data: all } = await supabase
      .from('message_suppressions')
      .select('id, email, reason, source_message_id, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    for (const r of all ?? []) {
      console.log(`  ${r.created_at}  ${r.email.padEnd(35)} reason=${r.reason ?? '<null>'}  src=${r.source_message_id ?? '<null>'}`);
    }
  }

  // ---- Anything in account_recovery_log that references the email? --------
  console.log(`\n=== account_recovery_log mentioning this email ===\n`);
  try {
    const { data: log, error: logErr } = await supabase
      .from('account_recovery_log')
      .select('*')
      .or(`details.ilike.%${email}%`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (logErr) {
      console.log(`  (skip: ${logErr.message})`);
    } else {
      for (const l of log ?? []) console.log(JSON.stringify(l));
      if ((log?.length ?? 0) === 0) console.log('  (none)');
    }
  } catch (err) {
    console.log(`  (skip: ${err.message})`);
  }
}

main().catch((err) => {
  console.error('Script crashed:', err);
  process.exit(3);
});
