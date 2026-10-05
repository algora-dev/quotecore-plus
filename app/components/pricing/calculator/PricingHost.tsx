'use client';
import { PricingCalculator } from './PricingCalculator';
import { safeNavigationHref } from './persistence';
import type { PlanIntent, PricingCalculatorProps } from './types';
/** Optional adapter for a host server action that RETURNS a redirect URL.
 * Mount inside the existing layout. The host action authenticates, persists intent,
 * prevents duplicate subscriptions and creates the appropriate reviewed handoff. */
export function PricingHost({ continueAction, ...props }: Omit<PricingCalculatorProps, 'onContinue' | 'continueHref'> & {
  continueAction: (intent: PlanIntent) => Promise<{ ok: boolean; redirectTo?: string; message?: string }>;
}) {
  async function continueWithSetup(intent: PlanIntent) {
    const response = await continueAction(intent);
    if (!response.ok) throw new Error('The host could not continue.');
    if (response.redirectTo) {
      if (!safeNavigationHref(response.redirectTo)) throw new Error('Unsafe host continuation URL.');
      window.location.assign(response.redirectTo);
    }
    return { message: response.message ?? 'Continuing with your setup.' };
  }
  return <PricingCalculator {...props} onContinue={continueWithSetup} />;
}
