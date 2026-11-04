/** Read-only setup comparison until reviewed, payment-confirmed changes are integrated. */

import { redirect } from 'next/navigation';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { calculatorCodesFromBilling } from '@/app/lib/billing/custom/presentation';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { AccountSetupCalculator } from '@/app/components/billing/AccountSetupCalculator';
import { customPricingOnly } from '@/app/lib/billing/custom/environment';
import type { CurrentSubscription } from '@/app/components/pricing/calculator';
import { QcJourney } from '@/app/components/ui/v2/QcJourney';
import { LogoutButton } from '@/app/components/auth/LogoutButton';

export default async function BuildSetupPage() {
  let ctx;
  try {
    ctx = await loadCompanyContext();
  } catch {
    redirect('/login');
  }

  const ent = await loadCompanyEntitlements(ctx.profile.company_id);
  // V5 pricing cutover (testing): legacy plan holders may also compare a setup
  // here. Main keeps the custom-companies-only behaviour.
  const newPricing = customPricingOnly();
  if (ent.billingModel !== 'custom_setup' && !newPricing) {
    redirect(`/${ctx.company.slug}/account?tab=billing`);
  }
  const isCustom = ent.billingModel === 'custom_setup';
  let isFree = false;
  let checkoutEligible = false;

  let current: CurrentSubscription;
  if (!isCustom) {
    // Legacy plan holder (V5 cutover preview): comparison only, no custom
    // snapshot exists. The calculator shows their plan as the baseline.
    current = {
      billingSystem: 'legacy',
      displayName: 'Your current plan',
      monthlyCents: null,
      currency: 'USD',
    };
  } else {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: co } = await (admin as any)
    .from('companies')
    .select('stripe_subscription_id')
    .eq('id', ctx.profile.company_id)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snap, error: snapshotError } = await (admin as any)
    .from('company_custom_billing')
    .select('component_codes, monthly_cents, currency, catalog_revision, stripe_subscription_id')
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();
  if (snapshotError || !snap) throw new Error('Your purchased setup could not be loaded. No subscription has been changed.');
  const snapRow = snap as {
    component_codes: string[] | null;
    monthly_cents: number | null;
    currency: string | null;
    catalog_revision: string | null;
    stripe_subscription_id: string | null;
  } | null;

  // Free Workspace (owner 2026-11-04): 'admin-free-*' grant ids = free tier.
  isFree = typeof snapRow?.stripe_subscription_id === 'string'
    && snapRow.stripe_subscription_id.startsWith('admin-free-');

  // Checkout-eligible (owner 2026-11-04): ANY custom company with no real
  // Stripe subscription yet — free workspaces AND comped team-granted
  // accounts. The purchase path is identical for both; paid subscribers use
  // the in-app change wizard in Billing instead.
  checkoutEligible = !co?.stripe_subscription_id;

  current = {
    billingSystem: 'custom_setup',
    displayName: isFree ? 'Your free workspace' : 'Your QuoteCore+ setup',
    monthlyCents: snapRow?.monthly_cents ?? null,
    currency: snapRow?.currency?.toLowerCase() === 'nzd' ? 'NZD' : 'USD',
    catalogRevision: snapRow?.catalog_revision ?? undefined,
    componentCodes: calculatorCodesFromBilling(snapRow?.component_codes),
  };
  }

  return (
    <QcJourney><div className="qc-flow-auth min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img src="/logo.png" alt="QuoteCore" className="h-9" />
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{checkoutEligible ? 'Change your plan' : 'Review your setup'}</h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">
            {checkoutEligible
              ? 'Configure the setup that fits your work, then pay securely to activate it. Your current workspace keeps working — nothing changes until payment completes.'
              : 'Explore a setup that fits your work now. Your current subscription stays unchanged while you compare.'}
          </p>
        </div>
        <div className="mt-8" data-qc-build-setup>
          <AccountSetupCalculator
            currentSubscription={current}
            mode={checkoutEligible ? 'checkout' : 'compare'}
            notice={checkoutEligible
              ? 'Secure checkout via Stripe. Your new allowances activate as soon as payment completes; your current tier keeps working until then.'
              : isCustom
                ? 'This is a comparison only. Online setup changes are temporarily unavailable. No payment or subscription change will be made.'
                : 'Preview of the new pricing. Your current subscription is unchanged; switching plans here is not available yet.'}
          />
        </div>
      </main>
    </div></QcJourney>
  );
}
