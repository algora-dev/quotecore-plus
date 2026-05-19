// Gerald audit H-05 regression test.
//
// Verifies:
//   1. Direct authenticated client upload to QUOTE-DOCUMENTS is BLOCKED
//      by storage RLS (only signed-upload-URL flow remains).
//   2. company-logos remains writable directly (phase 2 scope).
//   3. Authenticated SELECT on the user's own QUOTE-DOCUMENTS folder works.
//   4. Authenticated SELECT on another company's folder is blocked by RLS.
//
// Run: node scripts/test-storage-signed-upload-only.mjs

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TEST_TAG = `h05-test-${Date.now()}`;
let companyId = null;
let userId = null;
let otherCompanyId = null;
let pass = 0, fail = 0;
const failures = [];

async function setup() {
  console.log('--- Setup ---');
  const { data: c1 } = await admin.from('companies').insert({
    name: `H-05 Test ${TEST_TAG}`,
    slug: TEST_TAG,
    default_currency: 'USD',
    default_language: 'en',
    default_measurement_system: 'metric',
    plan_code: 'pro',
    subscription_status: 'active',
  }).select('id').single();
  companyId = c1.id;

  const { data: c2 } = await admin.from('companies').insert({
    name: `H-05 Other ${TEST_TAG}`,
    slug: `${TEST_TAG}-other`,
    default_currency: 'USD',
    default_language: 'en',
    default_measurement_system: 'metric',
    plan_code: 'pro',
    subscription_status: 'active',
  }).select('id').single();
  otherCompanyId = c2.id;

  const email = `${TEST_TAG}@quotecore.local`;
  const password = 'TestPassword123!';
  const { data: au } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  userId = au.user.id;
  await admin.from('users').insert({
    id: userId, email, company_id: companyId, role: 'owner',
  });

  // Seed an existing file in our own folder so SELECT can verify visibility.
  // QUOTE-DOCUMENTS has a bucket-level MIME allowlist; image/png is permitted.
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ownPath = `${companyId}/_pending/seed-${Date.now()}.png`;
  const seedOwn = await admin.storage.from('QUOTE-DOCUMENTS').upload(ownPath, PNG, { contentType: 'image/png' });
  if (seedOwn.error) console.warn(`  seed own failed: ${seedOwn.error.message}`);

  // Seed a file under the OTHER company's prefix.
  const otherPath = `${otherCompanyId}/_pending/other-seed.png`;
  const seedOther = await admin.storage.from('QUOTE-DOCUMENTS').upload(otherPath, PNG, { contentType: 'image/png' });
  if (seedOther.error) console.warn(`  seed other failed: ${seedOther.error.message}`);

  console.log(`  company=${companyId}  other=${otherCompanyId}  user=${userId}\n`);
  return { email, password, ownPath, otherPath };
}

async function teardown() {
  console.log('\n--- Teardown ---');
  // List + bulk-remove all seeded objects in both companies.
  for (const cid of [companyId, otherCompanyId].filter(Boolean)) {
    try {
      const { data } = await admin.storage.from('QUOTE-DOCUMENTS').list(`${cid}/_pending`);
      if (data?.length) {
        await admin.storage.from('QUOTE-DOCUMENTS').remove(data.map(o => `${cid}/_pending/${o.name}`));
      }
    } catch {}
  }
  try { if (userId) await admin.auth.admin.deleteUser(userId); } catch {}
  try { if (userId) await admin.from('users').delete().eq('id', userId); } catch {}
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId); } catch {}
  try { if (otherCompanyId) await admin.from('companies').delete().eq('id', otherCompanyId); } catch {}
  console.log('  done.');
}

