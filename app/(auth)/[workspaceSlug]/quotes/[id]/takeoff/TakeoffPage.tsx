'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import type { CalibrationCommitPayload } from '@/app/lib/takeoff/precision/touchCalibration';
import { DEFAULT_ROOF_PITCH } from '@/app/lib/takeoff/precision/touchNumberEntry';
import type { QuoteRow } from '@/app/lib/types';
import type { TakeoffHydrationData } from './actions';
import { TouchWorkspaceShell } from '@/app/lib/takeoff/precision/TouchWorkspaceShell';
import { RailAction, RailNotice, RailTask } from '@/app/lib/takeoff/precision/TouchRailControls';
import { useTakeoffViewMode } from '@/app/lib/takeoff/precision/useTakeoffViewMode';
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
  const router = useRouter();
  const { mode, preference, setPreference } = useTakeoffViewMode(takeoffTouchEnabled);
  const touchActive = takeoffTouchEnabled && mode === 'mobile-touch';
  const [outlineAdapter, setOutlineAdapter] = useState<TouchOutlineAdapter | null>(null);
  const registerAdapter = useCallback((adapter: TouchOutlineAdapter) => setOutlineAdapter(adapter), []);
  const [, refreshBridge] = useState(0);
  useEffect(() => outlineAdapter?.subscribe?.(() => refreshBridge((n) => n + 1)), [outlineAdapter]);
  const backHref = `/${workspaceSlug}/quotes/${quoteId}`;
  // Match the desktop Finish and Save destination, not the quote detail page.
  const finishHref = `/${workspaceSlug}/quotes/${quoteId}/build?step=roof-areas`;
  const [pitch, setPitch] = useState(DEFAULT_ROOF_PITCH);
  const [resolvedPage1Id, setResolvedPage1Id] = useState<string | null>(null);
  const [confirmedCalibration, setConfirmedCalibration] = useState<{ pageId: string; payload: CalibrationCommitPayload } | null>(null);
  const activePageId = outlineAdapter?.getEditContext()?.pageId ?? initialPageId ?? resolvedPage1Id ?? hydrationData?.pages[0]?.id ?? null;
  const calibrationPage: TouchCalibrationPageInfo | null = useMemo(() => {
    if (!activePageId) return null;
    const acknowledged = confirmedCalibration?.pageId === activePageId ? confirmedCalibration.payload : null;
    // Never relabel page one's calibration as the newly uploaded page's scale.
    const page = hydrationData?.pages.find((p) => p.id === activePageId);
    return { id: activePageId,
      imageRevision: acknowledged?.metadata.imageRevision || page?.imageRevision || null,
      calibrationMetadata: acknowledged?.metadata ?? page?.calibrationMetadata ?? null,
      scaleCalibration: acknowledged?.legacy ?? page?.scaleCalibration ?? null };
  }, [activePageId, hydrationData, confirmedCalibration]);
  const pageHasDependents = (hydrationData?.measurements?.some((m) => !m.pageId || m.pageId === activePageId) ?? false)
    || (outlineAdapter?.getAreas().length ?? 0) > 0;
  const [touchTool, setTouchTool] = useState<'outline' | 'calibrate' | 'components'>(() => {
    const decoded = decodeCalibrationMetadata(calibrationPage?.calibrationMetadata ?? calibrationPage?.scaleCalibration);
    const count = decoded.kind === 'v1' ? decoded.metadata.references.length : decoded.kind === 'legacy' ? decoded.references.length : 0;
    return count > 0 ? 'outline' : 'calibrate';
  });
  // M10: component phase entry mode chosen on the outline finish screen.
  const [componentsMode, setComponentsMode] = useState<'ai' | 'manual'>('ai');
  const enterComponents = useCallback((mode: 'ai' | 'manual') => {
    setComponentsMode(mode);
    setTouchTool('components');
  }, []);
  const onCommitted = useCallback((pageId: string, payload: CalibrationCommitPayload) => {
    setConfirmedCalibration({ pageId, payload });
  }, []);
  // The server ACK is adopted into the existing measurement owner before
  // advancing. No router.refresh race and no dependency on a second DB read.
  useEffect(() => {
    if (!confirmedCalibration || !outlineAdapter) return;
    if (touchTool !== 'calibrate') return; // already advanced
    // Keyboardless fix (2026-09-22): retryable. The workstation's page id can
    // land AFTER the ACK (ensurePage1 race), so re-attempt when the active
    // page id changes instead of one-shotting on the ACK alone.
    if (outlineAdapter.applyConfirmedCalibration?.(confirmedCalibration.pageId, confirmedCalibration.payload)) {
      queueMicrotask(() => setTouchTool('outline'));
    }
  }, [confirmedCalibration, outlineAdapter, activePageId, touchTool]);
  const calib = useTouchCalibration({
    active: touchActive && touchTool === 'calibrate', quoteId: quote.id,
    planUrl: outlineAdapter?.getImageUrl() ?? planUrl, page: calibrationPage,
    aiEnabled: false, // Retain the current mobile manual-first feature policy.
    pageHasDependents,
    defaultWorkingUnit: normalizeMeasurementSystem(quote.measurement_system) === 'metric' ? 'meters' : 'feet',
    onCommitted, onExit: () => router.push(backHref),
  });
  const outlineEditor = useTouchOutlineEditor(
    touchActive && touchTool === 'outline', () => outlineAdapter, backHref,
    () => setTouchTool('calibrate'), { finishHref, pitch, onPitchChange: setPitch, onEnterComponents: enterComponents },
  );
  // M10 P1: components step skeleton. Fork plumbing is live; the AI
  // component scan + review rail land in P2-P4
  // (docs/MOBILE_COMPONENT_SCAN_PLAN.md).
  const componentsRail = touchTool === 'components' ? (
    <RailTask label="Components step" footer={
      <RailAction primary onClick={() => router.push(finishHref)}>Save &amp; continue</RailAction>
    }>
      <RailNotice>Your roof outline is saved.</RailNotice>
      <RailNotice>{componentsMode === 'ai'
        ? 'AI component scanning is the next build step. Continue to the quote builder for now.'
        : 'Manual component entry is the next build step. Continue to the quote builder for now.'}</RailNotice>
    </RailTask>
  ) : null;
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
      onPage1Resolved={setResolvedPage1Id}
      touchExitGuard={
        touchActive
          ? {
              isDirty: () => touchTool === 'calibrate' ? calib.exitGuard.dirty || calib.busy : outlineEditor.exitGuard.dirty || outlineEditor.busy,
              request: (label: string, proceed: () => void) => {
                // The hidden desktop cannot interrupt a calibration/commit.
                if (touchTool !== 'calibrate') outlineEditor.requestExternalExit(label, proceed);
              },
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
  return (
    <TouchWorkspaceShell
      active={touchActive}
      planLabel={initialPageName ?? 'Plan'}
      railTitle={touchTool === 'calibrate' ? 'Calibration' : touchTool === 'components' ? 'Components' : 'Outline'}
      viewPreference={preference}
      onViewPreferenceChange={setPreference}
      compactNotices={takeoffCompactNotices}
      overlay={touchTool === 'calibrate' ? calib.overlay : touchTool === 'components' ? null : outlineEditor.overlay}
      railContent={touchTool === 'calibrate' ? calib.rail : touchTool === 'components' ? componentsRail : outlineEditor.rail}
      wideRail={touchTool === 'calibrate' ? calib.wideRail : touchTool === 'components' ? true : outlineEditor.wideRail}
      busy={touchTool === 'calibrate' ? calib.busy : touchTool === 'components' ? false : outlineEditor.busy}
      backHref={`/${workspaceSlug}/quotes/${quoteId}`}
      exitGuard={touchTool === 'calibrate' ? calib.exitGuard : touchTool === 'components' ? undefined : outlineEditor.exitGuard}
    >
      {workstation}
    </TouchWorkspaceShell>
  );
}
