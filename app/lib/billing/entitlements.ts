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

import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  FEATURE_MIN_PLAN,
  isFeature,
  type Feature,
} from './features';
import {
  AttachmentLimitReachedError,
  CatalogLimitReachedError,
  ComponentLimitReachedError,
  FeatureGatedError,
  FlashingLimitReachedError,
  InvoiceLimitReachedError,
  OrderLimitReachedError,
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
   * cancellation_pending are STILL active here - the user has read access
   * and can pay to recover. Feature gates handle the per-mutation refusal.
   */
  isActive: boolean;

  /**
   * Numeric caps from the effective plan. Storage limit is plan.storage_limit_bytes
   * + companies.storage_topup_bytes (top-up SKU is phase 2).
   */
  monthlyQuoteLimit: number;
  /**
   * Quotes created so far in the current calendar month (UTC). Counts BOTH
   * drafts and finalised quotes - `create_quote_atomic` doesn't distinguish.
   * Resets implicitly on the first of the month when the cron rolls the row.
   */
  monthlyQuoteUsed: number;
  /**
   * Lifetime cap on active component_library rows. NULL = unlimited.
   */
  componentLimit: number | null;
  componentCount: number;
  /**
   * Lifetime cap on flashing_library rows. NULL = unlimited.
   */
  flashingLimit: number | null;
  flashingCount: number;
  /**
   * Active-catalog cap. NULL = unlimited. Archived catalogs excluded from count.
   */
  catalogLimit: number | null;
  catalogCount: number;
  /**
   * Active (non-archived) company-attachment cap. NULL = unlimited.
   */
  attachmentLimit: number | null;
  attachmentCount: number;
  /**
   * Per-calendar-month invoice cap. NULL = unlimited. invoiceCount is the
   * number created so far this UTC month (cancelled excluded).
   */
  invoiceLimit: number | null;
  invoiceCount: number;
  /**
   * Per-calendar-month material-order cap. NULL = unlimited. orderCount is
   * the number created so far this UTC month.
   */
  orderLimit: number | null;
  orderCount: number;
  /**
   * Per-calendar-month AI assistant token budget. NULL = unlimited. Read by
   * costGuard per effective plan.
   */
  monthlyAiTokens: number | null;
  storageLimitBytes: number;
  storageUsedBytes: number;
  storageTopupBytes: number;
  /**
   * True when storage_used_bytes exceeds the effective limit (plan + topup).
   * The company is "red": all FILE uploads are blocked (catalog/attachment/
   * quote files/logos) until they free space or upgrade. Non-file actions
   * (quotes, components, drawings) are governed by their own quotas and are
   * NOT affected. Set by Shaun's option-3 catalog-import policy + general
   * over-quota state. storageLimitBytes already includes topup.
   */
  isOverStorage: boolean;
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

  /**
   * True when an admin has manually paused the company. Access is fully
   * locked (read AND write). Separate from subscription_status / dunning.
   */
  adminPaused: boolean;

  /**
   * Plan code an admin has assigned as an override. Active when non-null
   * AND adminOverrideUntil > now(). The effective-plan SQL function
   * returns this over plan_code when active.
   */
  adminOverridePlanCode: string | null;

  /**
   * When the admin override expires. Nullable; the SQL function checks
   * admin_override_until > now().
   */
  adminOverrideUntil: string | null;
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
  admin_paused: boolean;
  admin_override_plan_code: string | null;
  admin_override_until: string | null;
}

interface PlanRowRaw {
  code: string;
  monthly_quote_limit: number;
  storage_limit_bytes: number;
  included_seats: number;
  component_limit: number | null;
  flashing_limit: number | null;
  catalog_limit: number | null;
  attachment_limit: number | null;
  monthly_invoice_limit: number | null;
  monthly_material_order_limit: number | null;
  monthly_ai_tokens: number | null;
  feat_digital_takeoff: boolean;
  feat_flashings: boolean;
  feat_material_orders: boolean;
  feat_followups: boolean;
  feat_email_send: boolean;
  feat_activity_card: boolean;
  feat_catalogs: boolean;
  feat_attachment_library: boolean;
  feat_invoices: boolean;
  feat_message_center: boolean;
}

