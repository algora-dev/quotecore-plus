'use client';

/**
 * Billing tab — phase 1 minimal UI.
 *
 * Three jobs:
 *   1. Show the company's current plan + status + key dates (trial end,
 *      next period end, payment-failure timer).
 *   2. Give the user a way to upgrade (Checkout) or manage their existing
 *      subscription (Customer Portal).
 *   3. Render banner copy when the URL carries ?checkout=success/canceled
 *      from a Stripe redirect.
 *
 * Polish (banners with lock icons, plan comparison grid, usage bars,
 * upgrade modals) lands in step 7. This panel is intentionally plain so
 * we can exercise Checkout + Portal end-to-end today.
 */

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  createCheckoutSession,
  createCustomerPortalSession,
  type BillingActionResult,
} from './actions';

export interface BillingPlanInfo {
  code: string;
  displayName: string;
  priceCentsMonthly: number;
  monthlyQuoteLimit: number;
  storageLimitBytes: number;
  hasStripePrice: boolean;
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
  /** Trial end timestamp (ISO) if applicable. */
  trialEndsAt: string | null;
  /** Current period end (ISO) when subscription is active. */
  currentPeriodEnd: string | null;
  /** First payment failure (ISO) — drives the past_due banner. */
  firstPaymentFailureAt: string | null;
  /** Storage usage. */
  storageUsedBytes: number;
  storageLimitBytes: number;
  /** All available plans (excluding the current one) the user can upgrade to. */
  upgradePlans: BillingPlanInfo[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}/mo`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function BillingPanel(props: BillingPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkoutFlag = searchParams.get('checkout');

  function handleResult(result: BillingActionResult) {
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    setError(result.message);
  }

  function onUpgrade(planCode: string) {
    setError(null);
    setActivePlan(planCode);
    startTransition(async () => {
      const result = await createCheckoutSession(planCode);
      handleResult(result);
      setActivePlan(null);
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
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

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

  const storagePct = props.storageLimitBytes
    ? Math.min(100, Math.round((props.storageUsedBytes / props.storageLimitBytes) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Stripe redirect banners */}
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

      {/* Current plan card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Current plan</p>
            <h3 className="text-lg font-semibold text-slate-900 mt-1 capitalize">
              {props.effectivePlanCode}
              {props.effectivePlanCode !== props.purchasedPlanCode && (
                <span className="ml-2 text-sm font-normal text-amber-700">
                  (downgraded from {props.purchasedPlanCode})
                </span>
              )}
            </h3>
            <span
              className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}
            >
              {props.subscriptionStatus.replace(/_/g, ' ')}
            </span>
          </div>
          {props.hasStripeCustomer && (
            <button
              type="button"
              onClick={onManage}
              disabled={pending}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Manage subscription
            </button>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {props.trialEndsAt && (
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

      {/* Upgrade plans */}
      {props.upgradePlans.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900">
            {props.hasStripeCustomer ? 'Change plan' : 'Upgrade'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {props.hasStripeCustomer
              ? 'Switch plans through the Customer Portal — or pick one below to start fresh.'
              : 'Pick a plan to start your subscription.'}
          </p>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {props.upgradePlans.map((plan) => {
              const isActive = pending && activePlan === plan.code;
              const buttonDisabled = pending || !plan.hasStripePrice;
              return (
                <li
                  key={plan.code}
                  className="rounded-lg border border-slate-200 p-4 flex flex-col justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{plan.displayName}</p>
                    <p className="text-lg font-semibold text-slate-900 mt-1">
                      {formatPrice(plan.priceCentsMonthly)}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      <li>{plan.monthlyQuoteLimit} quotes / month</li>
                      <li>{formatBytes(plan.storageLimitBytes)} storage</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpgrade(plan.code)}
                    disabled={buttonDisabled}
                    title={
                      !plan.hasStripePrice
                        ? 'This plan is not yet configured in Stripe for this environment.'
                        : undefined
                    }
                    className="mt-3 w-full px-3 py-2 text-sm font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActive
                      ? 'Redirecting…'
                      : plan.hasStripePrice
                      ? `Choose ${plan.displayName}`
                      : 'Not available'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
