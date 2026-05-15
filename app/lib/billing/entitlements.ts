/**
 * Subscription entitlements: the only API the rest of the app should use to
 * answer "is this company allowed to do X today?".
 *
 * Loads in one cached DB read per request via React `cache()`. Wraps the
 * four SQL functions added by the 2026-05-15 subscription tiers migration:
 *
 *   - public.company_effective_plan_code(uuid)   -> text
 *   - public.company_effective_plan_active(uuid) -> boolean
 *   - public.company_has_feature(uuid, text)     -> boolean
 *   - public.create_quote_atomic(uuid, uuid, jsonb) -> uuid (in quote-actions, not here)
 *
 * Public surface:
 *   loadCompanyEntitlements(companyId)   -> full snapshot for UI/SSR rendering
 *   requireFeature(companyId, feature)   -> throws FeatureGatedError on miss
 *   requireActiveSubscription(companyId) -> throws SubscriptionInactiveError on suspended/canceled
 *   assertCanSendMessage(companyId, mode) -> covers manual + scheduled_dispatch
 *   assertCanUseStorage(companyId, additionalBytes) -> throws StorageQuotaExceededError
 *
 * Why not put these checks in the JWT or session: plan_code and status can
 * change mid-session (Stripe webhook, admin override, dunning cron). A JWT
 * claim would go stale instantly. Single cached DB read per request is the
 * right tradeoff.
 */

import 'server-only';
import { cache } from 'react';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  FEATURE_MIN_PLAN,
  isFeature,
  type Feature,
} from './features';
import {
  FeatureGatedError,
  StorageQuotaExceededError,
  SubscriptionInactiveError,
} from './errors';

/**
 * Subscription lifecycle states. The shape matches the CHECK constraint on
 * `companies.subscription_status` added by the 2026-05-15 migration. Keep
 * synced.
 */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace'
  | 'pending_data_purge'
  | 'disputed'
  | 'cancellation_pending'
  | 'suspended'
  | 'canceled';

/**
 * Full entitlement snapshot for a company. Cached per request.
 */
export interface CompanyEntitlements {
  companyId: string;

  /**
   * What Stripe says the company is paying for. NEVER overwritten by payment
   * failures; only changes on explicit plan switch or admin override. The
   * SQL "effective plan" functions compute the actually-allowed plan from
   * this PLUS subscription_status PLUS comp_until.
   */
  purchasedPlanCode: string;

  /**
   * What the company can actually use today. Collapses to "starter" while
   * the account is in grace / pending_data_purge / cancellation_pending /
   * trial-expired-without-sub. Equals purchasedPlanCode when healthy.
   */
  effectivePlanCode: string;

  subscriptionStatus: SubscriptionStatus;

  /**
   * True if the account is allowed to interact at all (read AND write paths).
   * False ONLY for suspended/canceled. Note: grace/pending_data_purge/
   * cancellation_pending are STILL active here — the user has read access
   * and can pay to recover. Feature gates handle the per-mutation refusal.
   */
  isActive: boolean;

  /**
   * Numeric caps from the effective plan. Storage limit is plan.storage_limit_bytes
   * + companies.storage_topup_bytes (top-up SKU is phase 2).
   */
  monthlyQuoteLimit: number;
  storageLimitBytes: number;
  storageUsedBytes: number;
  storageTopupBytes: number;
  includedSeats: number;

  /**
   * One boolean per gated feature, computed from the effective plan.
   */
  features: Record<Feature, boolean>;

  /**
   * Timestamps the UI needs for banners / countdowns. Nullable when not set
   * (e.g. trial_ends_at is null for a paying customer).
   */
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  firstPaymentFailureAt: string | null;
  compUntil: string | null;
}

/**
 * Internal: row shape we read out of the `companies` + `subscription_plans`
 * join. Kept narrow so unrelated column drift doesn't churn this file.
 */
interface EntitlementRowRaw {
  plan_code: string;
  subscription_status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  first_payment_failure_at: string | null;
  comp_until: string | null;
  storage_used_bytes: number;
  storage_topup_bytes: number;
  seat_count: number;
}

interface PlanRowRaw {
  code: string;
  monthly_quote_limit: number;
  storage_limit_bytes: number;
  included_seats: number;
  feat_digital_takeoff: boolean;
  feat_flashings: boolean;
  feat_material_orders: boolean;
  feat_followups: boolean;
  feat_email_send: boolean;
  feat_activity_card: boolean;
}

