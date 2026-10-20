/**
 * SINGLE BILLING-TYPE RESOLVER (owner directive 2026-10-19 "never-again job").
 *
 * Every quota / metering / gating call site MUST resolve a company's billing
 * type through this module (or the thin wrappers in custom/usage/store.ts and
 * custom/legacy-boundary.ts). Do NOT re-derive the type from raw column reads
 * at call sites: the 2026-10-19 incident chain (QCP01 env throw, QCP07 hold
 * trigger, legacy points RPC on custom_setup) was caused exactly by scattered
 * code assuming only two company kinds while admin-granted custom is a third.
 *
 * Three kinds:
 *   legacy                - plan_code + subscription_plans + AI-points ledger
 *   custom_metered        - Stripe-linked custom setup, usage registry active
 *   custom_admin_granted  - admin grant (no Stripe linkage), snapshot-decided,
 *                           unmetered until the Stripe live-switch
 *
 * scripts/check-billing-resolver.mjs greps-enforces this (npm run check:billing).
 * app/api/smoke/billing-matrix probes all three kinds on every testing deploy.
 */

import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { UsageError } from './custom/usage/contracts';

export type BillingKind = 'legacy' | 'custom_metered' | 'custom_admin_granted';

export interface BillingRegistryRef {
  stripe_account_id: string;
  stripe_mode: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
}

export interface ResolvedBillingType {
  kind: BillingKind;
  /** Validated raw companies.billing_model. */
  billingModel: 'legacy' | 'custom_setup';
  /** company_custom_billing registry ref for custom setups; null for legacy. */
  registry: BillingRegistryRef | null;
}

/**
 * Resolve a company's billing type in one cached DB read (React cache():
 * once per request regardless of how many gates ask). Throws
 * UsageError('usage_unavailable') on unknown / missing company or model,
 * matching the previous store.ts behaviour.
 *
 * Semantics preserved from the pre-resolver code:
 *   - custom_setup with a registry row whose stripe_customer_id is the admin
 *     grant marker -> custom_admin_granted;
 *   - custom_setup with a MISSING registry row -> custom_metered (the old
 *     customUsageMeteringApplies treated a null snapshot as metered, which
 *     then fails closed inside the usage RPCs; keep that behaviour).
 */
export const resolveBillingType = cache(
  async (companyId: string): Promise<ResolvedBillingType> => {
    const admin = createAdminClient();
    const [companyResult, registryResult] = await Promise.all([
      // billing_model / company_custom_billing are not in the generated types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('companies').select('billing_model').eq('id', companyId).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .from('company_custom_billing')
        .select('stripe_account_id, stripe_mode, stripe_customer_id, stripe_subscription_id')
        .eq('company_id', companyId)
        .maybeSingle(),
    ]);
    if (companyResult.error || !companyResult.data) {
      throw new UsageError('usage_unavailable', 'Billing ownership could not be verified.');
    }
    const model = (companyResult.data as { billing_model: unknown }).billing_model;
    if (model !== 'legacy' && model !== 'custom_setup') {
      throw new UsageError('usage_unavailable', 'Billing ownership is not recognised.');
    }
    const registry = (registryResult.data ?? null) as BillingRegistryRef | null;
    if (model === 'legacy') {
      return { kind: 'legacy', billingModel: 'legacy', registry: null };
    }
    const isAdminGrant = registry?.stripe_customer_id === 'admin-granted';
    return {
      kind: isAdminGrant ? 'custom_admin_granted' : 'custom_metered',
      billingModel: 'custom_setup',
      registry,
    };
  },
);
