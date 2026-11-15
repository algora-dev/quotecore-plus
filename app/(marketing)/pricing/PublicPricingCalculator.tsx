'use client';

import { PricingCalculator } from '@/app/components/pricing/calculator/PricingCalculator';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';

/** Public, read-only billing host. All callbacks remain client-side and only
 * navigate to free signup. No Stripe action, account mutation or billing API. */
export function PublicPricingCalculator({callHref}:{callHref:string}) {
  return <PricingCalculator
    catalog={PREVIEW_CATALOG}
    variant="page"
    continueHref={() => '/signup'}
    continueLabel="Create my free workspace"
    publicNextSteps={{callHref,doneForYouHref:'/done-for-you-setup'}}
    notice="Estimate only. No payment or subscription change can occur on this public page."
  />;
}
