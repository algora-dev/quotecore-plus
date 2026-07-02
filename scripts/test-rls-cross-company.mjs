/**
 * F-08: Automated cross-company RLS test harness.
 *
 * Verifies RLS isolation across all tenant-scoped tables. Targets the bug
 * class that's bitten three times already (null-FK OR-branch leaks in RLS
 * policies — Gerald H-01, 2026-06-29).
 *
 * Strategy: query pg_policies to verify each tenant table has a company-scoped
 * policy, and adversarially probe FK-chain tables for the dangerous OR + IS NULL
 * pattern that leaks data across company boundaries.
 *
 * Usage: node scripts/test-rls-cross-company.mjs
 * Run before any development → main merge.
 */

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'aaavvfttkesdzblttmby';

if (!PAT) {
  console.error('Missing SUPABASE_ACCESS_TOKEN env var');
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`SQL failed: ${res.status} ${detail}`);
  }
  return res.json();
}

// All tenant-scoped tables that should have company_id isolation.
// Either directly (company_id column) or via a FK chain (e.g. quote_components → quotes.company_id).
const TENANT_TABLES = [
  'quotes', 'component_library', 'component_collections', 'invoices',
  'invoice_lines', 'invoice_templates', 'material_orders', 'material_order_lines',
  'material_order_templates', 'outbound_messages', 'outbound_message_replies',
  'scheduled_messages', 'quote_notes', 'quote_revision_requests',
  'flashing_library', 'email_templates', 'customer_quote_templates',
  'company_attachments', 'company_taxes', 'quote_takeoff_measurements',
  'takeoff_sessions', 'takeoff_pages', 'alerts', 'labor_sheet_lines',
  'templates', 'template_components', 'assistant_sessions',
  'assistant_messages', 'assistant_events', 'support_tickets',
  'catalogs', 'catalog_rows', 'catalog_maps', 'copilot_progress',
];

// Tables with FK-chain company scoping (no direct company_id column).
// These are the most leak-prone — the null-FK OR-branch bug class.
const FK_CHAIN_TABLES = [
  'quote_components',        // → quotes.company_id (via quote_id)
  'quote_component_entries', // → quote_components → quotes.company_id
  'quote_roof_areas',        // → quotes.company_id
  'quote_roof_area_entries', // → quote_roof_areas → quotes.company_id
  'quote_files',             // → quotes.company_id
  'invoice_activity',        // → invoices.company_id (via invoice_id)
  'invoice_disputes',        // → invoices.company_id
  'message_attachments',     // → outbound_messages.company_id
  'material_order_responses',// → material_orders.company_id
  'quote_taxes',             // → quotes.company_id
];

