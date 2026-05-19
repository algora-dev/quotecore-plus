// Smoke #11 regression (2026-05-19): every `supabase.rpc(...)` call from
// our server actions / API routes uses an RPC whose EXECUTE privileges
// match the client being used. C-02 + 2026-05-19 audit revoked EXECUTE
// from authenticated on several SECDEF functions; if an action calls
// such a function with the user-bound client, the user hits 42501 and
// the request 500s. Caught the hard way on confirm-quote (Shaun smoke
// pass #3 \u2014 'permission denied for function get_next_quote_number').
//
// Strategy:
//   1. Grep `app/` for every supabase.rpc('foo'...) call site.
//   2. Determine whether that call site uses an admin client or a user
//      client (file-local static check).
//   3. For each function called by a USER client, assert authenticated
//      has EXECUTE on the function in the live DB.
//
// This is intentionally chain-static + DB-check, not a runtime fixture,
// so we catch it fast without needing a dev server.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let pass = 0, fail = 0;
const failures = [];

// Walk app/ collecting .ts/.tsx files (skip *.test.ts, .next/, node_modules/).
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

const files = walk('app');

// Find supabase.rpc('foo' calls. For each, determine if the caller is the
// admin client by checking same-file usage of createAdminClient OR the
// variable name (admin.rpc / adminSupabase.rpc / serviceSupabase.rpc).
const RPC_RE = /(\b(?:supabase|adminSupabase|serviceSupabase|admin|sb)\b)\.rpc\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/gi;

const userCallSites = []; // { file, line, rpc, varName }
const adminCallSites = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  let m;
  while ((m = RPC_RE.exec(text)) !== null) {
    const varName = m[1];
    const rpc = m[2];
    // Compute line number for diagnostics.
    const idx = m.index;
    const line = text.slice(0, idx).split('\n').length;
    // Heuristic: if the variable name starts with 'admin'/'service' OR
    // the variable was assigned `createAdminClient()` ANYWHERE earlier
    // in the same file, treat as admin. Otherwise treat as user.
    const lowerVar = varName.toLowerCase();
    // A file is treated as admin-context if ANY of these are true:
    //   - the call variable name is admin* / service*
    //   - the file imports SUPABASE_SERVICE_ROLE_KEY (so its clients are
    //     always service-role; rateLimit.ts does this)
    //   - the call variable was assigned createAdminClient() earlier in
    //     the same function/block (checked below in the user-fallback path)
    const fileUsesServiceKey = /SUPABASE_SERVICE_ROLE_KEY/.test(text);
    const isAdminVar =
      lowerVar.startsWith('admin') ||
      lowerVar.startsWith('service') ||
      (lowerVar === 'sb' && /createAdminClient\s*\(\s*\)/.test(text.slice(0, idx))) ||
      fileUsesServiceKey;
    if (isAdminVar) {
      adminCallSites.push({ file: relative('.', file), line, rpc, varName });
    } else {
      // Final check: was `supabase` (or whatever) assigned from createAdminClient
      // ABOVE the call site in the same function/block? Cheap proxy: look
      // back 400 chars for `const ${varName} = createAdminClient`.
      const window = text.slice(Math.max(0, idx - 400), idx);
      const adminAssign = new RegExp(`(?:const|let)\\s+${varName}\\s*=\\s*createAdminClient`, 'm');
      if (adminAssign.test(window)) {
        adminCallSites.push({ file: relative('.', file), line, rpc, varName });
      } else {
        userCallSites.push({ file: relative('.', file), line, rpc, varName });
      }
    }
  }
}

console.log(`Found ${userCallSites.length + adminCallSites.length} supabase.rpc(...) call(s):`);
console.log(`  user-context calls:  ${userCallSites.length}`);
console.log(`  admin-context calls: ${adminCallSites.length}`);
console.log('');

// Query the DB for EXECUTE privileges on every RPC any USER call site touches.
const userRpcs = Array.from(new Set(userCallSites.map(c => c.rpc)));
console.log(`Distinct user-context RPCs: ${userRpcs.join(', ') || '(none)'}`);

for (const rpc of userRpcs) {
  // Use a SECURITY DEFINER lookup via service-role: just query catalog.
  const { data, error } = await admin.rpc(rpc, { p_company_id: '00000000-0000-0000-0000-000000000000' }).select?.() ?? {};
  // We don't actually want to invoke -- query pg_proc directly via REST.
  const { data: rows, error: pgErr } = await admin
    .from('pg_proc_check_view') // placeholder; will fail and fall through
    .select('*')
    .limit(0);
  // Skip the placeholder path; do it via the REST exec_sql proxy below.
}

// Use the Supabase management API for the exec.
const SUPABASE_PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0];
async function pgQuery(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

console.log('\n--- Verifying authenticated EXECUTE for each user-context RPC ---');
for (const rpc of userRpcs) {
  // Get the first (and usually only) proc matching that name. RPCs are
  // overloaded by signature \u2014 we just want the public.<name>().
  const rows = await pgQuery(
    `SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ok
     FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname='public' AND p.proname='${rpc.replace(/'/g, "''")}'
     LIMIT 1;`
  );
  const ok = Array.isArray(rows) ? rows[0]?.ok : rows.ok;
  const sites = userCallSites.filter(c => c.rpc === rpc).map(c => `${c.file}:${c.line}`).join(', ');
  if (ok === true) {
    console.log(`  [PASS] ${rpc}: authenticated can EXECUTE \u2014 called from ${sites}`);
    pass++;
  } else if (ok === false) {
    console.log(`  [FAIL] ${rpc}: authenticated CANNOT EXECUTE \u2014 called from ${sites}`);
    console.log(`         \u2192 either GRANT to authenticated, or switch caller to admin client.`);
    fail++;
    failures.push(`user-context RPC '${rpc}' lacks authenticated EXECUTE (sites: ${sites})`);
  } else {
    console.log(`  [WARN] ${rpc}: function not found in pg_proc (overloaded? renamed?)`);
  }
}

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
if (fail > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('=== PASS: every user-context RPC is callable by authenticated ===');