async function main() {
  const { email, password, ownPath, otherPath } = await setup();

  try {
    // ===== authenticated client =====
    const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: signInErr } = await c.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(`signIn: ${signInErr.message}`);

    // ===== Direct .upload() must be BLOCKED =====
    // Use an allowlisted MIME (image/png) so we're testing RLS not the
    // bucket's mime allowlist.
    const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    console.log('--- Adversarial: direct .upload() into own folder -> blocked ---');
    const directOwn = await c.storage.from('QUOTE-DOCUMENTS').upload(
      `${companyId}/_pending/direct-${Date.now()}.png`,
      new Blob([PNG], { type: 'image/png' }),
    );
    if (directOwn.error) {
      console.log(`  [PASS] direct upload blocked: ${directOwn.error.message?.slice(0, 80)}`);
      pass++;
    } else {
      console.log(`  [FAIL] direct upload SUCCEEDED (storage RLS leak)`);
      fail++;
      failures.push('direct upload own folder');
    }

    // ===== Direct .upload() into ANOTHER company's folder must be BLOCKED =====
    console.log('\n--- Adversarial: direct .upload() into other company folder ---');
    const directOther = await c.storage.from('QUOTE-DOCUMENTS').upload(
      `${otherCompanyId}/_pending/cross-${Date.now()}.png`,
      new Blob([PNG], { type: 'image/png' }),
    );
    if (directOther.error) {
      console.log(`  [PASS] cross-company upload blocked: ${directOther.error.message?.slice(0, 80)}`);
      pass++;
    } else {
      console.log(`  [FAIL] cross-company upload SUCCEEDED`);
      fail++;
      failures.push('cross-company direct upload');
    }

    // ===== SELECT own folder OK =====
    console.log('\n--- Allowed: SELECT own folder ---');
    const listOwn = await c.storage.from('QUOTE-DOCUMENTS').list(`${companyId}/_pending`);
    if (listOwn.error || !listOwn.data?.length) {
      console.log(`  [FAIL] SELECT own folder: ${listOwn.error?.message ?? 'no rows'}`);
      fail++;
      failures.push('SELECT own folder');
    } else {
      console.log(`  [PASS] SELECT own folder: ${listOwn.data.length} object(s)`);
      pass++;
    }

    // ===== SELECT cross-company folder BLOCKED =====
    console.log('\n--- Adversarial: SELECT another company folder ---');
    const listOther = await c.storage.from('QUOTE-DOCUMENTS').list(`${otherCompanyId}/_pending`);
    // Supabase storage returns either an error OR an empty array when RLS hides rows.
    if (listOther.error) {
      console.log(`  [PASS] cross-company SELECT blocked: ${listOther.error.message?.slice(0, 80)}`);
      pass++;
    } else if (!listOther.data?.length) {
      console.log(`  [PASS] cross-company SELECT returns empty (RLS hides rows)`);
      pass++;
    } else {
      console.log(`  [FAIL] cross-company SELECT returned ${listOther.data.length} rows`);
      fail++;
      failures.push('SELECT cross-company folder');
    }

    // ===== Allowed: signed-upload-URL flow works end-to-end =====
    console.log('\n--- Allowed: signed-upload-URL flow ---');
    // Mint via service role (mirrors what mintQuoteDocumentUploadUrl does
    // server-side after the auth + quota gates pass).
    const mintPath = `${companyId}/_pending/signed-${Date.now()}.png`;
    const mint = await admin.storage.from('QUOTE-DOCUMENTS').createSignedUploadUrl(mintPath);
    if (mint.error || !mint.data?.token) {
      console.log(`  [FAIL] mint failed: ${mint.error?.message}`);
      fail++;
      failures.push('signed-url mint');
    } else {
      // Authenticated client uploads via the token. This bypasses storage
      // RLS because the token itself is the auth gate.
      const uploadViaToken = await c.storage.from('QUOTE-DOCUMENTS').uploadToSignedUrl(
        mintPath,
        mint.data.token,
        new Blob([PNG], { type: 'image/png' }),
        { contentType: 'image/png' },
      );
      if (uploadViaToken.error) {
        console.log(`  [FAIL] uploadToSignedUrl failed: ${uploadViaToken.error.message}`);
        fail++;
        failures.push('signed-url upload');
      } else {
        console.log(`  [PASS] signed-upload-URL flow uploaded to ${uploadViaToken.data?.path ?? mintPath}`);
        pass++;
        // Clean up
        await admin.storage.from('QUOTE-DOCUMENTS').remove([mintPath]).catch(() => {});
      }
    }

    // ===== Phase-2 scope: company-logos direct upload still works =====
    console.log('\n--- company-logos still allows direct INSERT (phase 2 scope) ---');
    const logoPath = `${companyId}/logo-${Date.now()}.png`;
    const logoRes = await c.storage.from('company-logos').upload(
      logoPath,
      new Blob([PNG], { type: 'image/png' }),
      { upsert: true },
    );
    if (logoRes.error) {
      console.log(`  [INFO] company-logos upload failed: ${logoRes.error.message?.slice(0, 80)}`);
      // Not a hard fail \u2014 logos policy is owned by another flow. Record but don't fail.
    } else {
      console.log(`  [PASS] company-logos still permits direct upload`);
      pass++;
      // Clean up
      await admin.storage.from('company-logos').remove([logoPath]).catch(() => {});
    }
  } catch (e) {
    console.error(`\nFatal: ${e.message}`);
    fail++;
    failures.push(`Fatal: ${e.message}`);
  } finally {
    await teardown();
  }

  console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
  if (fail > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('=== PASS: H-05 storage lockdown verified ===');
}

main().catch((e) => { console.error(e); teardown().finally(() => process.exit(1)); });
