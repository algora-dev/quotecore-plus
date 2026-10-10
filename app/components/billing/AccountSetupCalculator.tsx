'use client';

/**
 * In-account mount for the V5 pricing calculator (P7: review your setup).
 *
 * Account-aware: renders the billing variant against the company's CURRENT
 * custom-setup subscription. Setup changes are COMPARISON-ONLY in this pass:
 * the applyCustomSetupChange server action is a deliberate safety hold that
 * refuses mutations until the reviewed, payment-confirmed change flow is
 * integrated. This component only forwards the opaque serialized setup and
 * surfaces the server's explanatory response (no second subscription, no
 * re-checkout, no item mutation).
 */

import {
  PricingCalculator,
  PREVIEW_CATALOG,
  serializeSetup,
} from '@/app/components/pricing/calculator';
import type { CurrentSubscription } from '@/app/components/pricing/calculator';
import { applyCustomSetupChange } from '@/app/(auth)/[workspaceSlug]/account/billing/actions';

export function AccountSetupCalculator({
  currentSubscription,
  notice,
}: {
  currentSubscription: CurrentSubscription;
  notice: string;
}) {
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
