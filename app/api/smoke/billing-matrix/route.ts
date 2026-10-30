/**
 * BILLING-MATRIX SMOKE (owner directive 2026-10-19 "never-again job").
 *
 * Creates one fixture company per billing kind (legacy / custom_metered /
 * custom_admin_granted), probes the real decision + metering call sites every
 * customer flow depends on, then cleans up. Would have caught all three
 * 2026-10-19 incidents (QCP01 env throw, QCP07 hold trigger, legacy points
 * RPC on custom_setup) before merge.
 *
 * RUN ON EVERY TESTING DEPLOY (docs/smoke-tests/CHECKLIST.md):
 *   node scripts/billing-matrix-smoke.mjs --url https://<testing-host>
 *
 * Fail-closed gate: requires header x-qcp-smoke-key === env BILLING_SMOKE_KEY.
 * Env unset (e.g. production) -> 404, never runs.
 */

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { resolveBillingType } from '@/app/lib/billing/company-type';
import { customUsageMeteringApplies, isCustomUsageCompany, loadCustomUsage } from '@/app/lib/billing/custom/usage/store';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { reservePurchasedStorage, cleanupUnregisteredCustomObject } from '@/app/lib/billing/custom/usage/storage';
import { customStripeMode } from '@/app/lib/billing/custom/environment';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Check = { name: string; ok: boolean; error?: string };

interface FixturePlan {
  kind: 'legacy' | 'custom_metered' | 'custom_admin_granted';
  slug: string;
  name: string;
}

function limitsForSmoke() {
  return {
    capacity: 'low',
    quotes: 5,
    storageBytes: 1048576,
    digitalTakeoff: true,
    scanTokens: 4,
    offcuts: false,
    assistantTasks: 5,
  };
}

/** Create one fixture company (+ registry rows for custom kinds). Returns company id. */
async function createFixture(plan: FixturePlan, admin: ReturnType<typeof createAdminClient>, sfx: string): Promise<string> {
  const nowIso = new Date().toISOString();
  const periodStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const limits = limitsForSmoke();
  const envAcct = process.env.CUSTOM_BILLING_STRIPE_ACCOUNT_ID ?? null;
  // The entitlements/usage loaders verify fixture rows against the DEPLOYMENT
  // stripe scope (mode derived from STRIPE_SECRET_KEY). Since the 10-20 live
  // switch, testing runs a live key, so hardcoded 'test' rows fail with
  // custom_snapshot_mode_mismatch. Stamp the deployment's real mode instead.
  const envMode = customStripeMode();

  const base = {
    name: plan.name,
    slug: plan.slug,
    default_currency: 'USD',
    default_language: 'en',
    default_measurement_system: 'metric',
    default_trade: 'roofing',
    default_tax_rate: 0,
    plan_code: 'starter',
    subscription_status: 'active',
    onboarding_completed_at: nowIso,
  };

  let insert: Record<string, unknown>;
  if (plan.kind === 'legacy') {
    insert = { ...base, billing_model: 'legacy' };
  } else if (plan.kind === 'custom_metered') {
    // Stripe-linked custom: companies row + registry must match identity-wise,
    // and the metered usage context requires a period-grant row (invoice-bound).
    insert = {
      ...base,
      billing_model: 'custom_setup',
      stripe_mode: envMode,
      stripe_customer_id: `cus_smoke${sfx}`,
      stripe_subscription_id: `sub_smoke${sfx}`,
    };
  } else {
    // Admin grant: no Stripe linkage on the companies row.
    insert = { ...base, billing_model: 'custom_setup' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company, error: coErr } = await (admin as any).from('companies').insert(insert).select('id').single();
  if (coErr || !company) throw new Error(`fixture create failed (${plan.slug}): ${coErr?.message ?? 'no row'}`);

  if (plan.kind !== 'legacy') {
    const registry = {
      company_id: company.id,
      // Metered MUST use the deployment env account (usage RPCs verify env scope);
      // admin grants reserve from their OWN registry (c3cd3ef9 semantics).
      stripe_account_id: plan.kind === 'custom_metered'
        ? (envAcct ?? '')
        : (envAcct ?? 'acct_smokefixture01'),
      stripe_mode: plan.kind === 'custom_metered' ? envMode : 'test',
      stripe_customer_id: plan.kind === 'custom_admin_granted' ? 'admin-granted' : `cus_smoke${sfx}`,
      stripe_subscription_id: plan.kind === 'custom_admin_granted' ? `admin-smoke-${sfx}` : `sub_smoke${sfx}`,
      catalog_id: PREVIEW_CATALOG.id,
      catalog_revision: PREVIEW_CATALOG.revision,
      component_codes: ['core_base', 'capacity_low', 'digital_base', 'assistant_low'],
      purchased_entitlements: limits,
      provider_status: 'active',
      currency: 'usd',
      monthly_cents: 0,
      period_start: periodStart,
      period_end: periodEnd,
      reconciled_at: nowIso,
      ...(plan.kind === 'custom_metered' ? { last_paid_invoice_id: `in_smoke${sfx}` } : {}),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: regErr } = await (admin as any).from('company_custom_billing').insert(registry);
    if (regErr) throw new Error(`registry create failed (${plan.slug}): ${regErr.message}`);

    if (plan.kind === 'custom_metered') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: grantErr } = await (admin as any).from('custom_billing_period_grants').insert({
        company_id: company.id,
        stripe_mode: envMode,
        subscription_id: `sub_smoke${sfx}`,
        period_start: periodStart,
        period_end: periodEnd,
        invoice_id: `in_smoke${sfx}`,
        granted_limits: limits,
      });
      if (grantErr) throw new Error(`period grant create failed (${plan.slug}): ${grantErr.message}`);
    }
  }
  return company.id as string;
}