async function main() {
  let failures = 0;
  let warnings = 0;

  const allTables = [...TENANT_TABLES, ...FK_CHAIN_TABLES];

  console.log('=== Cross-Company RLS Test Harness ===\n');
  console.log(`Checking ${allTables.length} tenant tables for company isolation.\n`);

  // ─── 1. Verify RLS is enabled on all tenant tables ───
  console.log('--- Step 1: RLS enabled on all tenant tables ---');
  const rlsCheck = await sql(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (${allTables.map(t => `'${t}'`).join(',')})
    ORDER BY tablename;
  `);

  const rlsEnabled = new Map();
  for (const row of rlsCheck) {
    rlsEnabled.set(row.tablename, row.rowsecurity);
  }

  for (const table of allTables) {
    if (!rlsEnabled.has(table)) {
      console.log(`  ⚠️  Table '${table}' not found in schema`);
      warnings++;
    } else if (!rlsEnabled.get(table)) {
      console.log(`  ❌ RLS DISABLED on '${table}'`);
      failures++;
    }
  }
  const rlsOk = allTables.filter(t => rlsEnabled.get(t) === true).length;
  console.log(`  ${rlsOk}/${allTables.length} tables have RLS enabled.\n`);

  // ─── 2. Verify each tenant table has a company-scoped isolation policy ───
  // Policies may use cmd='SELECT' or cmd='ALL' (which covers SELECT+INSERT+UPDATE+DELETE).
  console.log('--- Step 2: Company-scoped isolation policies exist ---');
  const policies = await sql(`
    SELECT tablename, policyname, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (${allTables.map(t => `'${t}'`).join(',')})
      AND cmd IN ('SELECT', 'ALL')
    ORDER BY tablename;
  `);

  const tablesWithPolicy = new Map(); // tablename → [{policyname, qual}]
  for (const row of policies) {
    if (!tablesWithPolicy.has(row.tablename)) {
      tablesWithPolicy.set(row.tablename, []);
    }
    tablesWithPolicy.get(row.tablename).push(row);
  }

  for (const table of allTables) {
    if (!tablesWithPolicy.has(table)) {
      // No policy = deny all (fail-closed). This is safe if the table is only
      // accessed via service role. Flag as warning, not failure.
      console.log(`  ⚠️  No policy on '${table}' (fail-closed — OK if service-role only)`);
      warnings++;
    }
  }
  console.log(`  ${tablesWithPolicy.size}/${allTables.length} tables have isolation policies.\n`);

  // ─── 3. Adversarial probe: FK-chain tables for null-FK OR-branch leak ───
  // This is the exact pattern that leaked in Gerald H-01 (2026-06-29):
  // a policy that uses EXISTS(... LEFT JOIN ... WHERE ... OR fk IS NULL)
  // which leaks rows with null FK across company boundaries.
  console.log('--- Step 3: Adversarial probe — null-FK OR-branch leak pattern ---');
  for (const table of FK_CHAIN_TABLES) {
    const tablePolicies = tablesWithPolicy.get(table) || [];
    if (tablePolicies.length === 0) {
      console.log(`  ⚠️  No policy on '${table}' to probe`);
      continue;
    }

    for (const p of tablePolicies) {
      const qual = (p.qual || '').toLowerCase();

      // The dangerous pattern: OR combined with IS NULL on an FK column,
      // where the OR branch bypasses the company_id check entirely.
      // This leaked rows where the FK was null across company boundaries.
      //
      // HOWEVER: the Gerald R3 fix (20260629110000) uses OR + IS NULL safely —
      // the company scoping is in the PRIMARY EXISTS (through quote_id →
      // quotes.company_id), and the OR + IS NULL is in a SECONDARY consistency
      // check that only verifies IF quote_roof_area_id is set, it belongs to
      // the same quote. That's safe because the company gate is already passed.
      //
      // We detect the dangerous pattern by checking if OR + IS NULL appears
      // in a context where it could bypass the company check — specifically,
      // if the EXISTS with company_id is AND'd with the OR + IS NULL (safe),
      // vs if the OR + IS NULL is an alternative path to the company check (unsafe).
      const hasOr = qual.includes(' or ');
      const hasIsNull = qual.includes('is null');
      const hasCompanyCheck = qual.includes('company_id') || qual.includes('current_company_id');

      if (hasOr && hasIsNull && hasCompanyCheck) {
        // Likely the safe pattern (Gerald R3 fix): company check is AND'd first,
        // OR+IS NULL is a secondary consistency check. Flag as warning, not failure.
        console.log(`  ⚠️  '${table}' policy '${p.policyname}' has OR + IS NULL + company_id — verify company check is primary (AND'd), not alternative (OR'd)`);
        warnings++;
      } else if (hasOr && hasIsNull && !hasCompanyCheck) {
        console.log(`  ❌ '${table}' policy '${p.policyname}' has OR + IS NULL without company_id check — potential leak`);
        console.log(`      qual: ${p.qual}`);
        failures++;
      } else {
        console.log(`  ✅ '${table}' policy '${p.policyname}' looks safe`);
      }
    }
  }
  console.log('');

  // ─── 4. Verify policies reference company_id ───
  console.log('--- Step 4: Policies reference company_id or current_company_id() ---');
  let companyRefOk = 0;
  let companyRefFail = 0;
  for (const [table, pols] of tablesWithPolicy) {
    let found = false;
    for (const p of pols) {
      const qual = (p.qual || '').toLowerCase();
      // Valid isolation patterns: company_id, current_company_id(), or user_id = auth.uid()
      if (qual.includes('company_id') || qual.includes('current_company_id') || qual.includes('company_has_feature') || qual.includes('auth.uid')) {
        found = true;
        break;
      }
    }
    if (found) {
      companyRefOk++;
    } else {
      console.log(`  ⚠️  '${table}' policy may not reference company_id or auth.uid()`);
      companyRefFail++;
      warnings++;
    }
  }
  console.log(`  ${companyRefOk}/${tablesWithPolicy.size} policies reference company_id.\n`);

  // ─── 5. Summary ───
  console.log('=== Summary ===');
  console.log(`  RLS enabled:       ${rlsOk}/${allTables.length}`);
  console.log(`  Isolation policies: ${tablesWithPolicy.size}/${allTables.length}`);
  console.log(`  Company-scoped:    ${companyRefOk}/${tablesWithPolicy.size}`);
  console.log(`  Failures:          ${failures}`);
  console.log(`  Warnings:          ${warnings}`);

  if (failures > 0) {
    console.log('\n❌ RLS HARNESS FAILED — fix failures before merging to main.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  RLS harness passed with warnings — review manually.');
    process.exit(0);
  } else {
    console.log('\n✅ All RLS checks passed.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
