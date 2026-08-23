import { loadComponentLibrary, hasSeenComponentsIntro, loadComponentCollections, hasDismissedComponentEditWarning } from './actions';
import { ComponentList } from './component-list';
import { ComponentsIntroModal } from './components-intro-modal';
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
  searchParams: Promise<{ restore?: string; created?: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const { restore: restoreDraftId, created: createdComponentId } = await props.searchParams;
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

  // Component library is per-company - shared across every quote regardless of
  // measurement system. We render rates in the company default so an Imperial
  // shop sees ft²/RS labels here, with a note that per-quote display still
  // follows the quote's own measurement_system.
  const { company } = await loadCompanyContext();
  const ent = await loadCompanyEntitlements(company.id);

  // First-visit modal: shown once per user. Suppresses the copilot tour
  // while open (see ComponentsIntroModal). After dismissal the existing
  // copilot auto-detect picks up and runs the `components` guide if the
  // user has copilot enabled.
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
      {!introSeen && <ComponentsIntroModal />}
      <BackButton />
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
        companyDefaultTrade={(company as { default_trade?: string }).default_trade ?? 'roofing'}
        componentCollections={collections}
        componentLimit={ent.componentLimit}
        componentCount={ent.componentCount}
        effectivePlanCode={ent.effectivePlanCode}
        flashingsFeatureEnabled={ent.features.flashings}
        subscriptionActive={ent.isActive}
        editWarningDismissed={editWarningDismissed}
        restoreDraftId={restoreDraftId}
        highlightComponentId={createdComponentId}
        isSupplier={(company as { is_supplier?: boolean }).is_supplier ?? false}
      />
    </>
  );
}
