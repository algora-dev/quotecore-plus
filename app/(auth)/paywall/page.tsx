import { QcJourney, QcJourneySteps } from '@/app/components/ui/v2/QcJourney';
import Link from 'next/link';
import { PlanPriceSummary } from '@/app/components/billing/PlanPriceSummary';
import { redirect } from 'next/navigation';

import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { LogoutButton } from '@/app/components/auth/LogoutButton';
import { loadBillingPlans } from '@/app/lib/billing/paywall-plans';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { customStripeMode, customPricingOnly } from '@/app/lib/billing/custom/environment';
import { BillingPanel } from '@/app/(auth)/[workspaceSlug]/account/billing/BillingPanel';
import { CustomSetupPayCard } from '@/app/components/billing/CustomSetupPayCard';
import { PaywallSetupFlow } from '@/app/components/billing/PaywallSetupFlow';
import { LapsedCompNotice } from '@/app/components/billing/LapsedCompNotice';

/**
 * Inactive-workspace billing recovery / upgrade surface.
 *
 * Active Free Workspaces do not land here. The workspace layout gate
 * (app/(auth)/[workspaceSlug]/layout.tsx) redirects any company whose
 * effective plan is inactive (never paid / canceled / not comped) here
 * until they subscribe or we manually comp them.
 *
 * Reuses BillingPanel wholesale for the plan cards + Stripe checkout so
 * the paywall can never drift from the account billing surface.
 */
export default async function PaywallPage() {
  let company;
  try {
    ({ company } = await loadCompanyContext());
  } catch {
    // Authed user without a company yet - send them to onboarding first.
    redirect('/onboarding');
  }

  // Paid / comped users never see the paywall.
  const entitlements = await loadCompanyEntitlements(company.id);
  if (entitlements.isActive) {
    redirect(`/${company.slug}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: companyRow } = await supabase
    .from('companies')
    .select('stripe_customer_id, stripe_subscription_id, cancel_at_period_end, cancel_at, comp_until')
    .eq('id', company.id)
    .maybeSingle();

  // Lapsed complimentary grant (owner directive 2026-10-18): expired comps
  // land here blocked; show them why plus the demo / pricing / homepage
  // recovery context instead of a silent generic paywall.
  const lapsedComp = Boolean(
    companyRow?.comp_until && new Date(companyRow.comp_until) <= new Date(),
  );

  // V5 pricing cutover (testing, owner 2026-10-11): calculator-only paywall,
  // no legacy plan cards regardless of entry path. Main keeps legacy surfaces.
  const newPricing = customPricingOnly();
  // Purchasable paid tiers only. The Free Workspace is provisioned separately
  // and does not require checkout; this recovery surface only offers paid access.
  const plans = newPricing ? [] : await loadBillingPlans(new Set(['starter', 'pro', 'pro_plus']));

  return (
    <QcJourney><div className="qc-flow-auth">
      {/* Minimal header: logo + logout only. No workspace nav - there is no
          workspace access to navigate to until a plan is active. */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img src="/logo.png" alt="QuoteCore" className="h-9" />
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {lapsedComp && <LapsedCompNotice endedOn={companyRow?.comp_until ?? null} />}

        <div className="mt-8 text-center max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Choose your paid setup
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">
            {newPricing
              ? 'Build the paid setup that fits your work. Your exact configuration and price are handled here inside your account.'
              : 'Choose the paid subscription that fits your work. Features and limits depend on the plan you select.'}
          </p>
          {!newPricing && <PlanPriceSummary plans={plans} />}
        </div>

        {/* Plan cards - the same BillingPanel surface used in account > billing.
            Checkout CTA calls the existing createCheckoutSession action; on
            success Stripe flips subscription_status to active via webhook and
            the return URL lands the user in the workspace. */}
        <div className="mt-8">
          {/* V5 pricing cutover (testing): every visitor builds their setup on
              the paywall - no legacy plan cards, no matter where they came
              from. Main (flag off) keeps the V1 layout: stored-setup pay card
              + legacy plan panel. */}
          {!newPricing && (
            <CustomSetupPayCard catalog={customStripeMode() === 'test' ? { ...PREVIEW_CATALOG, stage: 'approved' } : PREVIEW_CATALOG} />
          )}
          <QcJourneySteps steps={["Account", "Workspace", "Subscription"]} current={2} label="Getting started" />
          {newPricing ? (
            <PaywallSetupFlow catalog={customStripeMode() === 'test' ? { ...PREVIEW_CATALOG, stage: 'approved' } : PREVIEW_CATALOG} />
          ) : (
          <BillingPanel context="activation"
            effectivePlanCode={entitlements.effectivePlanCode}
            purchasedPlanCode={entitlements.purchasedPlanCode}
            subscriptionStatus={entitlements.subscriptionStatus}
            hasStripeCustomer={Boolean(companyRow?.stripe_customer_id)}
            hasActiveSubscription={false}
            currentPeriodEnd={entitlements.currentPeriodEnd}
            cancelAtPeriodEnd={Boolean(companyRow?.cancel_at_period_end)}
            cancelAt={companyRow?.cancel_at ?? null}
            firstPaymentFailureAt={entitlements.firstPaymentFailureAt}
            storageUsedBytes={entitlements.storageUsedBytes}
            storageLimitBytes={entitlements.storageLimitBytes}
            plans={plans}
          />
          )}
        </div>

        {/* Larger-plan strip + Done-For-You row (links only - no checkout logic) */}
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition">
            <p className="text-sm text-slate-700">
              Need something bigger? Multi-team, custom workflows, API access - we build to fit.
            </p>
            <Link
              href="/custom-solutions"
              prefetch={false}
              className="qc-flow-link text-sm font-semibold text-[#BD4A1A] hover:text-[#ff5722] whitespace-nowrap"
            >
              Get in touch &rarr;
            </Link>
          </div>
        </div>

        {/* Done For You stays a scoped service, not a second set of fixed tiers. */}
        <div className="mt-10 max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900">Prefer us to set it up for you?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Done For You starts from $499 and is scoped to your business. It includes the agreed setup, your first 3 months of the appropriate QuoteCore+ subscription, a personalised handover and 3 months of support.
              </p>
            </div>
            <Link
              data-qc-variant="primary"
              href="/done-for-you-setup?inquire=1"
              prefetch={false}
              className="qc-button qc-flow-control shrink-0"
            >
              Inquire about Done For You &rarr;
            </Link>
          </div>
        </div>
      </main>
    </div></QcJourney>
  );
}
