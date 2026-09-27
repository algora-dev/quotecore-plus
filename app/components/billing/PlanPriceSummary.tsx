import type { BillingPlanInfo } from '@/app/(auth)/[workspaceSlug]/account/billing/BillingPanel';

/** Display only. Checkout, plan eligibility and entitlements stay with BillingPanel.
 * Uses the supplied catalogue rather than a second set of subscription prices.
 */
export function PlanPriceSummary({ plans }: { plans: BillingPlanInfo[] }) {
  const available = plans.filter(plan => !plan.comingSoon && plan.hasStripePrice && Number.isFinite(plan.priceCentsMonthly) && plan.priceCentsMonthly > 0);
  if (!available.length) return null;
  return <p className="qc-flow-description" style={{ marginTop: 12 }}>
    {available.map((plan, index) => <span key={plan.code}>{index > 0 ? ' · ' : ''}{plan.displayName} {formatPlanPrice(plan.priceCentsMonthly)}/month</span>)}
  </p>;
}

export function formatPlanPrice(cents: number): string {
  const amount = cents / 100;
  return `$${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
}