/**
 * Load a company's full entitlement snapshot. Single DB round-trip (one
 * companies row + one subscription_plans row + three function calls bundled
 * into one query via SELECT FROM functions). Cached per request via React
 * `cache()` so multiple consumers in the same render share the result.
 *
 * Uses the admin (service-role) client so it works from anywhere - public
 * accept-token pages, webhooks, cron, server actions. Company authorisation
 * is the caller's responsibility; pass the right companyId.
 */
export const loadCompanyEntitlements = cache(
  async (companyId: string): Promise<CompanyEntitlements> => {
    const admin = createAdminClient();

    // Pull the companies row + the effective-plan results in one go via a
    // raw SQL select. We can't use the `.from()` builder for the function
    // calls cleanly, so we use admin.rpc for each then merge - three small
    // calls is fine since the helpers are STABLE and the company row pulls
    // the rest in a single select.
    const periodStart = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      1,
    )).toISOString().slice(0, 10); // YYYY-MM-DD

    const [
      companyResult,
      effCodeResult,
      effActiveResult,
      compCountResult,
      flashCountResult,
      catalogCountResult,
      attachmentCountResult,
      invoiceCountResult,
      orderCountResult,
      usageResult,
    ] = await Promise.all([
      admin
        .from('companies')
        .select(
          'plan_code, subscription_status, trial_ends_at, current_period_end, first_payment_failure_at, comp_until, storage_used_bytes, storage_topup_bytes, seat_count, admin_paused, admin_override_plan_code, admin_override_until',
        )
        .eq('id', companyId)
        .limit(1)
        .maybeSingle(),
      admin.rpc('company_effective_plan_code', { p_company_id: companyId }),
      admin.rpc('company_effective_plan_active', { p_company_id: companyId }),
      admin.rpc('company_component_count', { p_company_id: companyId }),
      admin.rpc('company_flashing_count',  { p_company_id: companyId }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).rpc('company_catalog_count', { p_company_id: companyId }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).rpc('company_attachment_count', { p_company_id: companyId }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).rpc('company_invoice_count', { p_company_id: companyId }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).rpc('company_order_count', { p_company_id: companyId }),
      admin
        .from('company_quote_usage')
        .select('quotes_created')
        .eq('company_id', companyId)
        .eq('period_start', periodStart)
        .maybeSingle(),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: planRowData, error: planErr } = await (admin as any)
      .from('subscription_plans')
      .select(
        'code, monthly_quote_limit, storage_limit_bytes, included_seats, component_limit, flashing_limit, catalog_limit, attachment_limit, monthly_invoice_limit, monthly_material_order_limit, monthly_ai_tokens, feat_digital_takeoff, feat_flashings, feat_material_orders, feat_followups, feat_email_send, feat_activity_card, feat_catalogs, feat_attachment_library, feat_invoices, feat_message_center',
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
      monthlyQuoteUsed: (usageResult.data?.quotes_created as number | undefined) ?? 0,
      componentLimit: plan.component_limit,
      componentCount: (compCountResult.data as number | null) ?? 0,
      flashingLimit:  plan.flashing_limit,
      flashingCount:  (flashCountResult.data as number | null) ?? 0,
      catalogLimit:   plan.catalog_limit,
      catalogCount:   (catalogCountResult.data as number | null) ?? 0,
      attachmentLimit: plan.attachment_limit,
      attachmentCount: (attachmentCountResult.data as number | null) ?? 0,
      invoiceLimit: plan.monthly_invoice_limit,
      invoiceCount: (invoiceCountResult.data as number | null) ?? 0,
      orderLimit: plan.monthly_material_order_limit,
      orderCount: (orderCountResult.data as number | null) ?? 0,
      monthlyAiTokens: plan.monthly_ai_tokens,
      storageLimitBytes: plan.storage_limit_bytes + company.storage_topup_bytes,
      storageUsedBytes: company.storage_used_bytes,
      storageTopupBytes: company.storage_topup_bytes,
      isOverStorage:
        company.storage_used_bytes > plan.storage_limit_bytes + company.storage_topup_bytes,
      includedSeats: Math.max(plan.included_seats, company.seat_count),
      features: {
        digital_takeoff: plan.feat_digital_takeoff,
        flashings: plan.feat_flashings,
        material_orders: plan.feat_material_orders,
        followups: plan.feat_followups,
        email_send: plan.feat_email_send,
        activity_card: plan.feat_activity_card,
        catalogs: plan.feat_catalogs,
        attachment_library: plan.feat_attachment_library,
        invoices: plan.feat_invoices,
        message_center: plan.feat_message_center,
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
      adminPaused: company.admin_paused,
      adminOverridePlanCode: company.admin_override_plan_code,
      adminOverrideUntil: company.admin_override_until,
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
 * For numeric limits (quotes/month, storage bytes) DO NOT call this -
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
  monthlyQuoteUsed: number;
  componentLimit: number | null;
  componentCount: number;
  flashingLimit: number | null;
  flashingCount: number;
  catalogLimit: number | null;
  catalogCount: number;
  invoiceLimit: number | null;
  invoiceCount: number;
  orderLimit: number | null;
  orderCount: number;
  monthlyAiTokens: number | null;
  storageUsedBytes: number;
  storageLimitBytes: number;
  isOverStorage: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  firstPaymentFailureAt: string | null;
  compUntil: string | null;
  adminPaused: boolean;
  adminOverridePlanCode: string | null;
  adminOverrideUntil: string | null;
}> {
  const ent = await loadCompanyEntitlements(companyId);
  return {
    effectivePlanCode: ent.effectivePlanCode,
    subscriptionStatus: ent.subscriptionStatus,
    isActive: ent.isActive,
    features: ent.features,
    monthlyQuoteLimit: ent.monthlyQuoteLimit,
    monthlyQuoteUsed: ent.monthlyQuoteUsed,
    componentLimit: ent.componentLimit,
    componentCount: ent.componentCount,
    flashingLimit: ent.flashingLimit,
    flashingCount: ent.flashingCount,
    catalogLimit: ent.catalogLimit,
    catalogCount: ent.catalogCount,
    invoiceLimit: ent.invoiceLimit,
    invoiceCount: ent.invoiceCount,
    orderLimit: ent.orderLimit,
    orderCount: ent.orderCount,
    monthlyAiTokens: ent.monthlyAiTokens,
    storageUsedBytes: ent.storageUsedBytes,
    storageLimitBytes: ent.storageLimitBytes,
    isOverStorage: ent.isOverStorage,
    trialEndsAt: ent.trialEndsAt,
    currentPeriodEnd: ent.currentPeriodEnd,
    firstPaymentFailureAt: ent.firstPaymentFailureAt,
    compUntil: ent.compUntil,
    adminPaused: ent.adminPaused,
    adminOverridePlanCode: ent.adminOverridePlanCode,
    adminOverrideUntil: ent.adminOverrideUntil,
  };
}

/**
 * Acquire one component-library slot for the given company. Wraps the SQL
 * function `require_component_slot` so the calling server action gets a
 * typed error instead of a raw Postgres exception.
 *
 * The SQL function does the actual count + cap check. We translate its
 * SQLSTATE into one of our domain errors so the UI can pattern-match.
 *
 * NOTE: this DOES NOT take an advisory lock. Two concurrent creates can
 * race the check; the small overshoot window is acceptable for now since
 * component creation is a low-frequency interactive action. Add a lock if
 * we ever see overshoot in practice.
 */
export async function requireComponentSlot(companyId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('require_component_slot', { p_company_id: companyId });
  if (!error) return;
  // PostgREST surfaces RAISE EXCEPTION SQLSTATE as error.code.
  const code = (error as { code?: string }).code;
  if (code === 'P0001') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (code === 'P0010') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new ComponentLimitReachedError({
      used:     ent.componentCount,
      limit:    ent.componentLimit ?? 0,
      planCode: ent.effectivePlanCode,
    });
  }
  throw new Error(`require_component_slot failed: ${error.message}`);
}

/**
 * Acquire one flashing-library slot for the given company. Wraps
 * `require_flashing_slot`. Throws FeatureGatedError if the plan doesn't
 * include flashings at all, otherwise FlashingLimitReachedError on cap.
 */
/**
 * Acquire one catalog slot for the given company. Wraps
 * `require_catalog_slot`. Throws FeatureGatedError if the plan doesn't
 * include catalogs at all, or CatalogLimitReachedError on cap.
 */
export async function requireCatalogSlot(companyId: string): Promise<void> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc('require_catalog_slot', { p_company_id: companyId });
  if (!error) return;
  const code = (error as { code?: string }).code;
  if (code === 'P0001') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (code === 'P0013') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new CatalogLimitReachedError({
      used:     ent.catalogCount,
      limit:    ent.catalogLimit ?? 0,
      planCode: ent.effectivePlanCode,
    });
  }
  if (code === 'P0012') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new FeatureGatedError({
      feature: 'catalogs',
      currentPlan: ent.effectivePlanCode,
      requiredPlan: FEATURE_MIN_PLAN.catalogs,
    });
  }
  throw new Error(`require_catalog_slot failed: ${error.message}`);
}

