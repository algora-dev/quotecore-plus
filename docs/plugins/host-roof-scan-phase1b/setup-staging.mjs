#!/usr/bin/env node
// Reads the operator's existing environment. No shell sourcing, secrets printed, migrations or production changes.
import fs from 'node:fs/promises';
import { config, ensurePrivateBucket, probeRateLimit, probeStorage } from './ops.mjs';
const options=new Set(process.argv.slice(2));
for (const a of options) if (!['--create-bucket','--probe','--check'].includes(a)) throw new Error('Unknown option '+a);
const c=config();
console.log('PASS staging config and isolated bucket name. Secret values are not printed.');
await ensurePrivateBucket(c,{create:options.has('--create-bucket')});
console.log('PASS dedicated storage bucket is private. No SQL or RLS policies were changed.');
if (options.has('--probe')) {
  await probeRateLimit(c);console.log('PASS existing distributed rate-limit RPC allows once, then rejects.');
  await probeStorage(c,await fs.readFile(new URL('./fixtures/synthetic-roof.png',import.meta.url)));
  console.log('PASS synthetic image upload/read/delete probe.');
} else console.log('Probe skipped. Run --probe before enabling real uploads.');
console.log('Configure the scoped retention job, then enable both feature flags on staging and redeploy.');
console.log('MCP connection endpoint:',c.origin+'/mcp');
console.log('Browser fallback:',c.origin+'/mcp/host-scan/review');
console.log('Alternate isolated endpoint:',c.origin+'/mcp/host-scan');
