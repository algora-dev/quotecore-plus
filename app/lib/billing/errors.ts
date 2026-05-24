/**
 * Typed errors for the billing/entitlements layer.
 *
 * Server actions catch these and return structured `{ ok: false, code, ... }`
 * payloads so the UI can render upgrade prompts inline instead of parsing
 * error message strings. Keep the shape stable; UI code pattern-matches on
 * `code`.
 *
 * All three errors extend BillingError so a callsite that doesn't want to
 * distinguish them can `catch (err) { if (err instanceof BillingError) ... }`.
 */

import type { Feature } from './features';

export class BillingError extends Error {
  /**
   * Stable machine-readable code. UI pattern-matches on this; do not change
   * existing codes without a coordinated UI update.
   */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    // Preserve stack trace on V8.
    if (typeof (Error as unknown as { captureStackTrace?: unknown }).captureStackTrace === 'function') {
      (Error as unknown as { captureStackTrace: (target: object, ctor: Function) => void })
        .captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when a server action is asked to perform an operation gated behind
 * a feature flag the company's effective plan doesn't include.
 *
 * Example: a Starter company tries to create a material order. The action
 * calls `await requireFeature(companyId, 'material_orders')` which throws
 * this error. The action's try/catch returns
 * `{ ok: false, code: 'feature_gated', feature, currentPlan, requiredPlan }`
 * to the client. The UI shows "Material orders requires Professional or
 * higher. Upgrade here."
 */
export class FeatureGatedError extends BillingError {
  readonly feature: Feature;
  readonly currentPlan: string;
  /**
   * The cheapest plan that includes the feature. Computed by looking up the
   * feature column in `subscription_plans` ordered by `sort_order`. Used to
   * tailor the upgrade copy.
   */
  readonly requiredPlan: string;

  constructor(args: { feature: Feature; currentPlan: string; requiredPlan: string }) {
    super(
      'feature_gated',
      `Feature "${args.feature}" not included in plan "${args.currentPlan}" (requires "${args.requiredPlan}" or higher).`,
    );
    this.feature = args.feature;
    this.currentPlan = args.currentPlan;
    this.requiredPlan = args.requiredPlan;
  }
}

/**
 * Thrown when the company's subscription is not in an active or recoverable
 * state. Maps to the day-75 `suspended` / `canceled` lifecycle states.
 *
 * NOT thrown for trial / past_due / grace / pending_data_purge - those keep
 * read access and limited mutation. Use `FeatureGatedError` for those gates.
 */
export class SubscriptionInactiveError extends BillingError {
  readonly currentStatus: string;

  constructor(currentStatus: string) {
    super(
      'subscription_inactive',
      `Subscription is "${currentStatus}". Reactivate to use this feature.`,
    );
    this.currentStatus = currentStatus;
  }
}

/**
 * Thrown when the company has hit its monthly quote limit. Raised by
 * `create_quote_atomic` (Postgres P0002) and re-raised in the entitlements
 * layer with the parsed used/limit/period details.
 */
export class QuoteLimitReachedError extends BillingError {
  readonly used: number;
  readonly limit: number;
  readonly periodStart: string; // ISO date (first of the month UTC)
  readonly planCode: string;

  constructor(args: { used: number; limit: number; periodStart: string; planCode: string }) {
    super(
      'quote_limit_reached',
      `Monthly quote limit reached for plan "${args.planCode}": used ${args.used} of ${args.limit} this period.`,
    );
    this.used = args.used;
    this.limit = args.limit;
    this.periodStart = args.periodStart;
    this.planCode = args.planCode;
  }
}

/**
 * Thrown when the company has hit its lifetime component-library cap.
 * Raised by `require_component_slot` (Postgres P0010).
 */
export class ComponentLimitReachedError extends BillingError {
  readonly used: number;
  readonly limit: number;
  readonly planCode: string;

  constructor(args: { used: number; limit: number; planCode: string }) {
    super(
      'component_limit_reached',
      `Component library cap reached for plan "${args.planCode}": ${args.used} of ${args.limit} components used.`,
    );
    this.used = args.used;
    this.limit = args.limit;
    this.planCode = args.planCode;
  }
}

/**
 * Thrown when the company has hit its lifetime flashing-library cap.
 * Raised by `require_flashing_slot` (Postgres P0011).
 */
export class FlashingLimitReachedError extends BillingError {
  readonly used: number;
  readonly limit: number;
  readonly planCode: string;

  constructor(args: { used: number; limit: number; planCode: string }) {
    super(
      'flashing_limit_reached',
      `Flashing library cap reached for plan "${args.planCode}": ${args.used} of ${args.limit} flashings used.`,
    );
    this.used = args.used;
    this.limit = args.limit;
    this.planCode = args.planCode;
  }
}

/**
 * Thrown when a storage upload would exceed the company's effective storage
 * limit (plan limit + topups - currently used). The upload finaliser catches
 * this and removes the just-uploaded object so we don't leak bytes.
 */
export class StorageQuotaExceededError extends BillingError {
  readonly usedBytes: number;
  readonly limitBytes: number;
  readonly attemptedBytes: number;

  constructor(args: { usedBytes: number; limitBytes: number; attemptedBytes: number }) {
    super(
      'storage_quota_exceeded',
      `Storage quota exceeded: ${args.usedBytes + args.attemptedBytes} bytes would exceed limit of ${args.limitBytes} bytes.`,
    );
    this.usedBytes = args.usedBytes;
    this.limitBytes = args.limitBytes;
    this.attemptedBytes = args.attemptedBytes;
  }
}

/**
 * Defensive helper: narrow an unknown error to one of our billing errors.
 * Useful inside server-action catch blocks for type-safe pattern matching.
 */
export function isBillingError(err: unknown): err is BillingError {
  return err instanceof BillingError;
}
