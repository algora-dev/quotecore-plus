'use client';

/**
 * New-pricing paywall flow (CUSTOM_BILLING_CHECKOUT_ENABLED deployments only).
 *
 * Every visitor builds their setup with the V5 pricing calculator right on the
 * paywall - no legacy plan cards, regardless of where they came from. A
 * completed setup persists to sessionStorage and the pay card above re-mounts
 * with a single pay CTA (the server re-validates the setup against the price
 * registry; this component only forwards the opaque setup string).
 *
 * Visitors who already carry a setup from /pricing (same tab) see the pay card
 * immediately; the calculator below lets them adjust it before paying.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PricingCalculator, PREVIEW_CATALOG, saveSetup } from '@/app/components/pricing/calculator';
import type { CalculatorCatalog, PlanIntent } from '@/app/components/pricing/calculator';
import { CustomSetupPayCard } from '@/app/components/billing/CustomSetupPayCard';

export function PaywallSetupFlow({ catalog = PREVIEW_CATALOG }: { catalog?: CalculatorCatalog } = {}) {
  const [setupVersion, setSetupVersion] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const onContinue = useCallback(async (intent: PlanIntent) => {
    try { saveSetup(window.sessionStorage, intent); } catch { /* optional persistence */ }
    setSetupVersion((v) => v + 1); // remount so the card reads the fresh setup
    return { message: 'Your setup is ready. Complete payment on the card above to activate your workspace.' };
  }, []);

  useEffect(() => {
    if (setupVersion > 0) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [setupVersion]);

  return (
    <>
      <div ref={cardRef}>
        <CustomSetupPayCard key={setupVersion} catalog={catalog} />
      </div>
      <PricingCalculator
        catalog={PREVIEW_CATALOG}
        variant="page"
        onContinue={onContinue}
        continueLabel="Continue to payment"
      />
    </>
  );
}