async function cleanupFixture(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<string[]> {
  const notes: string[] = [];
  const tables = ['custom_billing_period_grants', 'company_custom_billing', 'qcp_storage_holds'];
  for (const table of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from(table).delete().eq('company_id', companyId);
    if (error) notes.push(`${table}: ${error.message}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: coErr } = await (admin as any).from('companies').delete().eq('id', companyId);
  if (coErr) notes.push(`companies: ${coErr.message}`);
  return notes;
}

/** Surface UsageError code + details: mapped messages alone hide the SQLSTATE. */
function describeError(error: unknown): string {
  const e = error as { code?: string; details?: unknown };
  const parts: string[] = [];
  if (e?.code) parts.push(`code=${e.code}`);
  if (e?.details !== undefined && e?.details !== null) parts.push(`details=${JSON.stringify(e.details)}`);
  parts.push(error instanceof Error ? error.message : String(error));
  return parts.join(' ');
}

/** Storage reserve + full QCP07 hold-contract round-trip for custom fixtures. */
async function storageRoundTrip(companyId: string, sfx: string, checks: Check[]): Promise<void> {
  const admin = createAdminClient();
  const bucket = 'company-logos';
  const dir = `${companyId}/smoke`;
  const path = `${dir}/billing-matrix-${sfx}.bin`;
  try {
    // Upload + readback: the reserve RPC verifies storage.objects metadata,
    // so record exactly what storage holds before blaming the RPC. The logos
    // bucket restricts mime types (images only): declare image/png.
    const up = await admin.storage.from(bucket).upload(path, Buffer.from('x'), { contentType: 'image/png' });
    if (up.error) throw new Error(`upload: ${up.error.message}`);
    const list = await admin.storage.from(bucket).list(dir, { limit: 10 });
    const found = (list.data ?? []).find(o => o.name === `billing-matrix-${sfx}.bin`);
    const meta = found ? `metadata=${JSON.stringify((found as { metadata?: unknown }).metadata ?? null)}` : 'object NOT listed after upload';
    checks.push({ name: 'storage.upload', ok: !!found, error: found ? undefined : `${meta} (list error: ${list.error?.message ?? 'none'})` });
    const reserved = await reservePurchasedStorage({ companyId, bucket, path, size: 1, kind: 'logo' });
    checks.push({ name: 'storage.reserve', ok: reserved === true, error: reserved === true ? undefined : `reserve returned ${reserved}; ${meta}` });
    const cleaned = await cleanupUnregisteredCustomObject({ companyId, bucket, path });
    checks.push({ name: 'storage.hold-release', ok: cleaned === true, error: cleaned === true ? undefined : `cleanup returned ${cleaned}` });
  } catch (error) {
    checks.push({ name: 'storage.reserve', ok: false, error: describeError(error) });
    await admin.storage.from(bucket).remove([path]).catch(() => undefined);
  }
}

async function runMatrix(): Promise<Response> {
  const admin = createAdminClient();
  const sfx = Date.now().toString(36);
  const envAcct = process.env.CUSTOM_BILLING_STRIPE_ACCOUNT_ID ?? null;
  const plans: FixturePlan[] = [
    { kind: 'legacy', slug: `qcp-smoke-legacy-${sfx}`, name: `QC Smoke Legacy ${sfx}` },
    { kind: 'custom_metered', slug: `qcp-smoke-metered-${sfx}`, name: `QC Smoke Metered ${sfx}` },
    { kind: 'custom_admin_granted', slug: `qcp-smoke-admgrant-${sfx}`, name: `QC Smoke AdminGrant ${sfx}` },
  ];

  const created: { plan: FixturePlan; companyId: string }[] = [];
  const matrix: { fixture: string; companyId: string; checks: Check[] }[] = [];
  const setupErrors: string[] = [];

  for (const plan of plans) {
    try {
      created.push({ plan, companyId: await createFixture(plan, admin, sfx) });
    } catch (error) {
      setupErrors.push(`${plan.kind}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const { plan, companyId } of created) {
    const checks: Check[] = [];
    const check = async (name: string, fn: () => Promise<void>) => {
      try { await fn(); checks.push({ name, ok: true }); }
      catch (error) { checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) }); }
    };

    // 1. Resolver kind (the single source of truth).
    await check('resolver.kind', async () => {
      const type = await resolveBillingType(companyId);
      if (type.kind !== plan.kind) throw new Error(`expected ${plan.kind}, got ${type.kind}`);
    });
    // 2-3. Wrapper agreement (call sites keep these signatures).
    await check('wrapper.isCustomUsageCompany', async () => {
      const v = await isCustomUsageCompany(companyId);
      if (v !== (plan.kind !== 'legacy')) throw new Error(`expected ${plan.kind !== 'legacy'}, got ${v}`);
    });
    await check('wrapper.customUsageMeteringApplies', async () => {
      const v = await customUsageMeteringApplies(companyId);
      if (v !== (plan.kind === 'custom_metered')) throw new Error(`expected ${plan.kind === 'custom_metered'}, got ${v}`);
    });
    // 4. Entitlements read (every gated page depends on this resolving).
    await check('entitlements.load', async () => {
      const ent = await loadCompanyEntitlements(companyId);
      if (!ent.isActive) throw new Error(`inactive: status ${ent.subscriptionStatus}`);
      const expectedModel = plan.kind === 'legacy' ? 'legacy' : 'custom_setup';
      if (ent.billingModel !== expectedModel) throw new Error(`expected billingModel ${expectedModel}, got ${ent.billingModel}`);
      // Custom limits must come from the SNAPSHOT (quotes: 5), never the
      // legacy starter plan (25) - a legacy fallback here is the Roofline class.
      if (plan.kind !== 'legacy' && ent.monthlyQuoteLimit !== 5) {
        throw new Error(`expected snapshot quotes limit 5, got ${ent.monthlyQuoteLimit}`);
      }
    });
    // 5. SA gate SQL mirror (legacy tiers get no SA; custom with Assistant do).
    await check('sa_gate.smart_assistant_enabled', async () => {
      const { data, error } = await admin.rpc('smart_assistant_enabled', { p_company_id: companyId });
      if (error) throw new Error(error.message);
      const expected = plan.kind !== 'legacy';
      if (data !== expected) throw new Error(`expected ${expected}, got ${data}`);
    });

    // Legacy-only: the AI-points ledger RPC must work for legacy and ONLY legacy.
    if (plan.kind === 'legacy') {
      await check('legacy_points.rpc', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (admin as any).rpc('get_ai_assist_points_status', { p_company_id: companyId });
        if (error) throw new Error(error.message);
        if (!Array.isArray(data) || data.length === 0) throw new Error('no rows returned');
      });
    }

    // Metered-only: usage snapshot validates against the deployment env scope
    // (a missing/changed CUSTOM_BILLING_* env = incident class 1, fails here).
    if (plan.kind === 'custom_metered') {
      await check('usage.snapshot_env_scope', async () => {
        if (!envAcct) throw new Error('CUSTOM_BILLING_STRIPE_ACCOUNT_ID is not set on this deployment');
        const snap = await loadCustomUsage(companyId);
        if (snap.accountId !== envAcct) throw new Error(`snapshot acct ${snap.accountId} != env ${envAcct}`);
      });
    }

    // Both custom kinds: full storage hold-contract round-trip (QCP07 class).
    if (plan.kind !== 'legacy') {
      await storageRoundTrip(companyId, sfx, checks);
    }

    matrix.push({ fixture: plan.kind, companyId, checks });
  }

  // Best-effort cleanup (order: dependent tables, then companies).
  const cleanupNotes: string[] = [];
  for (const { companyId } of created) cleanupNotes.push(...await cleanupFixture(admin, companyId));

  const allOk = setupErrors.length === 0 && cleanupNotes.length === 0
    && matrix.every(row => row.checks.every(c => c.ok));
  return Response.json(
    { ok: allOk, ranAt: new Date().toISOString(), env: { hasEnvAcct: !!envAcct, catalog: PREVIEW_CATALOG.id }, setupErrors, matrix, cleanup: { ok: cleanupNotes.length === 0, notes: cleanupNotes } },
    { status: allOk ? 200 : 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const key = process.env.BILLING_SMOKE_KEY;
  if (!key || req.headers.get('x-qcp-smoke-key') !== key) {
    return new Response(null, { status: 404 });
  }
  try {
    return await runMatrix();
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
