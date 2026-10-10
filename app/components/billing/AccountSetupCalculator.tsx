'use client';

/**
 * In-account mount for the V5 pricing calculator (P7: change your setup).
 *
 * Account-aware: renders the billing variant against the company's CURRENT
 * custom-setup subscription, and Continue applies an item-ID diff on the SAME
 * Stripe subscription via the applyCustomSetupChange server action (no second
 * subscription, no re-checkout). The action re-validates the intent against
 * the server catalogue and price registry; this component only forwards the
 * opaque serialized setup.
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
      continueLabel="Apply this setup"
      onContinue={async (intent) => {
        const res = await applyCustomSetupChange(serializeSetup(intent));
        return { message: res.message };
      }}
      resultActions={{ trade: 'roofing' }}
    />
  );
}
