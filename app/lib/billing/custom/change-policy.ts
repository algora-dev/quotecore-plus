/** Read-only change assessment. Amount due today MUST come from a Stripe invoice preview. */
import { classifyChange, sameCodes, type DecodedPurchase, type PurchasedLimits } from './contracts';
export function assessSetupChange(current: DecodedPurchase, target: { codes: string[]; monthlyCents: number; limits: PurchasedLimits }) {
  const kind = classifyChange(current.limits, target.limits, sameCodes(current.codes, target.codes));
  return { kind, currentMonthlyCents: current.monthlyCents, proposedMonthlyCents: target.monthlyCents,
    monthlyDifferenceCents: target.monthlyCents - current.monthlyCents,
    proposedTiming: kind === 'increase' ? 'after_successful_payment' as const : kind === 'none' ? 'unchanged' as const : 'next_renewal' as const,
    amountDueNowCents: null, requiresStripePreview: kind !== 'none',
    currentPeriodEndsAt: new Date(current.periodEnd * 1000).toISOString(),
    note: kind === 'none' ? 'Your setup is unchanged.' : 'Review the exact payment and effective date before confirming. Nothing has changed yet.' };
}
