'use client';

/**
 * Billing tab - tier picker with View modals.
 *
 * Three jobs:
 *   1. Show the company's current plan + status + key dates (trial end,
 *      next period end, payment-failure timer).
 *   2. Render a card for every selectable plan. Trial is included and
 *      activates via a non-Stripe server action; Stripe plans go through
 *      Checkout. Coming-soon plans render as greyed-out cards.
 *   3. Provide a "View" modal per plan with the full feature breakdown.
 *      The modal has two buttons: Close + Purchase (which kicks off the
 *      same flow as the card's primary button).
 */

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  createCheckoutSession,
  createCustomerPortalSession,
  changePlan,
  activateTrial,
  type BillingActionResult,
} from './actions';

export interface BillingPlanInfo {
  code: string;
  displayName: string;
  /** Tier ordering. Higher = more expensive tier; drives upgrade/downgrade
   *  direction in the in-app plan switch. */
  sortOrder: number;
  priceCentsMonthly: number;
  /**
   * Original (pre-discount) monthly price in cents. Renders as a
   * strikethrough next to the live price when set and strictly greater
   * than priceCentsMonthly. NULL = no strikethrough.
   */
  priceCentsMonthlyOriginal: number | null;
  monthlyQuoteLimit: number;
  storageLimitBytes: number;
  componentLimit: number | null;
  flashingLimit: number | null;
  monthlyMaterialOrderLimit: number | null;
  includedSeats: number;
  features: {
    digital_takeoff: boolean;
    flashings: boolean;
    material_orders: boolean;
    followups: boolean;
    email_send: boolean;
    activity_card: boolean;
  };
  tagline: string | null;
  featureBlurbs: string[];
  /**
   * Coming-soon tiers render as greyed-out cards. View modal still works
   * but the primary action button is disabled.
   */
  comingSoon: boolean;
  /**
   * Stripe price configured for this environment. False for the trial
   * tier (non-Stripe) and for tiers we haven't seeded yet. Drives the
   * "Choose plan" button enabled state.
   */
  hasStripePrice: boolean;
  /**
   * True for the trial tier specifically. The card activates it via
   * `activateTrial()` instead of Stripe checkout.
   */
  isTrial: boolean;
}

