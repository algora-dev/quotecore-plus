/**
 * P7: in-account "change your setup" page for custom-setup (V5) subscribers.
 *
 * Mounts the pricing calculator in its billing variant, account-aware against
 * the company's CURRENT custom subscription. Continue applies an item-ID diff
 * on the SAME Stripe subscription (no second checkout); the subscription
 * webhook reconciles the snapshot from the resulting update.
 */

import { redirect } from 'next/navigation';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { AccountSetupCalculator } from '@/app/components/billing/AccountSetupCalculator';
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
  if (ent.billingModel !== 'custom_setup') {
    redirect(`/${ctx.company.slug}/account?tab=billing`);
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snap } = await (admin as any)
    .from('company_custom_billing')
    .select('component_codes, monthly_cents, currency, catalog_revision')
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();
  const snapRow = snap as {
    component_codes: string[] | null;
    monthly_cents: number | null;
    currency: string | null;
    catalog_revision: string | null;
  } | null;

  const current: CurrentSubscription = {
    billingSystem: 'custom_setup',
    displayName: 'Your QuoteCore+ setup',
    monthlyCents: snapRow?.monthly_cents ?? null,
    currency: snapRow?.currency?.toLowerCase() === 'nzd' ? 'NZD' : 'USD',
    catalogRevision: snapRow?.catalog_revision ?? undefined,
    componentCodes: Array.isArray(snapRow?.component_codes) ? snapRow!.component_codes! : undefined,
  };

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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Change your setup</h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">
            Build the setup that fits your work now. Your subscription updates in place - same billing date, no second subscription.
          </p>
        </div>
        <div className="mt-8" data-qc-build-setup>
          <AccountSetupCalculator
            currentSubscription={current}
            notice="Changes apply to your current subscription: additions are invoiced for the difference now; removals take effect without credit for unused time."
          />
        </div>
      </main>
    </div></QcJourney>
  );
}
