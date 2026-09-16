import Link from 'next/link';
import { redirect } from 'next/navigation';

import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { LogoutButton } from '@/app/components/auth/LogoutButton';
import { loadBillingPlans } from '@/app/lib/billing/paywall-plans';
import { BillingPanel } from '@/app/(auth)/[workspaceSlug]/account/billing/BillingPanel';

/**
 * Onboarding paywall (paid-upfront model, 2026-09-16).
 *
 * Every new signup lands here after onboarding: the workspace layout gate
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
    .select('stripe_customer_id, stripe_subscription_id, cancel_at_period_end, cancel_at')
    .eq('id', company.id)
    .maybeSingle();

  // Purchasable tiers only. The `free` tier is backend-only (dunning
  // fallback), and coming-soon tiers have no checkout path.
  const plans = await loadBillingPlans(new Set(['starter', 'pro', 'pro_plus']));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
      {/* Minimal header: logo + logout only. No workspace nav - there is no
          workspace access to navigate to until a plan is active. */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img src="/logo.png" alt="QuoteCore" className="h-9" />
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Your workspace is ready - pick a plan to jump in
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">
            One quick payment and everything you set up is unlocked: quoting, takeoffs,
            orders, invoices, and AI features.
          </p>
          {/* Guarantee - prominent, directly above the cards */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2">
            <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span className="text-sm font-semibold text-emerald-800">
              30-day money-back guarantee
            </span>
          </div>
        </div>

        {/* Plan cards - the same BillingPanel surface used in account > billing.
            Checkout CTA calls the existing createCheckoutSession action; on
            success Stripe flips subscription_status to active via webhook and
            the return URL lands the user in the workspace. */}
        <div className="mt-8">
          <BillingPanel
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
              className="text-sm font-semibold text-[#BD4A1A] hover:text-[#ff5722] whitespace-nowrap"
            >
              Get in touch &rarr;
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Done-For-You setup</span> - we build
              your component library, templates, and workflows for you. $499 / $999.
            </p>
            <Link
              href="/custom-solutions"
              prefetch={false}
              className="text-sm font-semibold text-[#BD4A1A] hover:text-[#ff5722] whitespace-nowrap"
            >
              Learn more &rarr;
            </Link>
          </div>
        </div>

        {/* Clean exit - account stays canceled/locked, no extra state written */}
        <div className="mt-8 text-center">
          <Link
            href="/free-tools"
            prefetch={false}
            className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            No thanks, I&apos;ll keep using the free tools
          </Link>
        </div>
      </main>
    </div>
  );
}
