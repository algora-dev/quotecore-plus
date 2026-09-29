import { loadComponentLibrary, hasSeenComponentsIntro, loadComponentCollections, hasDismissedComponentEditWarning } from './actions';
import { ComponentList } from './component-list';
import { PendingUpdatesBanner } from './PendingUpdatesBanner';
import { SupplierAlertSettingsButton } from './SupplierAlertSettingsButton';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { BackButton } from '@/app/components/BackButton';
import { getPendingSupplierUpdates } from '../supplier-directory/actions';
import { TakeoffDraftNoteBanner } from '../TakeoffDraftNoteBanner';
import type { PendingUpdate } from '../supplier-directory/actions';

export default async function ComponentsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ restore?: string; created?: string; from?: string; learn?: string; reviewImport?: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const { restore: restoreDraftId, created: createdComponentId, from, learn, reviewImport } = await props.searchParams;
  let components;

  try {
    components = await loadComponentLibrary();
  } catch (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Unable to load components</h2>
        <p className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  // Stored rates and pack settings are canonical metric. Only test inputs and
  // measured quantities use the company's preferred display system.
  const { company } = await loadCompanyContext();
  const ent = await loadCompanyEntitlements(company.id);

  // Personal guidance preference only, never a company-pricing readiness flag.
  const introSeen = await hasSeenComponentsIntro();
  const collections = await loadComponentCollections();
  const editWarningDismissed = await hasDismissedComponentEditWarning();

  // Fetch pending supplier updates (non-blocking, best-effort)
  let pendingUpdates: PendingUpdate[] = [];
  try {
    pendingUpdates = await getPendingSupplierUpdates();
  } catch {
    // Silently skip if not available (e.g. not logged in properly)
  }

  return (
    <>
      <BackButton href={from === 'inbox' ? `/${workspaceSlug}/inbox` : `/${workspaceSlug}/resources`} label={from === 'inbox' ? 'Back to inbox' : 'Back to resources'} />
      {/* "Where is my takeoff" helper - shown here because this is the landing
          page after the free-takeoff import banner click. */}
      <TakeoffDraftNoteBanner />
      {pendingUpdates.length > 0 && (
        <PendingUpdatesBanner workspaceSlug={workspaceSlug} updates={pendingUpdates} />
      )}
      <div className="flex justify-end mb-2">
        <SupplierAlertSettingsButton workspaceSlug={workspaceSlug} />
      </div>
      <ComponentList
        initialComponents={components}
        workspaceSlug={workspaceSlug}
        companyMeasurementSystem={company.default_measurement_system}
        companyCurrency={company.default_currency ?? 'NZD'}
        reviewImported={reviewImport === '1'}
        showPricingIntroduction={learn === '1' || (!introSeen && !restoreDraftId && !createdComponentId)}
        companyDefaultTrade={(company as { default_trade?: string }).default_trade ?? 'roofing'}
        componentCollections={collections}
        flashingsFeatureEnabled={ent.features.flashings}
        editWarningDismissed={editWarningDismissed}
        restoreDraftId={restoreDraftId}
        highlightComponentId={createdComponentId}
        isSupplier={(company as { is_supplier?: boolean }).is_supplier ?? false}
      />
    </>
  );
}
