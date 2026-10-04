/** Captures the REAL seed orchestration with fake I/O; never contacts Supabase. */
require('./ts-hook.cjs');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const calls = []; const uploads = [];
const db = { from: table => ({
  insert: async data => { calls.push({ table, operation: 'insert', rows: Array.isArray(data) ? data : [data] }); return { error: null }; },
  upsert: async data => { calls.push({ table, operation: 'upsert', rows: Array.isArray(data) ? data : [data] }); return { error: null }; },
}), storage: { from: bucket => ({ upload: async (name, bytes, options) => { uploads.push({ bucket, name, length: bytes.length, options }); return { error: null }; } }) } };
const load = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'server-only') return {};
  if (name === 'sharp') return () => ({ png: () => ({ toBuffer: async () => Buffer.from('mock-png-io-only') }) });
  if (name === '@/app/lib/supabase/admin') return { createAdminClient: () => db };
  return load.call(this, name, parent, isMain);
};
(async () => {
  const company = '11111111-1111-4111-8111-111111111111';
  const user = '22222222-2222-4222-8222-222222222222';
  const { seedDemoCompany } = require('../../app/lib/demo/seed.ts');
  const manifest = await seedDemoCompany(company, user);
  const rows = table => calls.filter(c => c.table === table).flatMap(c => c.rows);
  assert.equal(rows('component_collections').length, 3);
  assert.equal(rows('component_library').length, 20);
  assert.equal(rows('quotes').length, 8);
  assert.equal(rows('material_orders').length, 2);
  assert.equal(rows('invoices').length, 1);
  assert.equal(rows('quote_taxes').length, 8);
  assert.equal(rows('outbound_messages').length, 2);
  assert.ok(rows('outbound_messages').every(x => x.status === 'sent' && x.body.includes('No email was actually sent')));
  assert.equal(rows('email_templates')[0].kind, 'quote_send');
  assert.equal(rows('takeoff_pages').length, 1);
  assert.equal(uploads.length, 1);
  assert.ok(uploads.every(x => x.name.startsWith(company + '/')));
  const accepted = manifest.accepted_without_order;
  assert.equal(rows('quotes').find(x => x.id === accepted).status, 'accepted');
  assert.ok(rows('material_orders').every(x => x.quote_id !== accepted));
  assert.ok(rows('quote_components').every(x => Number.isFinite(x.material_cost) && Number.isFinite(x.labour_cost)));
  assert.ok(rows('quote_components').every(x => x.material_cost === x.final_quantity * 32));
  for (const c of calls) for (const r of c.rows) if ('company_id' in r) assert.equal(r.company_id, company);
  for (const quote of rows('quotes')) assert.ok(quote.customer_email.endsWith('@example.invalid'));
  if (process.env.DEMO_SEED_CAPTURE) fs.writeFileSync(process.env.DEMO_SEED_CAPTURE, JSON.stringify({ calls, uploads, manifest }, null, 2));
  console.log(JSON.stringify({ passed: true, scope: 'Seed orchestration/real pricing, mocked DB/storage/sharp; NOT a live database test', writes: calls.length, rows: calls.reduce((n,c) => n+c.rows.length,0), libraries:3, components:20, jobs:8 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
