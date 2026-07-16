import Link from 'next/link';
import { loadFlashingLibrary } from './actions';
import { FlashingList } from './flashing-list';
import { BackButton } from '@/app/components/BackButton';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { FEATURE_MIN_PLAN } from '@/app/lib/billing/features';
import { getTradeLabels } from '@/app/lib/trades/labels';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function FlashingsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const { company } = await loadCompanyContext();
  const ent = await loadCompanyEntitlements(company.id);

  // Trade-aware label: 'Flashings' for roofing, 'Drawings & Images' for all
  // other trades. Display copy only - internal identifiers unchanged.
  const trade = (company as { default_trade?: string }).default_trade;
  const labels = getTradeLabels(trade);
  const featureLabel = labels.featureLabel;
  const featureLabelSingular = labels.featureLabelSingular;
  const isRoofing = trade === 'roofing' || trade == null;

  // Hard feature gate. Flashings is plan-gated, not just usage-gated, so we
  // refuse to render the library at all if the company's effective plan
  // doesn't include it. We render an upgrade splash here rather than
  // redirecting so the URL doesn't change (the link from /components can be
  // a back-friendly path).
  if (!ent.features.flashings) {
    const requiredPlan = FEATURE_MIN_PLAN.flashings;
    return (
      <section className="space-y-4 md:space-y-5 px-0 md:px-0">
        <BackButton />
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">{featureLabel}</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Available on the Professional plan and above.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">{featureLabel} need a higher plan</h2>
              <p className="text-sm text-slate-600 mt-2">
                The {featureLabel.toLowerCase()} drawing tool and reusable library are available on the {requiredPlan} plan or above. Upgrade your account to start building a {featureLabel.toLowerCase()} library and attach them to material orders.
              </p>
              <div className="mt-4">
                <Link
                  href={`/${workspaceSlug}/account?tab=billing&plan=${requiredPlan}`}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800"
                >
                  View plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const flashings = await loadFlashingLibrary();

  return (
    <section className="space-y-4 md:space-y-5 px-0 md:px-0">
      <BackButton />
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Drawings/Images</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">Manage drawing and image designs to attach to material orders.</p>
      </div>
      <FlashingList
        initialFlashings={flashings}
        workspaceSlug={workspaceSlug}
        flashingLimit={ent.flashingLimit}
        flashingCount={ent.flashingCount}
        effectivePlanCode={ent.effectivePlanCode}
        isRoofing={isRoofing}
        featureLabel={featureLabel}
        featureLabelSingular={featureLabelSingular}
        isOverStorage={ent.isOverStorage}
      />
    </section>
  );
}