/**
 * Acquire one attachment-library slot for the given company. Wraps
 * `require_attachment_slot`. Throws FeatureGatedError if the plan doesn't
 * include the attachment library at all, or AttachmentLimitReachedError on cap.
 */
export async function requireAttachmentSlot(companyId: string): Promise<void> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc('require_attachment_slot', { p_company_id: companyId });
  if (!error) return;
  const code = (error as { code?: string }).code;
  if (code === 'P0001') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (code === 'P0014') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new AttachmentLimitReachedError({
      used:     ent.attachmentCount,
      limit:    ent.attachmentLimit ?? 0,
      planCode: ent.effectivePlanCode,
    });
  }
  if (code === 'P0012') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new FeatureGatedError({
      feature: 'attachment_library',
      currentPlan: ent.effectivePlanCode,
      requiredPlan: FEATURE_MIN_PLAN.attachment_library,
    });
  }
  throw new Error(`require_attachment_slot failed: ${error.message}`);
}

export async function requireFlashingSlot(companyId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('require_flashing_slot', { p_company_id: companyId });
  if (!error) return;
  const code = (error as { code?: string }).code;
  if (code === 'P0001') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (code === 'P0011') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new FlashingLimitReachedError({
      used:     ent.flashingCount,
      limit:    ent.flashingLimit ?? 0,
      planCode: ent.effectivePlanCode,
    });
  }
  if (code === 'P0012') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new FeatureGatedError({
      feature: 'flashings',
      currentPlan: ent.effectivePlanCode,
      requiredPlan: FEATURE_MIN_PLAN.flashings,
    });
  }
  throw new Error(`require_flashing_slot failed: ${error.message}`);
}

