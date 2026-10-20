#!/usr/bin/env node
/**
 * Billing-resolver guard (owner directive 2026-10-19 "never-again job").
 *
 * Greps app code for billing-type decisions that bypass the single resolver
 * (app/lib/billing/company-type.ts). The 2026-10-19 incident chain happened
 * because scattered call sites re-derived company billing type from raw
 * columns. This script makes that class of drift fail CI-style.
 *
 * Usage:
 *   node scripts/check-billing-resolver.mjs            (errors fail, warnings pass)
 *   node scripts/check-billing-resolver.mjs --strict   (warnings fail too)
 *
 * Wired as `npm run check:billing`. Run before every push that touches
 * app/lib/billing, app/api (quota paths) or app/lib/smart-assistant.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const APP = join(ROOT, 'app');
const STRICT = process.argv.includes('--strict');

/** Paths allowed to contain the pattern (resolver itself, central modules,
 *  admin writers, smoke). Relative, forward slashes. */
const ALLOWLIST = {
  'admin-granted': [
    'app/lib/billing/company-type.ts',
    'app/lib/billing/custom/contracts.ts',
    'app/lib/billing/custom/usage/store.ts',
    'app/lib/billing/custom/usage/storage.ts',
    'app/lib/billing/entitlements.ts',
    'app/lib/billing/custom/legacy-boundary.ts',
    'app/api/takeoff/ai-scan-v3/route.ts',
    'app/lib/smart-assistant/orchestrator.ts',
    'app/admin/(dashboard)/users/[userId]/custom-billing/actions.ts',
    'app/admin/(dashboard)/users/[userId]/custom-billing/CustomBillingSection.tsx',
    'app/api/smoke/billing-matrix/route.ts',
  ],
  // Raw billing_model column reads outside these paths = new decision site.
  'billing_model-read': [
    'app/lib/billing/company-type.ts',
    'app/lib/billing/entitlements.ts',
    'app/lib/billing/custom/checkout.ts',
    'app/lib/billing/custom/update.ts',
    'app/lib/billing/custom/reconcile.ts',
    'app/lib/billing/custom/payment-lifecycle.ts',
    'app/api/cron/process-billing-lifecycle/route.ts',
    'app/api/smoke/billing-matrix/route.ts',
    'app/admin/(dashboard)/customer-accounts/actions.ts',
    'app/admin/(dashboard)/users/actions.ts',
    'app/admin/(dashboard)/users/[userId]/actions.ts',
    'app/admin/(dashboard)/users/[userId]/custom-billing/actions.ts',
    'app/admin/(dashboard)/smart-assistant/actions.ts',
    'app/admin/(dashboard)/smart-assistant/SmartAssistantPanel.tsx',
    'app/(auth)/[workspaceSlug]/account/billing/actions.ts',
    'app/lib/demo/provision.ts',
    'app/lib/billing/custom/contracts.ts',
  ],
  // Legacy points ledger RPCs: entitlements (read) + ai-scan-v3 (deduct).
  'legacy-points-rpc': [
    'app/lib/billing/entitlements.ts',
    'app/api/takeoff/ai-scan-v3/route.ts',
    'app/api/smoke/billing-matrix/route.ts',
    'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx',
    'app/admin/(dashboard)/users/[userId]/actions.ts',
    'app/lib/takeoff/pointCost.ts',
  ],
};

const RULES = [
  {
    id: 'admin-granted',
    test: /admin-granted/,
    severity: 'error',
    message: "Admin-grant marker outside the resolver/allowlist. Use resolveBillingType() (app/lib/billing/company-type.ts) instead of string-matching the registry.",
  },
  {
    id: 'billing_model-read',
    test: /(?:select\([^)]*billing_model|\.eq\(\s*'billing_model'|billing_model\s*===|billing_model\s*!==|billing_model\s*==)/,
    severity: 'warn',
    message: 'Raw billing_model read outside the resolver allowlist. Route billing-type decisions through resolveBillingType().',
  },
  {
    id: 'legacy-points-rpc',
    test: /(?:check_and_deduct_ai_points|get_ai_assist_points_status|ai_assist_points_ledger)/,
    severity: 'error',
    message: 'Legacy AI-points RPC outside its two sanctioned sites (entitlements read + ai-scan-v3 deduct, legacy-kind-only). Custom companies must never touch this ledger.',
  },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) files.push(full);
  }
  return files;
}

const errors = [];
const warnings = [];
for (const file of walk(APP)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const rule of RULES) {
    if (!rule.test.test(text)) continue;
    if (ALLOWLIST[rule.id]?.includes(rel)) continue;
    const line = text.slice(0, rule.test.exec(text).index).split('\n').length;
    const hit = { file: rel, line, rule: rule.id, message: rule.message };
    if (rule.severity === 'error') errors.push(hit); else warnings.push(hit);
  }
}

if (warnings.length) {
  console.log(`\n[check-billing-resolver] ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  WARN ${w.file}:${w.line} [${w.rule}] ${w.message}`);
}
if (errors.length) {
  console.error(`\n[check-billing-resolver] ${errors.length} error(s):`);
  for (const e of errors) console.error(`  ERR  ${e.file}:${e.line} [${e.rule}] ${e.message}`);
  process.exit(1);
}
if (STRICT && warnings.length) {
  console.error('\n[check-billing-resolver] --strict: warnings fail the run.');
  process.exit(1);
}
console.log(`\n[check-billing-resolver] clean (${errors.length} errors, ${warnings.length} warnings${STRICT ? ', strict' : ''}).`);
