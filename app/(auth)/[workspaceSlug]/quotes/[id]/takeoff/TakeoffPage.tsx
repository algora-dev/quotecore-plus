'use client';
import dynamic from 'next/dynamic';
import type { QuoteRow } from '@/app/lib/types';
import type { TakeoffHydrationData } from './actions';
import { TouchWorkspaceShell } from '@/app/lib/takeoff/precision/TouchWorkspaceShell';
import { useTakeoffViewMode } from '@/app/lib/takeoff/precision/useTakeoffViewMode';
import { usePrecisionTouchHarness } from '@/app/lib/takeoff/precision/PrecisionTouchHarness';

const TakeoffWorkstation = dynamic(
  () => import('./TakeoffWorkstation').then(mod => ({ default: mod.TakeoffWorkstation })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading canvas...</div>
      </div>
    )
  }
);

interface Component {
  id: string;
  name: string;
  collection_id?: string | null;
  is_system?: boolean;
}

interface ComponentCollection {
  id: string;
  name: string;
}

interface Props {
  workspaceSlug: string;
  quoteId: string;
  quote: QuoteRow;
  planUrl: string;
  components: Component[];
  /** Named component libraries for the add-component selector. */
  collections?: ComponentCollection[];
  hydrationData: TakeoffHydrationData | null;
  /** P1-1b: re-entry mode. Omit for first-ever entry. */
  takeoffMode?: 'add' | 'new-page';
  /** P1-1b: pre-created page ID for new-area entries (Options B & C). */
  initialPageId?: string;
  /** P1-1b: human-readable page name for new-area entries. */
  initialPageName?: string;
  /** P1-1b mode=add: existing roof areas to display in the panel (read-only). */
  existingRoofAreas?: { id: string; label: string }[];
  /** P1-1b mode=new-page: pre-created quote_roof_areas ID for component routing. */
  initialRoofAreaId?: string;
  /** When true the company is over storage - block plan-image uploads. */
  isOverStorage?: boolean;
  /** All roof areas for this quote (server-loaded). */
  allRoofAreas?: { id: string; label: string; pitch?: number; area?: number }[];
  /** AI Takeoff: when true, the post-calibration popup shows the AI Assist button. */
  aiTakeoffAvailable?: boolean;
  /** AI Assist points: current usage for UI display. */
  aiAssistPoints?: { used: number; limit: number; remaining: number; isBlocked: boolean } | null;
  /** P2 AI-assisted calibration per-company flag (live integration via the
   *  authenticated calibration API client). */
  aiCalibrationEnabled?: boolean;
  /** M2: mobile takeoff touch workspace per-company server flag. Off =
   *  desktop experience renders bit-for-bit; no touch code paths execute. */
  takeoffTouchEnabled?: boolean;
  /** M2: compact required-notice lines for the touch top strip (§3.4/L08). */
  takeoffCompactNotices?: string[];
}

export function TakeoffPage({
  workspaceSlug,
  quoteId,
  quote,
  planUrl,
  components,
  collections,
  hydrationData,
  takeoffMode,
  initialPageId,
  initialPageName,
  existingRoofAreas,
  initialRoofAreaId,
  isOverStorage,
  allRoofAreas,
  aiTakeoffAvailable,
  aiAssistPoints,
  aiCalibrationEnabled,
  takeoffTouchEnabled = false,
  takeoffCompactNotices = [],
}: Props) {
  // M2 view-mode resolution (§3.1). While the flag is off this hook is inert
  // (mode always 'desktop') so the desktop presentation is unchanged.
  const { mode, preference, setPreference } = useTakeoffViewMode(takeoffTouchEnabled);
  const touchActive = takeoffTouchEnabled && mode === 'mobile-touch';
  // M3: precision gesture harness (disposable geometry; spec §13 M3). Mounted
  // ONLY in touch presentation — the overlay surface is the single gesture
  // owner above the workstation canvas; desktop/flag-off paths never see it.
  const { overlay: precisionOverlay, rail: precisionRail, bottom: precisionBottom } =
    usePrecisionTouchHarness(touchActive);

  const workstation = (
    <TakeoffWorkstation
      workspaceSlug={workspaceSlug}
      quote={quote}
      planUrl={planUrl}
      components={components}
      collections={collections}
      hydrationData={hydrationData}
      takeoffMode={takeoffMode}
      initialPageId={initialPageId}
      initialPageName={initialPageName}
      existingRoofAreas={existingRoofAreas}
      initialRoofAreaId={initialRoofAreaId}
      isOverStorage={isOverStorage}
      allRoofAreas={allRoofAreas}
      aiTakeoffAvailable={aiTakeoffAvailable}
      aiAssistPoints={aiAssistPoints}
      aiCalibrationEnabled={aiCalibrationEnabled}
    />
  );

  // FLAG OFF: render the EXACT original desktop wrapper — no shell, no hidden
  // strips, no new code paths. Bit-for-bit with pre-M2 markup.
  if (!takeoffTouchEnabled) {
    return <div className="w-[125%] -ml-[12.5%]">{workstation}</div>;
  }

  // FLAG ON: desktop presentation (explicit Desktop or Auto→desktop) renders
  // the shell's inert skeleton — root carries the EXACT original
  // `w-[125%] -ml-[12.5%]` widening classes, intermediates are
  // display:contents, strips hidden. Desktop layout is unchanged, and the
  // workstation stays mounted when the user switches Desktop ↔ Mobile/touch.
  return (
    <TouchWorkspaceShell
      active={touchActive}
      planLabel={initialPageName ?? 'Plan'}
      step="calibrate"
      viewPreference={preference}
      onViewPreferenceChange={setPreference}
      compactNotices={takeoffCompactNotices}
      overlay={precisionOverlay}
      rail={precisionRail}
      bottom={precisionBottom}
      backHref={`/${workspaceSlug}/quotes/${quoteId}`}
    >
      {workstation}
    </TouchWorkspaceShell>
  );
}