/**
 * Acquire one invoice slot for the current calendar month. Wraps
 * `require_invoice_slot`. Throws FeatureGatedError if the plan doesn't
 * include invoices at all (P0012), or InvoiceLimitReachedError on the
 * monthly cap (P0015). Call immediately before the invoice INSERT.
 */
export async function requireInvoiceSlot(companyId: string): Promise<void> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc('require_invoice_slot', { p_company_id: companyId });
  if (!error) return;
  const code = (error as { code?: string }).code;
  if (code === 'P0001') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (code === 'P0015') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new InvoiceLimitReachedError({
      used:     ent.invoiceCount,
      limit:    ent.invoiceLimit ?? 0,
      planCode: ent.effectivePlanCode,
    });
  }
  if (code === 'P0012') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new FeatureGatedError({
      feature: 'invoices',
      currentPlan: ent.effectivePlanCode,
      requiredPlan: FEATURE_MIN_PLAN.invoices,
    });
  }
  throw new Error(`require_invoice_slot failed: ${error.message}`);
}

/**
 * Atomic invoice creation (H-03). Calls the `create_invoice_atomic` RPC which
 * takes a per-company advisory lock, runs the active/feature/monthly-cap
 * checks AND inserts the invoices row in ONE transaction - closing the
 * count-then-insert race that `requireInvoiceSlot` + a separate INSERT left
 * open.
 *
 * Maps the RPC's SQLSTATEs to the same typed billing errors the UI already
 * pattern-matches (identical to requireInvoiceSlot):
 *   P0001 -> SubscriptionInactiveError
 *   P0012 -> FeatureGatedError(invoices)
 *   P0015 -> InvoiceLimitReachedError
 *
 * Returns the new invoice id. Callers do line imports + activity logging
 * AFTER this resolves (those are not cap-sensitive).
 */