export interface BillingPanelProps {
  /** Current effective plan (could differ from purchased during dunning). */
  effectivePlanCode: string;
  /** What the user purchased (drives portal eligibility). */
  purchasedPlanCode: string;
  /** Subscription lifecycle state. */
  subscriptionStatus: string;
  /** Whether the company already has a Stripe customer record. */
  hasStripeCustomer: boolean;
  /** Whether the company has an ACTIVE Stripe subscription (drives trial-activate gating). */
  hasActiveSubscription: boolean;
  /** Trial end timestamp (ISO) if applicable. */
  trialEndsAt: string | null;
  /** Current period end (ISO) when subscription is active. */
  currentPeriodEnd: string | null;
  /**
   * True when the user has scheduled cancellation at period end via the
   * Stripe portal. Combined with `cancelAt` to render the “Cancelled -
   * ending {date}” secondary pill on the current-plan card.
   */
  cancelAtPeriodEnd: boolean;
  /**
   * Explicit cancellation timestamp (ISO). Falls back to currentPeriodEnd
   * when cancelAtPeriodEnd is true.
   */
  cancelAt: string | null;
  /** First payment failure (ISO) - drives the past_due banner. */
  firstPaymentFailureAt: string | null;
  /** Storage usage. */
  storageUsedBytes: number;
  storageLimitBytes: number;
  /** All available plans (including trial + coming-soon). */
  plans: BillingPlanInfo[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
}

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(0)}/mo`;
}

/**
 * Optional strikethrough "before" price. Returns null when there's no
 * meaningful discount to render. Centralised so the card and modal stay
 * in sync on the threshold logic.
 */
function formatOriginalPrice(
  original: number | null,
  current: number,
): string | null {
  if (original === null) return null;
  if (original <= current) return null;
  return `$${(original / 100).toFixed(0)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Tri-state trial countdown.
 *   - `null` - not on a trial / no trial timestamp.
 *   - `{ state: 'ending-today', hoursLeft }` - trial ends within 24 hours.
 *   - `{ state: 'active', daysLeft }` - trial still has N>=1 days left.
 *   - `{ state: 'expired' }` - trial_ends_at is in the past.
 *
 * Replaces the old `trialDaysLeft` which clamped both “last day” and
 * “expired” at 0, conflating two very different UX states (smoke #1).
 */
type TrialState =
  | { state: 'active'; daysLeft: number }
  | { state: 'ending-today'; hoursLeft: number }
  | { state: 'expired' };

function trialState(trialEndsAt: string | null): TrialState | null {
  if (!trialEndsAt) return null;
  const ends = new Date(trialEndsAt).getTime();
  const now = Date.now();
  const diffMs = ends - now;
  if (diffMs <= 0) return { state: 'expired' };
  const hoursLeft = diffMs / (60 * 60 * 1000);
  if (hoursLeft <= 24) {
    return { state: 'ending-today', hoursLeft: Math.max(1, Math.ceil(hoursLeft)) };
  }
  // Round UP so a sub at 13.5 days reads as “14 days”, matching the
  // marketing promise and the user's mental model.
  const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return { state: 'active', daysLeft };
}

/**
 * Format a numeric cap with NULL = "Unlimited" and 0 = "-". Used inside
 * the View modal for component / flashing / order caps.
 */
function formatCap(value: number | null, suffix = ''): string {
  if (value === null) return 'Unlimited';
  if (value === 0) return '-';
  return `${value}${suffix}`;
}

export function BillingPanel(props: BillingPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewPlan, setViewPlan] = useState<BillingPlanInfo | null>(null);

  const checkoutFlag = searchParams.get('checkout');
  const trialFlag = searchParams.get('trial');
  const changeFlag = searchParams.get('change');

  function handleResult(result: BillingActionResult) {
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    setError(result.message);
  }

  /**
   * Single dispatch point for plan-card and modal-Purchase buttons. Routes
   * trial -> activateTrial, paid -> Stripe checkout.
   */
  function onChoose(plan: BillingPlanInfo) {
    if (plan.comingSoon) return;

    setError(null);
    setActivePlan(plan.code);
    startTransition(async () => {
      const result = plan.isTrial
        ? await activateTrial()
        : await createCheckoutSession(plan.code);
      handleResult(result);
      setActivePlan(null);
      setViewPlan(null);
    });
  }

  function onManage() {
    setError(null);
    startTransition(async () => {
      const result = await createCustomerPortalSession();
      handleResult(result);
    });
  }

  function dismissBanner() {
    const params = new URLSearchParams(searchParams);
    params.delete('checkout');
    params.delete('session_id');
    params.delete('trial');
    params.delete('change');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  // Esc closes the View modal.
  useEffect(() => {
    if (!viewPlan) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewPlan(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewPlan]);

  // ---- Status badge ----
  const statusBadgeClass: Record<string, string> = {
    trialing: 'bg-blue-100 text-blue-700',
    active: 'bg-emerald-100 text-emerald-700',
    past_due: 'bg-amber-100 text-amber-800',
    grace: 'bg-amber-100 text-amber-800',
    pending_data_purge: 'bg-red-100 text-red-700',
    disputed: 'bg-purple-100 text-purple-700',
    cancellation_pending: 'bg-slate-100 text-slate-700',
    suspended: 'bg-red-100 text-red-700',
    canceled: 'bg-slate-200 text-slate-700',
  };
  const statusClass = statusBadgeClass[props.subscriptionStatus] || 'bg-slate-100 text-slate-700';

  // Pill label + colour (smoke #9, 2026-05-19). The raw
  // subscription_status is too internal for a user-facing pill:
  //   trialing + not expired → 'Trial Active' (blue)
  //   trialing + expired (no paid sub) → 'Expired' (red)
  //   anything else → humanised status name with default colour map
  // trialExpiredNoSub is computed a few lines below; for tidiness keep the
  // helper next to the badge map and recompute the predicate locally.
  const _trialForPill = trialState(props.trialEndsAt);
  const _isPillExpired =
    props.subscriptionStatus === 'trialing'
    && _trialForPill?.state === 'expired'
    && !props.hasStripeCustomer;
  const statusPillLabel: string =
    props.subscriptionStatus === 'trialing'
      ? _isPillExpired ? 'Expired' : 'Trial Active'
      : props.subscriptionStatus.replace(/_/g, ' ');
  const statusPillClass: string =
    props.subscriptionStatus === 'trialing'
      ? _isPillExpired ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
      : statusClass;

  const storagePct = props.storageLimitBytes
    ? Math.min(100, Math.round((props.storageUsedBytes / props.storageLimitBytes) * 100))
    : 0;

  const trial = trialState(props.trialEndsAt);
  const isOnTrial = props.subscriptionStatus === 'trialing' && trial !== null;
  // Distinguish “user is mid-trial right now” from “user was on a trial
  // and it expired without a paid sub”. The status flag stays 'trialing'
  // until the expire-trials cron flips it, but the user has effectively
  // dropped to starter-effective - and (post-2026-05-19 migration
  // 20260519120000) all writes are blocked too. We surface that as a hard
  // expired-trial state in the UI.
  const trialExpiredNoSub = isOnTrial && trial.state === 'expired' && !props.hasStripeCustomer;

  // “Cancelled - ending {date}” secondary pill. Renders alongside the
  // primary status pill when the user has scheduled cancellation at the
  // end of their current period via the Stripe Portal.
  const cancelDateIso = props.cancelAt ?? props.currentPeriodEnd;
  const showCancellingPill =
    (props.cancelAtPeriodEnd || (props.cancelAt && new Date(props.cancelAt).getTime() > Date.now()))
    && cancelDateIso !== null
    && props.subscriptionStatus !== 'canceled';

  // In-app plan change: the target plan the user has clicked to switch to
  // (active subscriber). Drives the confirm modal; null = closed.
  const [changeTarget, setChangeTarget] = useState<BillingPlanInfo | null>(null);

  // sort_order of the plan the user is CURRENTLY on, to label the switch as an
  // upgrade or a downgrade in the confirm modal.
  const currentSortOrder =
    props.plans.find((p) => p.code === props.purchasedPlanCode)?.sortOrder ?? null;
  const isUpgradeTarget =
    changeTarget && currentSortOrder != null
      ? changeTarget.sortOrder > currentSortOrder
      : true;

  function onConfirmChange(plan: BillingPlanInfo) {
    setError(null);
    setActivePlan(plan.code);
    startTransition(async () => {
      const result = await changePlan(plan.code);
      handleResult(result);
      setActivePlan(null);
      setChangeTarget(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Stripe / trial redirect banners */}
      {changeFlag === 'upgraded' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-900">Plan upgraded.</p>
            <p className="text-xs text-emerald-700 mt-1">
              Your new plan is active. The card on file is charged the prorated difference; your plan card updates within a few seconds once Stripe confirms.
            </p>
          </div>
          <button onClick={dismissBanner} className="text-xs text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {changeFlag === 'downgrade_scheduled' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Plan change scheduled.</p>
            <p className="text-xs text-blue-700 mt-1">
              You keep your current plan until the end of this billing period, then it switches automatically. No charge now.
            </p>
          </div>
          <button onClick={dismissBanner} className="text-xs text-blue-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {checkoutFlag === 'success' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-900">Subscription started.</p>
            <p className="text-xs text-emerald-700 mt-1">
              Your plan will update within a few seconds once Stripe confirms the payment.
            </p>
          </div>
          <button onClick={dismissBanner} className="text-xs text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {checkoutFlag === 'canceled' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Checkout canceled.</p>
            <p className="text-xs text-slate-600 mt-1">No changes were made to your subscription.</p>
          </div>
          <button onClick={dismissBanner} className="text-xs text-slate-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {trialFlag === 'activated' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Trial activated.</p>
            <p className="text-xs text-blue-700 mt-1">
              You have 14 days to try every feature. After that you can pick a paid plan to keep going.
            </p>
          </div>
          <button onClick={dismissBanner} className="text-xs text-blue-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Current plan</p>
            <h3 className="text-lg font-semibold text-slate-900 mt-1 capitalize">
              {trialExpiredNoSub
                ? 'Trial expired'
                : props.effectivePlanCode.replace(/_/g, ' ')}
              {!trialExpiredNoSub
                && props.effectivePlanCode !== props.purchasedPlanCode
                && props.subscriptionStatus !== 'trialing'
                && (
                  <span className="ml-2 text-sm font-normal text-amber-700">
                    (downgraded from {props.purchasedPlanCode.replace(/_/g, ' ')})
                  </span>
                )}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${statusPillClass}`}
              >
                {statusPillLabel}
              </span>
              {showCancellingPill && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
                  Cancelling - ending {formatDate(cancelDateIso)}
                </span>
              )}
            </div>
            {isOnTrial && trial.state === 'active' && (
              <p className="mt-2 text-sm text-blue-700 font-medium">
                {trial.daysLeft === 1
                  ? '1 day left on your trial.'
                  : `Trial ends in ${trial.daysLeft} days.`}
              </p>
            )}
            {isOnTrial && trial.state === 'ending-today' && (
              <p className="mt-2 text-sm text-amber-700 font-medium">
                Trial ends today - choose a plan now to keep your data and continue using QuoteCore+.
              </p>
            )}
            {trialExpiredNoSub && (
              <p className="mt-2 text-sm text-red-700 font-medium">
                Your trial has expired. Choose a plan now to keep your data and continue using QuoteCore+.
              </p>
            )}
          </div>
          {props.hasStripeCustomer && (
            <button
              type="button"
              onClick={onManage}
              disabled={pending}
              title="Cancel, swap plan, update card, or view invoices"
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Manage subscription
            </button>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {props.trialEndsAt && isOnTrial && (
            <div>
              <dt className="text-xs text-slate-500">Trial ends</dt>
              <dd className="font-medium text-slate-900">{formatDate(props.trialEndsAt)}</dd>
            </div>
          )}
          {props.currentPeriodEnd && (
            <div>
              <dt className="text-xs text-slate-500">Next billing</dt>
              <dd className="font-medium text-slate-900">{formatDate(props.currentPeriodEnd)}</dd>
            </div>
          )}
          {props.firstPaymentFailureAt && (
            <div>
              <dt className="text-xs text-slate-500">First payment failure</dt>
              <dd className="font-medium text-amber-800">{formatDate(props.firstPaymentFailureAt)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-slate-500">Storage</dt>
            <dd className="font-medium text-slate-900">
              {formatBytes(props.storageUsedBytes)} of {formatBytes(props.storageLimitBytes)}
            </dd>
            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${storagePct >= 90 ? 'bg-amber-500' : 'bg-orange-500'}`}
                style={{ width: `${storagePct}%` }}
              />
            </div>
          </div>
        </dl>
      </div>

      {/* Plan grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900">Plans</h3>
        <p className="text-sm text-slate-500 mt-1">
          Click a plan to learn more. Trial is non-paid and runs for 14 days.
        </p>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {props.plans.map((plan) => {
            const isCurrent = plan.code === props.purchasedPlanCode;
            const isActive = pending && activePlan === plan.code;
            // Plan-switch via Stripe Portal: when the user has an active
            // paid sub, a fresh Checkout would create a SECOND
            // subscription, which is wrong. Smoke #3 (2026-05-19): rather
            // than silently disabling the button, KEEP the button clickable
            // and open a modal pointing the user at Manage Subscription so
            // they understand the path. The H-02 server-side guard still
            // refuses a fresh Checkout call as defence-in-depth.
            const blockedByActiveSub = !plan.isTrial && props.hasActiveSubscription;

            const canChoose = !plan.comingSoon
              && !isCurrent
              && (plan.isTrial
                ? !props.hasActiveSubscription && !props.hasStripeCustomer
                : plan.hasStripePrice);

            // Trial-specific button copy + reason for disabled state.
            const buttonLabel = isActive
              ? 'Redirecting…'
              : plan.comingSoon
              ? 'Coming soon'
              : isCurrent
              ? 'Your current plan'
              : plan.isTrial
              ? props.hasStripeCustomer
                ? 'Trial unavailable'
                : 'Start 14-day trial'
              : blockedByActiveSub && plan.hasStripePrice
              ? `Switch to ${plan.displayName}`
              : plan.hasStripePrice
              ? `Choose ${plan.displayName}`
              : 'Not yet available';

            return (
              <li
                key={plan.code}
                className={`rounded-lg border p-4 flex flex-col justify-between ${
                  plan.comingSoon
                    ? 'border-slate-200 bg-slate-50'
                    : isCurrent
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold text-slate-900">{plan.displayName}</p>
                    {plan.comingSoon && (
                      <span className="text-[10px] uppercase tracking-wide bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">
                        Coming soon
                      </span>
                    )}
                    {isCurrent && !plan.comingSoon && (
                      <span className="text-[10px] uppercase tracking-wide bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mt-1 flex items-baseline gap-2">
                    <span>
                      {plan.isTrial ? 'Free' : plan.comingSoon ? '-' : formatPrice(plan.priceCentsMonthly)}
                    </span>
                    {!plan.isTrial && !plan.comingSoon && (() => {
                      const original = formatOriginalPrice(plan.priceCentsMonthlyOriginal, plan.priceCentsMonthly);
                      return original ? (
                        <span className="text-sm font-medium text-slate-400 line-through">
                          {original}
                        </span>
                      ) : null;
                    })()}
                  </p>
                  {plan.tagline && (
                    <p className="text-xs text-slate-500 mt-1 italic">{plan.tagline}</p>
                  )}
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    <li>
                      {plan.comingSoon
                        ? 'Higher caps + extra features'
                        : `${plan.monthlyQuoteLimit} quotes / month`}
                    </li>
                    <li>
                      {plan.comingSoon ? 'More storage' : `${formatBytes(plan.storageLimitBytes)} storage`}
                    </li>
                  </ul>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewPlan(plan)}
                    className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Active subscriber switching tiers -> in-app change flow
                      // (upgrade/downgrade via subscriptions.update), NOT the
                      // cancel-only Portal. Fresh subscribers -> Checkout.
                      if (blockedByActiveSub) {
                        setChangeTarget(plan);
                        return;
                      }
                      onChoose(plan);
                    }}
                    disabled={(!canChoose && !blockedByActiveSub) || pending}
                    title={
                      plan.isTrial && props.hasStripeCustomer
                        ? 'The free trial is only available to new accounts.'
                        : blockedByActiveSub
                        ? 'You already have an active subscription - click to manage.'
                        : plan.comingSoon
                        ? 'This tier is not available yet.'
                        : isCurrent
                        ? 'You are already on this plan.'
                        : !plan.hasStripePrice && !plan.isTrial
                        ? 'This plan is not yet configured in Stripe for this environment.'
                        : undefined
                    }
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                      plan.isTrial
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    {buttonLabel}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* In-app plan change confirm modal (upgrade now / downgrade at period end). */}
      {changeTarget && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setChangeTarget(null);
          }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 id="change-modal-title" className="text-lg font-semibold text-slate-900">
              {isUpgradeTarget ? 'Upgrade' : 'Switch'} to {changeTarget.displayName}?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              You&apos;ll move to{' '}
              <span className="font-medium text-slate-900">{changeTarget.displayName}</span> at{' '}
              <span className="font-medium text-slate-900">{formatPrice(changeTarget.priceCentsMonthly)}</span>
              {(() => {
                const original = formatOriginalPrice(
                  changeTarget.priceCentsMonthlyOriginal,
                  changeTarget.priceCentsMonthly,
                );
                return original ? <span className="text-slate-400 line-through ml-1">{original}</span> : null;
              })()}
              .
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {isUpgradeTarget
                ? 'The change takes effect immediately. We\u2019ll prorate the difference for the rest of your current billing period and charge your card on file.'
                : 'You keep your current plan until the end of this billing period, then it switches to the new plan automatically. No charge or credit now.'}
            </p>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setChangeTarget(null)}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirmChange(changeTarget)}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {pending
                  ? 'Working\u2026'
                  : isUpgradeTarget
                  ? `Upgrade to ${changeTarget.displayName}`
                  : `Switch to ${changeTarget.displayName}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Plan modal */}
      {viewPlan && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewPlan(null);
          }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id="plan-modal-title" className="text-lg font-semibold text-slate-900">
                  {viewPlan.displayName}
                </h3>
                {viewPlan.tagline && (
                  <p className="text-sm text-slate-500 mt-1">{viewPlan.tagline}</p>
                )}
                <p className="text-xl font-semibold text-slate-900 mt-3 flex items-baseline gap-2">
                  <span>
                    {viewPlan.isTrial
                      ? 'Free (14 days)'
                      : viewPlan.comingSoon
                      ? 'Pricing soon'
                      : formatPrice(viewPlan.priceCentsMonthly)}
                  </span>
                  {!viewPlan.isTrial && !viewPlan.comingSoon && (() => {
                    const original = formatOriginalPrice(viewPlan.priceCentsMonthlyOriginal, viewPlan.priceCentsMonthly);
                    return original ? (
                      <span className="text-base font-medium text-slate-400 line-through">
                        {original}
                      </span>
                    ) : null;
                  })()}
                </p>
              </div>
              {viewPlan.comingSoon && (
                <span className="text-[10px] uppercase tracking-wide bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                  Coming soon
                </span>
              )}
            </div>

            {/* Numeric caps grid */}
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm border-t border-slate-200 pt-4">
              <div>
                <dt className="text-xs text-slate-500">Quotes / month</dt>
                <dd className="font-semibold text-slate-900">
                  {viewPlan.comingSoon ? 'Higher' : viewPlan.monthlyQuoteLimit}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Storage</dt>
                <dd className="font-semibold text-slate-900">
                  {viewPlan.comingSoon ? 'More' : formatBytes(viewPlan.storageLimitBytes)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Components</dt>
                <dd className="font-semibold text-slate-900">{formatCap(viewPlan.componentLimit)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Flashings</dt>
                <dd className={`font-semibold ${viewPlan.features.flashings ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                  {viewPlan.features.flashings ? formatCap(viewPlan.flashingLimit) : 'Not included'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Material orders / mo</dt>
                <dd className={`font-semibold ${viewPlan.features.material_orders ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                  {viewPlan.features.material_orders ? formatCap(viewPlan.monthlyMaterialOrderLimit) : 'Not included'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Included seats</dt>
                <dd className="font-semibold text-slate-900">{viewPlan.includedSeats}</dd>
              </div>
            </dl>

            {/* Feature flags */}
            <ul className="mt-4 space-y-1.5 text-sm border-t border-slate-200 pt-4">
              <FeatureRow label="Digital takeoff" included={viewPlan.features.digital_takeoff} />
              <FeatureRow label="Flashing drawings" included={viewPlan.features.flashings} />
              <FeatureRow label="Material orders" included={viewPlan.features.material_orders} />
              <FeatureRow label="Automated follow-ups" included={viewPlan.features.followups} />
              <FeatureRow label="Send emails from QuoteCore+" included={viewPlan.features.email_send} />
              <FeatureRow label="Activity card on quotes" included={viewPlan.features.activity_card} />
            </ul>

            {/* Marketing blurbs */}
            {viewPlan.featureBlurbs.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600 border-t border-slate-200 pt-4">
                {viewPlan.featureBlurbs.map((blurb, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <svg className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{blurb}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setViewPlan(null)}
                className="px-4 py-2 text-sm font-medium rounded-full text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => onChoose(viewPlan)}
                disabled={
                  viewPlan.comingSoon
                  || viewPlan.code === props.purchasedPlanCode
                  || pending
                  || (viewPlan.isTrial
                    ? props.hasStripeCustomer
                    : !viewPlan.hasStripePrice || props.hasActiveSubscription)
                }
                title={
                  viewPlan.isTrial && props.hasStripeCustomer
                    ? 'The free trial is only available to new accounts.'
                    : !viewPlan.isTrial && props.hasActiveSubscription
                    ? 'Use "Manage subscription" to switch plans.'
                    : undefined
                }
                className={`px-4 py-2 text-sm font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                  viewPlan.isTrial ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {viewPlan.comingSoon
                  ? 'Coming soon'
                  : viewPlan.code === props.purchasedPlanCode
                  ? 'Current plan'
                  : viewPlan.isTrial
                  ? props.hasStripeCustomer ? 'Trial unavailable' : 'Start trial'
                  : props.hasActiveSubscription
                  ? 'Manage to switch'
                  : 'Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single row in the feature-flag list inside the View modal. Renders a
 * checkmark or cross depending on `included`.
 */
function FeatureRow({ label, included }: { label: string; included: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {included ? (
        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className={`${included ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
    </li>
  );
}
