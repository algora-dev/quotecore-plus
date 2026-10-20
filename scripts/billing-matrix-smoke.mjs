#!/usr/bin/env node
/**
 * Billing-matrix smoke runner (owner directive 2026-10-19 "never-again job").
 *
 * Drives app/api/smoke/billing-matrix against a deployment (testing by
 * default). Run on EVERY testing deploy after it goes Ready:
 *
 *   node scripts/billing-matrix-smoke.mjs --url https://<testing-host>
 *   npm run smoke:billing                     (uses QCP_TESTING_URL + BILLING_SMOKE_KEY)
 *
 * Key resolution order: --key arg, BILLING_SMOKE_KEY env, .env.local.
 * Exit code 0 only when the whole matrix is green.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

function keyFromEnvLocal() {
  try {
    const m = readFileSync(join(import.meta.dirname, '..', '.env.local'), 'utf8')
      .match(/^BILLING_SMOKE_KEY=(.+)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  } catch { return null; }
}

const url = argValue('--url') ?? process.env.QCP_TESTING_URL;
const key = argValue('--key') ?? process.env.BILLING_SMOKE_KEY ?? keyFromEnvLocal();

if (!url || !key) {
  console.error('Usage: node scripts/billing-matrix-smoke.mjs --url https://<host> [--key <secret>]');
  console.error('       (or set QCP_TESTING_URL + BILLING_SMOKE_KEY)');
  process.exit(2);
}

const res = await fetch(`${url.replace(/\/$/, '')}/api/smoke/billing-matrix`, {
  method: 'POST',
  headers: { 'x-qcp-smoke-key': key },
});

let body;
try { body = await res.json(); } catch { body = null; }

if (res.status === 404) {
  console.error(`[billing-matrix] 404: endpoint unreachable or BILLING_SMOKE_KEY not set on this deployment (${url})`);
  process.exit(1);
}
if (!body) {
  console.error(`[billing-matrix] HTTP ${res.status}: no JSON body`);
  process.exit(1);
}

for (const err of body.setupErrors ?? []) console.error(`  SETUP  ${err}`);
for (const note of body.cleanup?.notes ?? []) console.error(`  CLEAN  ${note}`);
for (const row of body.matrix ?? []) {
  const icon = row.checks.every(c => c.ok) ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${row.fixture}`);
  for (const c of row.checks) {
    console.log(`   ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.error ? ` - ${c.error}` : ''}`);
  }
}
console.log(`[billing-matrix] ${body.ok ? 'ALL GREEN' : 'FAILURES PRESENT'} (ranAt ${body.ranAt}, env acct: ${body.env?.hasEnvAcct ? 'set' : 'MISSING'})`);
process.exit(body.ok ? 0 : 1);