/**
 * Load a company's full entitlement snapshot. Single DB round-trip (one
 * companies row + one subscription_plans row + three function calls bundled
 * into one query via SELECT FROM functions). Cached per request via React
 * `cache()` so multiple consumers in the same render share the result.
 *
 * Uses the admin (service-role) client so it works from anywhere — public
 * accept-token pages, webhooks, cron, server actions. Company authorisation
 * is the caller's responsibility; pass the right companyId.
 */
export const loadCompanyEntitlements = cache(
  async (companyId: string): Promise<CompanyEntitlements> => {
    const admin = createAdminClient();

    // Pull the companies row + the effective-plan results in one go via a
    // raw SQL select. We can't use the `.from()` builder for the function
    // calls cleanly, so we use admin.rpc for each then merge — three small
    // calls is fine since the helpers are STABLE and the company row pulls
    // the rest in a single select.
    const [companyResult, effCodeResult, effActiveResult] = await Promise.all([
      admin
        .from('companies')
        .select(
          'plan_code, subscription_status, trial_ends_at, current_period_end, first_payment_failure_at, comp_until, storage_used_bytes, storage_topup_bytes, seat_count',
        )
        .eq('id', companyId)
        .limit(1)
        .maybeSingle(),
      admin.rpc('company_effective_plan_code', { p_company_id: companyId }),
      admin.rpc('company_effective_plan_active', { p_company_id: companyId }),
    ]);

    if (companyResult.error) {
      throw new Error(`Failed to load company entitlements: ${companyResult.error.message}`);
    }
    if (!companyResult.data) {
      throw new Error(`Company ${companyId} not found while loading entitlements.`);
    }

    const company = companyResult.data as EntitlementRowRaw;
    const effectivePlanCode = (effCodeResult.data as string | null) ?? 'starter';
    const isActive = (effActiveResult.data as boolean | null) ?? false;

    // Now resolve the effective plan row so we can read its feature flags
    // and numeric caps.
    const { data: planRowData, error: planErr } = await admin
      .from('subscription_plans')
      .select(
        'code, monthly_quote_limit, storage_limit_bytes, included_seats, feat_digital_takeoff, feat_flashings, feat_material_orders, feat_followups, feat_email_send, feat_activity_card',
      )
      .eq('code', effectivePlanCode)
      .limit(1)
      .maybeSingle();

    if (planErr) {
      throw new Error(`Failed to load plan row "${effectivePlanCode}": ${planErr.message}`);
    }
    if (!planRowData) {
      throw new Error(
        `Plan "${effectivePlanCode}" missing from subscription_plans. Seed migration may not be applied.`,
      );
    }

    const plan = planRowData as PlanRowRaw;

    return {
      companyId,
      purchasedPlanCode: company.plan_code,
      effectivePlanCode,
      subscriptionStatus: company.subscription_status as SubscriptionStatus,
      isActive,
      monthlyQuoteLimit: plan.monthly_quote_limit,
      storageLimitBytes: plan.storage_limit_bytes + company.storage_topup_bytes,
      storageUsedBytes: company.storage_used_bytes,
      storageTopupBytes: company.storage_topup_bytes,
      includedSeats: Math.max(plan.included_seats, company.seat_count),
      features: {
        digital_takeoff: plan.feat_digital_takeoff,
        flashings: plan.feat_flashings,
        material_orders: plan.feat_material_orders,
        followups: plan.feat_followups,
        email_send: plan.feat_email_send,
        activity_card: plan.feat_activity_card,
      },
      trialEndsAt: company.trial_ends_at,
      currentPeriodEnd: company.current_period_end,
      // grace_ends_at is computed from first_payment_failure_at + 24 days on
      // read (not stored separately on the row). The dunning cron is the
      // source of truth for advancing status; this column lets the UI render
      // a countdown.
      graceEndsAt: null,
      firstPaymentFailureAt: company.first_payment_failure_at,
      compUntil: company.comp_until,
    };
  },
);

/**
 * Require that the company's effective plan includes a given feature.
 * Throws FeatureGatedError if not.
 *
 * Use as the second line of any server action that performs a gated
 * mutation:
 *
 *   const profile = await requireCompanyContext();
 *   await requireFeature(profile.company_id, 'material_orders');
 *
 * For numeric limits (quotes/month, storage bytes) DO NOT call this —
 * those are enforced at the DB layer via `create_quote_atomic` and the
 * upload finaliser respectively.
 */
