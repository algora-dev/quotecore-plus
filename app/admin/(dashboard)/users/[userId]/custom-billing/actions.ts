'use server';

/**
 * Admin custom-billing powers (2026-10-12): grant/comp + Stripe-linked change.
 *
 * Two modes, mirroring the owner-verified user flows:
 *  - Grant (comp/manual): re-validates the calculator setup against the same
 *    pinned catalogue as checkout (expandValidatedSetup), then writes the
 *    snapshot + entitlements directly with sentinel Stripe ids. No charge.
 *    Also serves as the legacy->custom migration path (no Stripe sub needed).
 *  - Stripe-linked change: admin-initiated wrapper around the SAME update.ts
 *    swap + kind='change' reconcile the user flow uses (owner-verified
 *    2026-10-11 both directions). Never touches period grants.
 */

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { writeAudit } from '@/app/lib/admin/audit';
import { getStripeMode, requireStripe } from '@/app/lib/billing/stripe';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { expandValidatedSetup } from '@/app/lib/billing/custom/checkout';
import { previewCustomSetupChange as previewChange, changeCustomSetup as runChange } from '@/app/lib/billing/custom/update';
import type { PurchasedLimits } from '@/app/lib/billing/custom/contracts';

export type AdminActionReply = { ok: true; message: string } | { ok: false; error: string };

function badRawSetup(): string {
  return 'Your pricing setup could not be restored. Please re-run the pricing tool.';
}

// ---------------------------------------------------------------------------
// State read
// ---------------------------------------------------------------------------

export interface AdminCustomBillingState {
  billingModel: string | null;
  adminGranted: boolean;
  stripeLinked: boolean;
  snapshot: {
    componentCodes: string[];
    monthlyCents: number;
    currency: string;
    providerStatus: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    entitlements: PurchasedLimits | null;
  } | null;
  creditBalanceCents: number;
}

export async function getAdminCustomBillingState(companyId: string): Promise<{ ok: true; state: AdminCustomBillingState } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  const { data: company, error: coErr } = await client
    .from('companies')
    .select('id, name, billing_model, stripe_subscription_id, stripe_customer_id')
    .eq('id', companyId)
    .maybeSingle();
  if (coErr || !company) return { ok: false, error: 'Company not found.' };

  const { data: snap } = await client
    .from('company_custom_billing')
    .select('component_codes, purchased_entitlements, monthly_cents, currency, provider_status, period_start, period_end, stripe_customer_id, stripe_subscription_id')
    .eq('company_id', companyId)
    .maybeSingle();

  const adminGranted = !!snap && (snap.stripe_customer_id === 'admin-granted' || String(snap.stripe_subscription_id ?? '').startsWith('admin-'));
  const stripeLinked = !!snap && !adminGranted && !!company.stripe_subscription_id && snap.stripe_subscription_id === company.stripe_subscription_id;

  let creditBalanceCents = 0;
  if (stripeLinked && company.stripe_customer_id) {
    try {
      const customer = await requireStripe().customers.retrieve(String(company.stripe_customer_id));
      if (customer && !('deleted' in customer)) creditBalanceCents = Math.max(0, -((customer as { balance?: number }).balance ?? 0));
    } catch { /* best-effort display only */ }
  }

  return {
    ok: true,
    state: {
      billingModel: company.billing_model ?? null,
      adminGranted,
      stripeLinked,
      snapshot: snap
        ? {
            componentCodes: Array.isArray(snap.component_codes) ? snap.component_codes : [],
            monthlyCents: Number(snap.monthly_cents ?? 0),
            currency: String(snap.currency ?? 'usd'),
            providerStatus: snap.provider_status ?? null,
            periodStart: snap.period_start ?? null,
            periodEnd: snap.period_end ?? null,
            entitlements: (snap.purchased_entitlements ?? null) as PurchasedLimits | null,
          }
        : null,
      creditBalanceCents,
    },
  };
}

// ---------------------------------------------------------------------------
// Grant preview (validates the setup server-side; no state change)
// ---------------------------------------------------------------------------