export async function createInvoiceAtomic(
  companyId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('create_invoice_atomic', {
    p_company_id: companyId,
    p_user_id: userId,
    p_payload: payload,
  });
  if (!error) {
    if (!data) throw new Error('create_invoice_atomic returned no id');
    return data as string;
  }
  const code = (error as { code?: string }).code;
  if (code === 'P0001') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (code === 'P0015') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new InvoiceLimitReachedError({
      used:     ent.invoiceCount,
      limit:    ent.invoiceLimit ?? 0,
      planCode: ent.effectivePlanCode,
    });
  }
  if (code === 'P0012') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new FeatureGatedError({
      feature: 'invoices',
      currentPlan: ent.effectivePlanCode,
      requiredPlan: FEATURE_MIN_PLAN.invoices,
    });
  }
  throw new Error(`create_invoice_atomic failed: ${error.message}`);
}

/**
 * Central gate for MUTATIONS on EXISTING invoices (H-02).
 *
 * Invoice CREATION is gated by `requireInvoiceSlot` (feature + monthly cap).
 * But every mutation on an already-created invoice (edit lines/meta, reset,
 * mark-paid, change status, save payment details, mark-sent-by-link) and
 * invoice-template create/update previously had NO feature gate - only an
 * ownership (company_id) check. That let a company that dropped to Free
 * (incl. expired-trial) keep fully operating a paid feature on its existing
 * invoices indefinitely.
 *
 * This throws the same typed `FeatureGatedError` / `SubscriptionInactiveError`
 * the UI already pattern-matches into an upgrade prompt. Use as the gate on
 * every value-extracting invoice mutation.
 *
 * NOT gated by this (intentional wind-down / read paths): listing, viewing,
 * PDF export, cancel, draft-delete, and resolving a customer dispute - those
 * only let a downgraded user read history and wind down cleanly.
 */
export async function requireInvoiceFeature(companyId: string): Promise<void> {
  await requireFeature(companyId, 'invoices');
}

/**
 * Acquire one material-order slot for the current calendar month. Wraps
 * `require_order_slot`. Throws FeatureGatedError if the plan doesn't
 * include material orders (P0012), or OrderLimitReachedError on the
 * monthly cap (P0016). Call immediately before the material_orders INSERT.
 */
export async function requireOrderSlot(companyId: string): Promise<void> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc('require_order_slot', { p_company_id: companyId });
  if (!error) return;
  const code = (error as { code?: string }).code;
  if (code === 'P0001') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new SubscriptionInactiveError(ent.subscriptionStatus);
  }
  if (code === 'P0016') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new OrderLimitReachedError({
      used:     ent.orderCount,
      limit:    ent.orderLimit ?? 0,
      planCode: ent.effectivePlanCode,
    });
  }
  if (code === 'P0012') {
    const ent = await loadCompanyEntitlements(companyId);
    throw new FeatureGatedError({
      feature: 'material_orders',
      currentPlan: ent.effectivePlanCode,
      requiredPlan: FEATURE_MIN_PLAN.material_orders,
    });
  }
  throw new Error(`require_order_slot failed: ${error.message}`);
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
  ComponentLimitReachedError,
  FlashingLimitReachedError,
  CatalogLimitReachedError,
  AttachmentLimitReachedError,
  InvoiceLimitReachedError,
  OrderLimitReachedError,
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
