// Generic Trades Phase 3 backfill.
//
// For every existing company:
//   1. Call ensure_company_has_collection(company_id) — idempotent SECDEF
//      RPC under per-company advisory lock + partial unique index. Returns
//      the bootstrap collection uuid.
//   2. UPDATE every component_library row in that company that has
//      collection_id IS NULL to point at the bootstrap collection.
//
// Idempotent: safe to run any number of times. Subsequent runs no-op
// (the RPC sees an existing bootstrap row + every component_library row
// already has its collection_id set).
//
// Usage (from projects/quotecore-plus):
//   node scripts/backfill-component-collections.mjs
//
// With dry-run (counts only, no writes):
//   node scripts/backfill-component-collections.mjs --dry-run

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

const DRY_RUN = process.argv.includes('--dry-run');

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function log(...args) { console.log(new Date().toISOString(), ...args); }
function fatal(message) { console.error('FATAL:', message); process.exit(1); }

const startedAt = Date.now();
log(`Backfill starting${DRY_RUN ? ' (DRY-RUN)' : ''}.`);

// 1. Enumerate companies.
const { data: companies, error: companiesErr } = await admin
  .from('companies')
  .select('id, name')
  .order('created_at', { ascending: true });

if (companiesErr) fatal(`Failed to load companies: ${companiesErr.message}`);
log(`Found ${companies.length} companies.`);

const stats = {
  companies: companies.length,
  bootstrapCreated: 0,
  bootstrapAlreadyExisted: 0,
  componentsTaggedTotal: 0,
  componentsAlreadyTaggedTotal: 0,
  componentsByCompany: {},
  errors: [],
};

for (const company of companies) {
  // Count existing bootstrap rows BEFORE the RPC so we know whether the
  // RPC will create or find one.
  const { count: bootstrapBefore, error: countErr } = await admin
    .from('component_collections')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('is_bootstrap', true);

  if (countErr) {
    stats.errors.push({ company: company.id, step: 'count_bootstrap', message: countErr.message });
    continue;
  }

  let collectionId;
  if (DRY_RUN) {
    collectionId = `<would-create>`;
  } else {
    const { data: rpcData, error: rpcErr } = await admin.rpc('ensure_company_has_collection', { p_company_id: company.id });
    if (rpcErr) {
      stats.errors.push({ company: company.id, step: 'rpc', message: rpcErr.message });
      continue;
    }
    collectionId = rpcData;
  }

  if (bootstrapBefore === 0) {
    stats.bootstrapCreated++;
  } else {
    stats.bootstrapAlreadyExisted++;
  }

  // 2. Tag every untagged component_library row in this company.
  const { count: untaggedCount, error: untaggedErr } = await admin
    .from('component_library')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .is('collection_id', null);

  if (untaggedErr) {
    stats.errors.push({ company: company.id, step: 'count_untagged', message: untaggedErr.message });
    continue;
  }

  const { count: alreadyTaggedCount } = await admin
    .from('component_library')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .not('collection_id', 'is', null);

  stats.componentsAlreadyTaggedTotal += alreadyTaggedCount ?? 0;

  if (untaggedCount > 0 && !DRY_RUN) {
    const { error: updErr } = await admin
      .from('component_library')
      .update({ collection_id: collectionId })
      .eq('company_id', company.id)
      .is('collection_id', null);

    if (updErr) {
      stats.errors.push({ company: company.id, step: 'update_components', message: updErr.message });
      continue;
    }
  }

  if (untaggedCount > 0) {
    stats.componentsTaggedTotal += untaggedCount;
  }

  stats.componentsByCompany[company.id] = {
    name: company.name,
    bootstrap: collectionId,
    bootstrapAction: bootstrapBefore === 0 ? 'created' : 'existed',
    untagged: untaggedCount,
    alreadyTagged: alreadyTaggedCount ?? 0,
  };
}

const tookMs = Date.now() - startedAt;
log('---');
log(`Companies processed:        ${stats.companies}`);
log(`Bootstrap collections new:  ${stats.bootstrapCreated}`);
log(`Bootstrap already existed:  ${stats.bootstrapAlreadyExisted}`);
log(`Components tagged this run: ${stats.componentsTaggedTotal}`);
log(`Components already tagged:  ${stats.componentsAlreadyTaggedTotal}`);
log(`Errors:                     ${stats.errors.length}`);
if (stats.errors.length) {
  console.error('---');
  console.error('ERRORS:');
  for (const e of stats.errors) console.error('  ', JSON.stringify(e));
}
log(`Took ${tookMs}ms.`);

if (DRY_RUN) {
  log('(DRY-RUN: no writes performed. Remove --dry-run to apply.)');
}

process.exit(stats.errors.length > 0 ? 1 : 0);