export async function adminPreviewGrant(rawSetup: string): Promise<{ ok: true; monthlyCents: number; rows: { productName: string; monthlyCents: number }[]; codes: string[] } | { ok: false; error: string }> {
  await requireAdmin();
  if (!rawSetup || typeof rawSetup !== 'string' || rawSetup.length > 4096) return { ok: false, error: badRawSetup() };
  try {
    const expanded = await expandValidatedSetup(rawSetup);
    return {
      ok: true,
      monthlyCents: expanded.monthlyCents,
      codes: expanded.selection.map(r => r.code),
      rows: expanded.selection.map(r => ({ productName: r.productName, monthlyCents: r.monthlyCents })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : badRawSetup() };
  }
}

// ---------------------------------------------------------------------------
// Grant / comp (no Stripe charge; sentinel ids keep reconcile away)
// ---------------------------------------------------------------------------

export async function adminGrantCustomSetup(
  companyId: string,
  rawSetup: string,
  reason: string,
  endsAt: string,
): Promise<AdminActionReply> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  if (!reason.trim()) return { ok: false, error: 'A reason is required for the audit trail.' };
  if (!rawSetup || typeof rawSetup !== 'string' || rawSetup.length > 4096) return { ok: false, error: badRawSetup() };
  const ends = Date.parse(endsAt);
  if (Number.isNaN(ends) || ends <= Date.now()) return { ok: false, error: 'A valid future end date is required.' };

  const { data: company } = await client.from('companies').select('id, name, stripe_subscription_id').eq('id', companyId).maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };
  // A manual grant must never overwrite a Stripe-backed subscription.
  if (company.stripe_subscription_id && !String(company.stripe_subscription_id).startsWith('admin-'))
    return { ok: false, error: 'Stripe-backed accounts need the reviewed custom change flow, not a manual grant.' };

  const { data: mapRow } = await client
    .from('custom_billing_price_map')
    .select('stripe_account_id')
    .eq('stripe_mode', getStripeMode())
    .limit(1)
    .maybeSingle();
  if (!mapRow?.stripe_account_id) return { ok: false, error: 'Price registry has no account binding for this mode; provision the catalogue first.' };

  let codes: string[]; let monthlyCents: number; let limits: PurchasedLimits;
  try {
    const expanded = await expandValidatedSetup(rawSetup);
    codes = expanded.selection.map(r => r.code);
    monthlyCents = expanded.monthlyCents;
    const capacity = expanded.selection.find(r => r.productKey === 'capacity');
    const digital = expanded.selection.find(r => r.productKey === 'digital');
    const scan = expanded.selection.find(r => r.productKey === 'scan');
    const offcuts = expanded.selection.find(r => r.productKey === 'offcuts');
    const assistant = expanded.selection.find(r => r.productKey === 'assistant');
    if (!capacity) return { ok: false, error: 'Setup is missing a capacity component.' };
    limits = {
      capacity: (capacity.tier as PurchasedLimits['capacity']) ?? 'low',
      quotes: capacity.entitlements.quotes ?? 0,
      storageBytes: capacity.entitlements.storageBytes ?? 0,
      digitalTakeoff: !!digital,
      scanTokens: scan?.entitlements.scanTokens ?? 0,
      offcuts: !!offcuts,
      assistantTasks: assistant?.entitlements.assistantTasks ?? 0,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : badRawSetup() };
  }

  const nowIso = new Date().toISOString();
  const { error: snapErr } = await client
    .from('company_custom_billing')
    .upsert({
      company_id: companyId,
      stripe_account_id: mapRow.stripe_account_id,
      stripe_mode: getStripeMode(),
      stripe_customer_id: 'admin-granted',
      stripe_subscription_id: `admin-${companyId}`,
      catalog_id: PREVIEW_CATALOG.id,
      catalog_revision: PREVIEW_CATALOG.revision,
      component_codes: codes,
      purchased_entitlements: limits,
      provider_status: 'active',
      currency: PREVIEW_CATALOG.currency.toLowerCase(),
      monthly_cents: monthlyCents,
      period_start: nowIso,
      period_end: new Date(ends).toISOString(),
      reconciled_at: nowIso,
    }, { onConflict: 'company_id' });
  if (snapErr) return { ok: false, error: `Snapshot write failed: ${snapErr.message}` };

  const { error: coErr } = await client
    .from('companies')
    .update({ billing_model: 'custom_setup', subscription_status: 'active' })
    .eq('id', companyId);
  if (coErr) return { ok: false, error: `Company update failed: ${coErr.message}` };

  await writeAudit(admin, adminProfile, 'admin_grant_custom_setup', companyId, null, null, company.name, reason, { codes, monthlyCents, endsAt: new Date(ends).toISOString() });

  return { ok: true, message: `Custom setup granted: $${(monthlyCents / 100).toFixed(0)}/mo, ${codes.length} components, until ${new Date(ends).toISOString().slice(0, 10)}.` };
}

// ---------------------------------------------------------------------------
// Stripe-linked change (same swap + kind='change' reconcile as the user flow)
// ---------------------------------------------------------------------------

export async function adminPreviewCustomChange(companyId: string, rawSetup: string): Promise<{ ok: boolean; message: string; direction?: string; currentMonthlyCents?: number; newMonthlyCents?: number; proratedTodayCents?: number; newRows?: { productName: string; monthlyCents: number }[] }> {
  await requireAdmin();
  if (!rawSetup || typeof rawSetup !== 'string' || rawSetup.length > 4096) return { ok: false, message: badRawSetup() };
  const result = await previewChange({ rawSetup, companyId });
  return result.ok
    ? { ok: true, message: 'Preview ready.', direction: result.direction, currentMonthlyCents: result.currentMonthlyCents, newMonthlyCents: result.newMonthlyCents, proratedTodayCents: result.proratedTodayCents, newRows: result.newRows }
    : { ok: false, message: result.message };
}

export async function adminApplyCustomChange(companyId: string, rawSetup: string, reason: string): Promise<AdminActionReply> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();
  if (!reason.trim()) return { ok: false, error: 'A reason is required for the audit trail.' };
  if (!rawSetup || typeof rawSetup !== 'string' || rawSetup.length > 4096) return { ok: false, error: badRawSetup() };

  const { data: company } = await admin.from('companies').select('id, name').eq('id', companyId).maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };

  const result = await runChange({ rawSetup, companyId, userId: adminProfile.id });
  if (!result.ok) return { ok: false, error: result.message };

  await writeAudit(admin, adminProfile, 'admin_apply_custom_change', companyId, null, null, company.name, reason, { newMonthlyCents: result.newMonthlyCents, proratedTodayCents: result.proratedTodayCents, reconcile: result.result });

  const today = result.proratedTodayCents === 0 ? 'No immediate charge.' : result.proratedTodayCents > 0
    ? `Charged today (prorated): $${(result.proratedTodayCents / 100).toFixed(2)}.`
    : `Credited on next invoice (prorated): $${(Math.abs(result.proratedTodayCents) / 100).toFixed(2)}.`;
  return { ok: true, message: `Subscription updated to $${(result.newMonthlyCents / 100).toFixed(0)}/mo. ${today}` };
}
