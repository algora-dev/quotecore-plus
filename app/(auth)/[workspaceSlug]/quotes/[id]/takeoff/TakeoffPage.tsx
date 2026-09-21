'use client';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import type { QuoteRow } from '@/app/lib/types';
import type { TakeoffHydrationData } from './actions';
import { TouchWorkspaceShell } from '@/app/lib/takeoff/precision/TouchWorkspaceShell';
import { useTakeoffViewMode } from '@/app/lib/takeoff/precision/useTakeoffViewMode';
import { usePrecisionTouchHarness } from '@/app/lib/takeoff/precision/PrecisionTouchHarness';
import {
  useTouchOutlineEditor,
  type TouchOutlineAdapter,
} from '@/app/lib/takeoff/precision/TouchOutlineEditor';
import { useTouchCalibration, type TouchCalibrationPageInfo } from '@/app/lib/takeoff/precision/TouchCalibrationWorkspace';
import { decodeCalibrationMetadata } from '@/app/lib/takeoff/calibrationCodec';

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
  // M5: the workstation registers its outline bridge adapter (stable object,
  // re-registered every render — setState bails out on the identical
  // reference). While it is present the LIVE outline editor (manual creation,
  // re-entry editing, update-in-place saves) replaces the disposable M3
  // harness; until registration the harness keeps the touch surface usable.
  const [outlineAdapter, setOutlineAdapter] = useState<TouchOutlineAdapter | null>(null);
  const registerAdapter = useCallback((a: TouchOutlineAdapter) => setOutlineAdapter(a), []);
  const backHref = `/${workspaceSlug}/quotes/${quoteId}`;
  const outlineEditor = useTouchOutlineEditor(touchActive, () => outlineAdapter, backHref);
  const harness = usePrecisionTouchHarness(touchActive && outlineAdapter == null);
  const { overlay: precisionOverlay, rail: precisionRail } =
    outlineAdapter != null
      ? { overlay: outlineEditor.overlay, rail: outlineEditor.rail }
      : { overlay: harness.overlay, rail: harness.rail };

  // M4→M8 (16:59): flow-driven calibration phase — see the touchTool state
  // below; both hooks stay mounted so phase transitions preserve drafts (C16).
  const calibrationPage: TouchCalibrationPageInfo | null = useMemo(() => {
    const p = hydrationData?.pages?.[0] ?? null;
    if (p) {
      return {
        id: initialPageId ?? p.id,
        imageRevision: p.imageRevision,
        calibrationMetadata: p.calibrationMetadata,
        scaleCalibration: p.scaleCalibration,
      };
    }
    return initialPageId
      ? { id: initialPageId, imageRevision: null, calibrationMetadata: null, scaleCalibration: null }
      : null;
  }, [hydrationData, initialPageId]);
  const pageHasDependents = useMemo(
    () =>
      (hydrationData?.measurements?.some((m) => m.pageId === calibrationPage?.id) ?? false) ||
      (allRoofAreas?.length ?? 0) > 0,
    [hydrationData, calibrationPage?.id, allRoofAreas],
  );
  // M4→M8 (16:59 refinement): FLOW-DRIVEN steps — no step-switching UI.
  // A page without an accepted calibration starts in the calibration phase;
  // completing (or dismissing) calibration advances to the outline controls.
  // Re-entry on an already-calibrated page goes straight to outline.
  const [touchTool, setTouchTool] = useState<'outline' | 'calibrate'>(() => {
    if (!calibrationPage) return 'outline';
    const decoded = decodeCalibrationMetadata(
      calibrationPage.calibrationMetadata ?? calibrationPage.scaleCalibration,
    );
    const refs =
      decoded.kind === 'v1'
        ? decoded.metadata.references
        : decoded.kind === 'legacy'
          ? decoded.references
          : [];
    return refs.length > 0 ? 'outline' : 'calibrate';
    // Initial only: the flow (calibration Done) drives later transitions.
  });
  const calib = useTouchCalibration({
    active: touchActive && touchTool === 'calibrate',
    quoteId: quote.id,
    planUrl,
    page: calibrationPage,
    // M8 (owner prescription 2026-09-21): MANUAL-ONLY calibration in the
    // touch view — the AI calibration entry is hidden here; desktop is
    // unchanged.
    aiEnabled: false,
    pageHasDependents,
    onExit: () => setTouchTool('outline'),
  });

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
      onTouchOutlineAdapter={registerAdapter}
      touchExitGuard={
        touchActive
          ? {
              isDirty: () => outlineEditor.exitGuard.dirty,
              request: (label, proceed) => outlineEditor.requestExternalExit(label, proceed),
            }
          : undefined
      }
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
  // M8: rail shows ONLY the current step's controls (16:59 refinement); a
  // compact step label sits at the rail top (shell).
  const calibStatusLine = calib.saved
    ? 'Scale saved.'
    : 'Set the scale: place two points on a known distance.';

  const outlineRailContent = (
    <div className="flex flex-col gap-2">{precisionRail}</div>
  );
  const calibrateRailContent = (
    <div className="flex flex-col gap-2">
      {calib.rail}
      <div className="rounded-full bg-white/10 px-2.5 py-1 text-center text-[11px] text-slate-300" aria-live="polite">
        {calibStatusLine}
      </div>
    </div>
  );

  return (
    <TouchWorkspaceShell
      active={touchActive}
      planLabel={initialPageName ?? 'Plan'}
      railTitle={touchTool === 'calibrate' ? 'Calibration' : 'Outline'}
      viewPreference={preference}
      onViewPreferenceChange={setPreference}
      compactNotices={takeoffCompactNotices}
      overlay={touchTool === 'calibrate' ? calib.overlay : precisionOverlay}
      railContent={touchTool === 'calibrate' ? calibrateRailContent : outlineRailContent}
      backHref={`/${workspaceSlug}/quotes/${quoteId}`}
      exitGuard={outlineEditor.exitGuard}
    >
      {workstation}
    </TouchWorkspaceShell>
  );
}
