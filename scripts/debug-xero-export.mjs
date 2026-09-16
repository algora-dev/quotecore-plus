// Debug: replicate the export-quote route's server-side flow step by step.
// Usage: node scripts/debug-xero-export.mjs <quoteId>
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TOKEN_URL = 'https://identity.xero.com/connect/token';
const basic = `Basic ${Buffer.from(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`).toString('base64')}`;

const { data: conns } = await supabase.from('xero_connections').select('*').limit(2);
console.log('connections:', conns?.map((c) => ({ company: c.company_id, tenant: c.tenant_name, expires: c.access_expires_at })));
if (!conns?.length) { console.log('NO CONNECTION ROWS'); process.exit(0); }
const conn = conns[0];

// Step 1: refresh token
const tr = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
});
console.log('refresh status:', tr.status, 'content-type:', tr.headers.get('content-type'));
const tbody = await tr.text();
console.log('refresh body:', tbody.slice(0, 300));
if (!tr.ok) process.exit(0);
const tokens = JSON.parse(tbody);

// persist rotated refresh token
await supabase.from('xero_connections').update({
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  access_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  updated_at: new Date().toISOString(),
}).eq('id', conn.id);

const H = { Authorization: `Bearer ${tokens.access_token}`, 'xero-tenant-id': conn.tenant_id };

// Step 2: get a quote with customer lines for this company
const { data: quotes } = await supabase.from('quotes').select('id, quote_number, customer_name, status').eq('company_id', conn.company_id).order('created_at', { ascending: false }).limit(3);
console.log('recent quotes:', quotes);

const quoteId = process.argv[2] || quotes?.[0]?.id;
if (!quoteId) { console.log('no quote to test'); process.exit(0); }

const { data: lines } = await supabase.from('customer_quote_lines').select('id, description, quantity, unit_amount, line_amount, include_in_total, is_visible, line_type').eq('quote_id', quoteId);
console.log('customer lines:', lines?.length, JSON.stringify(lines?.slice(0, 3)));

// Step 3: contact upsert
const cr = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ Name: 'QC Debug Test Contact' }),
});
const cbody = await cr.text();
console.log('contact status:', cr.status, cbody.slice(0, 300));

// Step 4: draft invoice
const inv = {
  Invoices: [{
    Type: 'ACCREC',
    Status: 'DRAFT',
    Contact: { Name: 'QC Debug Test Contact' },
    Reference: `QuoteCore+ debug ${new Date().toISOString()}`,
    Date: new Date().toISOString().slice(0, 10),
    LineAmountTypes: 'Exclusive',
    LineItems: [{ Description: 'debug line', Quantity: 1, UnitAmount: 10 }],
  }],
};
const ir = await fetch('https://api.xero.com/api.xro/2.0/Invoices?summarizeErrors=false', {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(inv),
});
const ibody = await ir.text();
console.log('invoice status:', ir.status, ibody.slice(0, 400));
