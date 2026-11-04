'use client';

/**
 * In-account mount for the V5 pricing calculator (P7: review your setup).
 *
 * Two modes (owner 2026-11-04):
 *  - compare (default): read-only review against an existing subscription.
 *    The applyCustomSetupChange server action is a deliberate safety hold
 *    that refuses mutations.
 *  - checkout: Free Workspace purchase path. The pricing tool's review step
 *    mints a real multi-item Stripe Checkout via createCustomCheckoutSession
 *    and redirects to it; the webhook reconciles access after payment.
 */

import {
  PricingCalculator,
  PREVIEW_CATALOG,
  serializeSetup,
} from '@/app/components/pricing/calculator';
import type { CurrentSubscription } from '@/app/components/pricing/calculator';
import { applyCustomSetupChange, createCustomCheckoutSession } from '@/app/(auth)/[workspaceSlug]/account/billing/actions';

export function AccountSetupCalculator({
  currentSubscription,
  notice,
  mode = 'compare',
}: {
  currentSubscription: CurrentSubscription;
  notice: string;
  mode?: 'compare' | 'checkout';
}) {
  if (mode === 'checkout') {
    return (
      <PricingCalculator
        catalog={PREVIEW_CATALOG}
        variant="billing"
        currentSubscription={currentSubscription}
        notice={notice}
        continueLabel="Review this setup"
        onContinue={async (intent) => {
          let serialized = '';
          try { serialized = serializeSetup(intent); } catch { return { message: 'Your setup could not be saved. Try again.' }; }
          const res = await createCustomCheckoutSession(serialized);
          if (res.ok) {
            window.location.href = res.url;
            return { message: 'Redirecting to secure checkout…' };
          }
          return { message: res.message };
        }}
        resultActions={{ trade: 'roofing' }}
      />
    );
  }
  return (
    <PricingCalculator
      catalog={PREVIEW_CATALOG}
      variant="billing"
      currentSubscription={currentSubscription}
      notice={notice}
      continueLabel="Compare this setup"
      onContinue={async (intent) => {
        const res = await applyCustomSetupChange(serializeSetup(intent));
        return { message: res.message };
      }}
      resultActions={{ trade: 'roofing' }}
    />
  );
}