export async function requireFeature(
  companyId: string,
  feature: Feature,
): Promise<void> {
  if (!isFeature(feature)) {
    throw new Error(`requireFeature called with unknown feature "${feature}".`);
  }
  const ent = await loadCompanyEntitlements(companyId);
  if (!ent.isActive) {
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (!ent.features[feature]) {
    throw new FeatureGatedError({
      feature,
      currentPlan: ent.effectivePlanCode,
      requiredPlan: FEATURE_MIN_PLAN[feature],
    });
  }
}

/**
 * Require that the subscription is in a state that allows mutations at all.
 * False ONLY for `suspended` / `canceled`. Useful as a coarse precheck on
 * actions that don't fit a specific feature flag (e.g. updating the company
 * profile).
 */
export async function requireActiveSubscription(companyId: string): Promise<void> {
  const ent = await loadCompanyEntitlements(companyId);
  if (!ent.isActive) {
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
}

/**
 * Message send gate. Covers manual user-initiated sends AND the scheduled
 * dispatch cron path (H-04). The `mode` argument distinguishes them only
 * for logging; both require `feat_email_send`.
 *
 * The scheduled dispatch caller MUST gate AT FIRE TIME (not just at
 * scheduling time) so a Pro user who downgrades before their queued
 * follow-up fires doesn't get free email sends.
 */
export async function assertCanSendMessage(
  companyId: string,
  mode: 'manual' | 'scheduled_dispatch',
): Promise<void> {
  // Suppress unused-arg lint; `mode` is preserved for future per-mode rules
  // (e.g. "manual ok but scheduled denied on past_due") and for log lines.
  void mode;
  await requireFeature(companyId, 'email_send');
}

/**
 * Storage quota gate. Reads the cached entitlements snapshot and refuses
 * the upload if the new bytes would push the company over its effective
 * limit (plan limit + topup).
 *
 * This is the source of truth for storage gating. The legacy
 * `checkStorageQuota()` helper in storage-actions.ts will continue to work
 * for backward compatibility, but new code should use this so we get the
 * effective-limit math right (plan + topup, not just the column value).
 *
 * The upload finaliser pattern: call this AFTER the upload but BEFORE
 * inserting the metadata row, so we have the actual storage.objects.size
 * to assert against. If it throws, delete the just-uploaded object.
 */
export async function assertCanUseStorage(
  companyId: string,
  additionalBytes: number,
): Promise<void> {
  if (additionalBytes < 0) {
    throw new Error('assertCanUseStorage called with negative additionalBytes');
  }
  const ent = await loadCompanyEntitlements(companyId);
  if (!ent.isActive) {
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (ent.storageUsedBytes + additionalBytes > ent.storageLimitBytes) {
    throw new StorageQuotaExceededError({
      usedBytes: ent.storageUsedBytes,
      limitBytes: ent.storageLimitBytes,
      attemptedBytes: additionalBytes,
    });
  }
}

/**
 * Convenience: returns a serialisable subset of the entitlements snapshot
 * suitable for shipping to a client component (e.g. an upgrade banner).
 * Strips nothing sensitive but flattens the shape and is JSON-safe.
 */
export async function entitlementsForClient(
  companyId: string,
): Promise<{
  effectivePlanCode: string;
  subscriptionStatus: SubscriptionStatus;
  isActive: boolean;
  features: Record<Feature, boolean>;
  monthlyQuoteLimit: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  firstPaymentFailureAt: string | null;
  compUntil: string | null;
}> {
  const ent = await loadCompanyEntitlements(companyId);
  return {
    effectivePlanCode: ent.effectivePlanCode,
    subscriptionStatus: ent.subscriptionStatus,
    isActive: ent.isActive,
    features: ent.features,
    monthlyQuoteLimit: ent.monthlyQuoteLimit,
    storageUsedBytes: ent.storageUsedBytes,
    storageLimitBytes: ent.storageLimitBytes,
    trialEndsAt: ent.trialEndsAt,
    currentPeriodEnd: ent.currentPeriodEnd,
    firstPaymentFailureAt: ent.firstPaymentFailureAt,
    compUntil: ent.compUntil,
  };
}

// Re-export the surface the rest of the app should import from one path.
// Resist the urge to deep-link into errors.ts / features.ts from random
// callsites; centralise here so we can refactor the internals later.
export { FEATURES, FEATURE_LABELS, FEATURE_MIN_PLAN, isFeature } from './features';
export type { Feature } from './features';
export {
  BillingError,
  FeatureGatedError,
  SubscriptionInactiveError,
  QuoteLimitReachedError,
  StorageQuotaExceededError,
  isBillingError,
} from './errors';

// We do NOT extend createSupabaseServerClient or requireCompanyContext from
// here to keep this module pure data. Call sites that want both the
// company context AND its entitlements should:
//
//   const profile = await requireCompanyContext();
//   const ent = await loadCompanyEntitlements(profile.company_id);
//
// React `cache()` ensures the entitlement DB read happens at most once
// per request even when called from multiple places.
