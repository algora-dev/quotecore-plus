'use client';

/**
 * Free Roof Takeoff - v2 engine.
 *
 * Same product as the classic free tool (session-only, default components
 * or build your own, printout/download output, no AI scan) but running the
 * REAL app takeoff stack: TakeoffWorkstation + the mobile-first touch
 * precision subsystem, with persistence swapped to in-memory session state
 * via TakeoffSessionProvider (see app/lib/takeoff/actionsContext.tsx).
 *
 * Composition mirrors the app's TakeoffPage wiring (touch shell + desktop
 * host + calibration/outline/components hooks) so mobile and desktop behave
 * exactly like the testing app.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { TOOL_COLLECTIONS } from '@/app/(marketing)/takeoff-demo/demo-data/baseline';
import {
  ROOFING_TAKEOFF_CONFIG,
  EMPTY_SPEC,
  resolveUnitOption,
  type TakeoffTradeConfig,
  type TakeoffUnitSystem,
  type TakeoffPlaceholderComponent,
  type TakeoffComponentSpec,
  type TakeoffComponentChoice,
} from './tradeConfig';
import { TakeoffOutputView, type TakeoffOutputExtras, type TakeoffTrade } from './TakeoffOutputView';
import { ComponentBuilderModal } from './ComponentBuilderModal';
import { FreeTakeoffEntry } from './FreeTakeoffEntry';
import { AI_PLACEHOLDER_COMPONENTS } from './aiPlaceholders';
import { trackFreeToolEvent } from '../lib/trackFreeToolEvent';
import { usePdfPagePicker } from '@/app/components/PdfPagePicker';
import type { QuoteRow } from '@/app/lib/types';
import type { Calibration } from '@/app/lib/takeoff/reconstructTypes';
import type { AiScanData } from '@/app/lib/takeoff/applyAiResults';
import type { TakeoffHydrationData } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions';
import * as freeSessionActions from './freeSessionActions';
import { TakeoffSessionProvider, type TakeoffActionsBundle } from '@/app/lib/takeoff/actionsContext';
import type { TakeoffFinishPayload } from '@/app/lib/takeoff/finishPayload';
import { TouchWorkspaceShell } from '@/app/lib/takeoff/precision/TouchWorkspaceShell';
import { useTouchComponents } from '@/app/lib/takeoff/precision/useTouchComponents';
import { useTakeoffViewMode } from '@/app/lib/takeoff/precision/useTakeoffViewMode';
import {
  useTouchOutlineEditor,
  type TouchOutlineAdapter,
} from '@/app/lib/takeoff/precision/TouchOutlineEditor';
import {
  useTouchCalibration,
  type TouchCalibrationPageInfo,
} from '@/app/lib/takeoff/precision/TouchCalibrationWorkspace';
import { TakeoffDesktopHost } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/desktop/TakeoffDesktopHost';
import { decodeCalibrationMetadata } from '@/app/lib/takeoff/calibrationCodec';
import { DEFAULT_ROOF_PITCH } from '@/app/lib/takeoff/precision/touchNumberEntry';
import type { CalibrationCommitPayload } from '@/app/lib/takeoff/precision/touchCalibration';


function loadTakeoffWorkstation() {
  return import('@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation').then(
    (mod) => ({ default: mod.TakeoffWorkstation }),
  );
}

const TakeoffWorkstation = dynamic(loadTakeoffWorkstation, {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-sm">Loading canvas...</div>
    </div>
  ),
});

/** Kicks off the (large) workstation chunk download. Seeded hosts (the
 *  marketing demo) call this on mount so the takeoff canvas is warm by the
 *  time the user clicks in - visitors are measuring in ~5 seconds. */
export function prewarmTakeoffWorkstation() {
  void loadTakeoffWorkstation();
}

type Stage =
  | { phase: 'landing' }
  | {
      phase: 'takeoff';
      run: number;
      planDataUrl: string;
      startedAt: number;
      unitSystem: TakeoffUnitSystem;
      components: ToolComponent[];
      specs: TakeoffComponentSpec[];
    }
  | {
      phase: 'output';
      payload: TakeoffFinishPayload;
      run: number;
      planDataUrl: string;
      startedAt: number;
      finishedAt: number;
      unitSystem: TakeoffUnitSystem;
      components: ToolComponent[];
      specs: TakeoffComponentSpec[];
    };

type Device = 'desktop' | 'tablet' | 'mobile';

function detectDevice(): Device {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIpad || /Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet';
  if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return 'mobile';
  if (navigator.maxTouchPoints > 0 && window.innerWidth < 768) return 'mobile';
  return 'desktop';
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

interface ToolComponent {
  id: string;
  name: string;
  measurement_type?: string;
  collection_id?: string | null;
  is_system?: boolean;
}

// ─── Generic seeded entry (hosts pre-load a plan + captured state) ───────────

/** Component row a seed may preload. Same shape the workstation consumes;
 *  `is_system: true` rows are AI-scan targets, exactly like saved libraries. */
export interface FreeTakeoffSeedComponent {
  id: string;
  name: string;
  measurement_type?: string;
  collection_id?: string | null;
  is_system?: boolean;
}

/** Seed = everything a host wants to pre-load so visitors skip the wizard:
 *  a plan image, a baked calibration, an optional captured AI scan replay
 *  and optional component/collection overrides. Trade-agnostic - the
 *  marketing demo, embeds and future forks all use the same mechanism. */
export interface FreeTakeoffSeed {
  /** Plan image URL (same-origin or CORS-enabled; PNG/JPG/WebP up to 10 MB). */
  planUrl: string;
  /** Defaults to metric. */
  unitSystem?: TakeoffUnitSystem;
  /** Replaces the wizard's default component list when provided. */
  components?: FreeTakeoffSeedComponent[];
  /** Component collections for the selector (defaults to the shell's). */
  collections?: { id: string; name: string }[];
  /** Baked calibration - the exact shape saved sessions hydrate (Calibration[]). */
  calibration?: Calibration[];
  /** AI Assist points display override. */
  aiAssistPoints?: { used: number; limit: number; remaining: number; isBlocked: boolean };
  /** Captured AI scan replay: replaces every live endpoint scan and applies
   *  automatically once the canvas + calibration are ready. */
  autoScan?: { data: AiScanData; pitch?: number };
}

/** Stable id for the page the seeded plan is hydrated as. */
const SEED_PAGE_ID = 'seeded-page-1';

function toComponents(list: TakeoffPlaceholderComponent[]): ToolComponent[] {
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    measurement_type: c.measurement_type,
    // These are the free tool's real manual targets, not AI-only placeholders.
    // The workstation hides `is_system` components from manual selectors.
    is_system: false,
    collection_id: 'tool-builtin',
  }));
}

// NOTE (v1): double-cast keeps the build unblocked; hardening this to a
// direct structural match against TakeoffActionsBundle is a follow-up so any
// drift in the real action signatures fails loudly here instead.
const FREE_SESSION_BUNDLE = {
  ...freeSessionActions,
} as unknown as TakeoffActionsBundle;

// ─── Takeoff phase (mirrors the app's TakeoffPage composition) ──────────────

function TakeoffPhase({
  config,
  planDataUrl,
  unitSystem,
  components,
  collections = TOOL_COLLECTIONS,
  seed = null,
  onFinish,
  onExit,
}: {
  config: TakeoffTradeConfig;
  planDataUrl: string;
  unitSystem: TakeoffUnitSystem;
  components: ToolComponent[];
  collections?: { id: string; name: string }[];
  seed?: FreeTakeoffSeed | null;
  onFinish: (payload: TakeoffFinishPayload) => void;
  onExit: () => void;
}) {
  const unitOption = resolveUnitOption(unitSystem, config);

  const planLabel = `${config.planNoun[0].toUpperCase()}${config.planNoun.slice(1)} Plan`;
  const quote = useMemo<QuoteRow>(
    () =>
      ({
        id: 'tool-quote',
        company_id: 'tool-company',
        customer_name: planLabel,
        quote_number: 1,
        measurement_system: unitOption.lengthUnit === 'meters' ? 'metric' : 'imperial_ft',
        trade: config.tradeName,
        currency: 'NZD',
      }) as unknown as QuoteRow,
    [unitOption.lengthUnit, planLabel, config.tradeName],
  );

  // Touch-first: the free tool always ships the new engine (no server flag).
  const { mode, preference, setPreference } = useTakeoffViewMode(true);
  const touchActive = mode === 'mobile-touch';

  const [outlineAdapter, setOutlineAdapter] = useState<TouchOutlineAdapter | null>(null);
  const registerAdapter = useCallback((adapter: TouchOutlineAdapter) => setOutlineAdapter(adapter), []);
  const [, refreshBridge] = useState(0);
  useEffect(() => outlineAdapter?.subscribe?.(() => refreshBridge((n) => n + 1)), [outlineAdapter]);

  // Owner 2026-10-01: the free takeoff overlay is fixed inset-0; lock body
  // scroll while it is mounted so the landing page behind cannot scroll or
  // leak its position into document-based measures.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const backHref = `/${config.slug}`;
  // Pitch is a roofing-only input: non-pitch trades start at 0 (flat), which
  // also keeps every pitch-factor path neutral (0 = no adjustment applied).
  const [pitch, setPitch] = useState(config.requiresPitch ? DEFAULT_ROOF_PITCH : 0);
  const [resolvedPage1Id, setResolvedPage1Id] = useState<string | null>(null);
  const [confirmedCalibration, setConfirmedCalibration] = useState<{
    pageId: string;
    payload: CalibrationCommitPayload;
  } | null>(null);
  const activePageId =
    outlineAdapter?.getEditContext()?.pageId ?? resolvedPage1Id ?? null;

  const calibrationPage: TouchCalibrationPageInfo | null = useMemo(() => {
    if (!activePageId) return null;
    const acknowledged =
      confirmedCalibration?.pageId === activePageId ? confirmedCalibration.payload : null;
    return {
      id: activePageId,
      imageRevision: acknowledged?.metadata.imageRevision || null,
      calibrationMetadata: acknowledged?.metadata ?? null,
      scaleCalibration: acknowledged?.legacy ?? seed?.calibration ?? null,
    };
  }, [activePageId, confirmedCalibration, seed]);

  const pageHasDependents = (outlineAdapter?.getAreas().length ?? 0) > 0;

  const [touchTool, setTouchTool] = useState<'outline' | 'calibrate' | 'components'>(() => {
    // Seeded plans arrive pre-calibrated - visitors start at the outline.
    if (seed?.calibration) return 'outline';
    const decoded = decodeCalibrationMetadata(
      calibrationPage?.calibrationMetadata ?? calibrationPage?.scaleCalibration,
    );
    const count =
      decoded.kind === 'v1'
        ? decoded.metadata.references.length
        : decoded.kind === 'legacy'
          ? decoded.references.length
          : 0;
    return count > 0 ? 'outline' : 'calibrate';
  });
  const [componentsMode, setComponentsMode] = useState<'ai' | 'manual'>('manual');
  const enterComponents = useCallback((m: 'ai' | 'manual') => {
    setComponentsMode(m);
    setTouchTool('components');
  }, []);

  const onCommitted = useCallback((pageId: string, payload: CalibrationCommitPayload) => {
    setConfirmedCalibration({ pageId, payload });
  }, []);

  // Adopt the calibration ACK into the measurement owner (same race-safe
  // retry pattern as the app's TakeoffPage).
  useEffect(() => {
    if (!confirmedCalibration || !outlineAdapter) return;
    if (touchTool !== 'calibrate') return;
    if (
      outlineAdapter.applyConfirmedCalibration?.(
        confirmedCalibration.pageId,
        confirmedCalibration.payload,
      )
    ) {
      queueMicrotask(() => setTouchTool('outline'));
    }
  }, [confirmedCalibration, outlineAdapter, activePageId, touchTool]);

  // Free tool finish: pull the payload from the workstation's adapter.
  const emitFinish = useCallback(() => {
    const payload = outlineAdapter?.buildFinishPayload?.() ?? null;
    if (payload) {
      trackFreeToolEvent('finish');
      onFinish(payload);
    }
  }, [outlineAdapter, onFinish]);

  const calib = useTouchCalibration({
    active: touchActive && touchTool === 'calibrate',
    quoteId: quote.id,
    planUrl: outlineAdapter?.getImageUrl() ?? planDataUrl,
    page: calibrationPage,
    aiEnabled: false, // Free tool: manual calibration only.
    pageHasDependents,
    defaultWorkingUnit: unitOption.lengthUnit === 'meters' ? 'meters' : 'feet',
    onCommitted,
    onExit,
  });

  const outlineEditor = useTouchOutlineEditor(
    touchActive && touchTool === 'outline',
    () => outlineAdapter,
    backHref,
    () => setTouchTool('calibrate'),
    { pitch, onPitchChange: setPitch, onEnterComponents: enterComponents, onFinish: emitFinish,
      planNoun: config.planNoun, requiresPitch: config.requiresPitch,
      defaultAreaName: `Main ${config.planNoun[0].toUpperCase()}${config.planNoun.slice(1)}` },
  );

  const componentsStep = useTouchComponents(
    touchActive && touchTool === 'components',
    () => outlineAdapter,
    {
      mode: componentsMode,
      components,
      collections,
      finishHref: backHref,
      onFinish: emitFinish,
      planNoun: config.planNoun,
    },
  );

  // Seeded entry: hydrate the seeded plan as a saved-session page so the
  // real calibration-restoration path (P0-5) bakes the scale exactly like a
  // re-entered takeoff - calibrationConfirmed + suppressed entry popups.
  const seededHydration = useMemo<TakeoffHydrationData | null>(
    () =>
      seed
        ? {
            sessionId: null,
            sessionVersion: 1,
            pages: [
              {
                id: SEED_PAGE_ID,
                pageOrder: 1,
                pageName: null,
                imagePath: null,
                imageUrl: planDataUrl,
                scaleCalibration: seed.calibration ?? null,
                calibrationMetadata: null,
                imageRevision: null,
                aiScanResult: null,
              },
            ],
            measurements: [],
          }
        : null,
    [seed, planDataUrl],
  );

  // Captured scan replay: only when the host seeded one. autoRun fires the
  // replay the moment the canvas + baked calibration are ready.
  const seededScan = useMemo(
    () => (seed?.autoScan ? { data: seed.autoScan.data, pitch: seed.autoScan.pitch, autoRun: true } : undefined),
    [seed],
  );

  const workstation = (
    <TakeoffWorkstation
      desktopAppearance={!touchActive}
      workspaceSlug="free-tool"
      quote={quote}
      planUrl={planDataUrl}
      components={components}
      collections={collections}
      hydrationData={seededHydration}
      aiTakeoffAvailable={config.aiScan}
      aiAssistPoints={config.aiScan ? seed?.aiAssistPoints ?? null : null}
      seededScan={seededScan}
      aiCalibrationEnabled={false}
      onTouchOutlineAdapter={registerAdapter}
      onPage1Resolved={setResolvedPage1Id}
      onFreeFinish={onFinish}
      onExitFree={onExit}
    />
  );

  return (
    <TakeoffSessionProvider actions={FREE_SESSION_BUNDLE}>
      <TakeoffDesktopHost active={!touchActive} fill>
        <TouchWorkspaceShell
          active={touchActive}
          planLabel="Plan"
          railTitle={
            touchTool === 'calibrate' ? 'Calibration' : touchTool === 'components' ? 'Components' : 'Outline'
          }
          viewPreference={preference}
          onViewPreferenceChange={setPreference}
          overlay={
            touchTool === 'calibrate'
              ? calib.overlay
              : touchTool === 'components'
                ? componentsStep.overlay
                : outlineEditor.overlay
          }
          railContent={
            touchTool === 'calibrate'
              ? calib.rail
              : touchTool === 'components'
                ? componentsStep.rail
                : outlineEditor.rail
          }
          wideRail={
            touchTool === 'calibrate' ? calib.wideRail : touchTool === 'components' ? true : outlineEditor.wideRail
          }
          busy={
            touchTool === 'calibrate' ? calib.busy : touchTool === 'components' ? componentsStep.busy : outlineEditor.busy
          }
          backHref={backHref}
          exitGuard={
            touchTool === 'calibrate'
              ? calib.exitGuard
              : touchTool === 'components'
                ? {
                    dirty: componentsStep.busy || componentsStep.hasEntries,
                    onSave: () => {},
                    onDiscard: () => {
                      outlineAdapter?.clearComponentOverlay?.();
                      onExit();
                    },
                    saveLabel: 'Return to components',
                  }
                : outlineEditor.exitGuard
          }
        >
          {workstation}
        </TouchWorkspaceShell>
      </TakeoffDesktopHost>
    </TakeoffSessionProvider>
  );
}

// ─── Wizard + stage machine ─────────────────────────────────────────────────

export function FreeTakeoffApp({
  config = ROOFING_TAKEOFF_CONFIG,
  seed,
  onFinish,
  onExit,
}: {
  config?: TakeoffTradeConfig;
  /** Seeded entry: skips the wizard, fetches the plan to a data URL (the
   *  same path as handleFile) and jumps straight into the takeoff stage. */
  seed?: FreeTakeoffSeed;
  /** Host mode: when provided, the finished payload is emitted to the host
   *  instead of rendering the shell's own output view. */
  onFinish?: (payload: TakeoffFinishPayload) => void;
  /** Host mode: overrides the internal restart-on-exit behaviour. */
  onExit?: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ phase: 'landing' });
  const [orientationNoticeOpen, setOrientationNoticeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedState, setSeedState] = useState<'idle' | 'loading' | 'error'>(seed ? 'loading' : 'idle');
  const [seedError, setSeedError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [unitSystem, setUnitSystem] = useState<TakeoffUnitSystem>('metric');
  const [componentChoice, setComponentChoice] = useState<TakeoffComponentChoice>('ours');
  const [specs, setSpecs] = useState<TakeoffComponentSpec[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);

  // Rotate-for-canvas notice (2026-10-04): the setup wizard is comfortable in
  // portrait, so the notice now opens only when the user actually ENTERS the
  // measuring canvas (stage 'takeoff') - once per visit, no re-entry nagging.
  const orientationShownRef = useRef(false);
  useEffect(() => {
    if (stage.phase !== 'takeoff' || orientationShownRef.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (detectDevice() === 'mobile') {
      orientationShownRef.current = true;
      setOrientationNoticeOpen(true);
    }
  }, [stage.phase]);

  // Seeded entry: fetch the plan image, convert it to a data URL (the same
  // path as handleFile) and jump straight to the takeoff stage. Applied once
  // per mount - hosts keep the seed object referentially stable.
  const seedAppliedRef = useRef(false);
  useEffect(() => {
    if (!seed || seedAppliedRef.current) return;
    seedAppliedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(seed.planUrl);
        if (!response.ok) throw new Error(`Could not load the plan image (HTTP ${response.status}).`);
        const blob = await response.blob();
        if (blob.size > MAX_IMAGE_BYTES) throw new Error('Plan image too large - maximum 10 MB.');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Could not read the plan image.'));
          reader.readAsDataURL(blob);
        });
        if (cancelled) return;
        setStage({
          phase: 'takeoff',
          run: 1,
          planDataUrl: dataUrl,
          startedAt: Date.now(),
          unitSystem: seed.unitSystem ?? 'metric',
          components: (seed.components ?? toolComponents) as ToolComponent[],
          specs: [],
        });
        setSeedState('idle');
      } catch (err) {
        if (cancelled) return;
        setSeedError(err instanceof Error ? err.message : 'Could not start the seeded takeoff.');
        setSeedState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // toolComponents is the no-override default, captured once at apply time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const openBuilder = () => {
    setEditingSpecId(null);
    setBuilderOpen(true);
  };
  const openEditBuilder = (id: string) => {
    setEditingSpecId(id);
    setBuilderOpen(true);
  };
  const handleBuilderSave = (spec: TakeoffComponentSpec, isNew: boolean) => {
    setSpecs((prev) => (isNew ? [...prev, spec] : prev.map((s) => (s.id === spec.id ? spec : s))));
    setBuilderOpen(false);
  };

  // 'edit-standard' starts from the trade's standard set, editable like 'own'.
  // Seeded only while the list is empty so edits survive step navigation.
  const handleChoiceChange = (choice: TakeoffComponentChoice) => {
    setComponentChoice(choice);
    if (choice === 'edit-standard' && specs.length === 0) {
      setSpecs(config.placeholderComponents.map((c, index) => ({
        id: `custom-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: c.name,
        ...EMPTY_SPEC,
        measurementType: c.measurement_type,
        pitchEnabled: config.requiresPitch && c.measurement_type === 'area',
      })));
    }
  };

  const unitOption = resolveUnitOption(unitSystem, config);

  const specComponents = useMemo<ToolComponent[]>(
    () =>
      componentChoice === 'ours'
        ? []
        : specs.map((s) => ({
            id: s.id,
            name: s.name,
            measurement_type: s.measurementType,
            is_system: false,
            collection_id: 'tool-custom',
          })),
    [componentChoice, specs],
  );

  const userComponents = useMemo<ToolComponent[]>(
    () => [...(componentChoice === 'ours' ? toComponents(config.placeholderComponents) : []), ...specComponents],
    [componentChoice, specComponents, config],
  );

  // Keep AI-only system rows alongside the real manual targets. The
  // workstation hides these from manual pickers but requires them to apply
  // AI results and support the existing reassign/review flow. Roof-trained
  // placeholders are appended only for trades whose config offers the scan.
  const toolComponents = useMemo<ToolComponent[]>(
    () => (config.aiScan ? [...userComponents, ...AI_PLACEHOLDER_COMPONENTS] : userComponents),
    [userComponents, config],
  );

  // Seeded runs thread the seed (calibration, scan replay, collections)
  // through every takeoff stage entry.
  const activeSeed = seed ?? null;
  const seedCollections = seed?.collections;

  const activeSpecs = useMemo(() => (componentChoice === 'ours' ? [] : specs), [componentChoice, specs]);

  const pdfPicker = usePdfPagePicker();

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!ACCEPTED.includes(file.type)) {
        setError('Please upload a PNG, JPG or WebP image of your plan.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError('Image too large - maximum 10 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        trackFreeToolEvent('start-takeoff');
        setStage((prev) => {
          const run = prev.phase === 'landing' ? 1 : (prev.run ?? 0) + 1;
          return {
            phase: 'takeoff',
            run,
            planDataUrl: dataUrl,
            startedAt: Date.now(),
            unitSystem,
            components: toolComponents,
            specs: activeSpecs,
          };
        });
      };
      reader.onerror = () => setError('Could not read that image. Try a different file.');
      reader.readAsDataURL(file);
    },
    [unitSystem, toolComponents, activeSpecs],
  );

  const onFileSelected = useCallback(
    async (raw: File) => {
      setError(null);
      const isPdf = raw.type === 'application/pdf' || /\.pdf$/i.test(raw.name);
      if (isPdf) {
        if (raw.size > 50 * 1024 * 1024) {
          setError('PDF too large - maximum 50 MB.');
          return;
        }
        const converted = await pdfPicker.convertIfNeeded(raw);
        if (!converted) return; // user cancelled the page picker
        handleFile(converted);
      } else {
        handleFile(raw);
      }
    },
    [pdfPicker, handleFile],
  );

  // One-tap example plan (2026-10-04, mobile-first): loads the shared sample
  // plan straight into the tool through the same File path as a user upload -
  // no iOS download round-trip through Files/Photos, no re-upload.
  const EXAMPLE_PLAN_URL = '/takeoff-demo/roofplan-baseline.png';
  const [exampleLoading, setExampleLoading] = useState(false);
  const handleExamplePlan = useCallback(async () => {
    if (exampleLoading) return;
    setExampleLoading(true);
    setError(null);
    try {
      const response = await fetch(EXAMPLE_PLAN_URL);
      if (!response.ok) throw new Error(`Could not load the example plan (HTTP ${response.status}).`);
      const blob = await response.blob();
      if (blob.size > MAX_IMAGE_BYTES) throw new Error('The example plan is too large to load.');
      await onFileSelected(new File([blob], 'example-roof-plan.png', { type: 'image/png' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the example plan. Please try again.');
    } finally {
      setExampleLoading(false);
    }
  }, [exampleLoading, onFileSelected]);

  const restart = useCallback(() => {
    setStage({ phase: 'landing' });
    setStep(1);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  // Host-mode exits go to the host; the internal default restarts the wizard.
  const exitToStart = onExit ?? restart;

  // Seeded entry splash: while the plan downloads the wizard is NOT shown
  // (seeded visitors skip it entirely); a failed load gets a clean retry path.
  if (seed && seedState === 'loading' && stage.phase === 'landing') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#FF6B35]" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading plan…</p>
        </div>
      </div>
    );
  }
  if (seed && seedState === 'error' && stage.phase === 'landing') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <h2 className="text-base font-semibold text-slate-900">Could not load the plan</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{seedError}</p>
          <button
            onClick={exitToStart}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (stage.phase === 'output') {
    const extras: TakeoffOutputExtras = {
      planDataUrl: stage.planDataUrl,
      elapsedMs: stage.finishedAt - stage.startedAt,
    };
    return (
      <TakeoffOutputView
        trade={config.tradeName as TakeoffTrade}
        reportNote={config.reportNote}
        payload={{ ...stage.payload, unitSystem: stage.unitSystem, componentSpecs: stage.specs }}
        extras={extras}
        unitSystem={stage.unitSystem}
        specs={stage.specs}
        onRestart={restart}
        onBackToCanvas={() =>
          setStage({
            phase: 'takeoff',
            run: stage.run + 1,
            planDataUrl: stage.planDataUrl,
            startedAt: stage.startedAt,
            unitSystem: stage.unitSystem,
            components: stage.components,
            specs: stage.specs,
          })
        }
      />
    );
  }

  if (stage.phase === 'takeoff') {
    // Full-screen like the app's takeoff page: the workstation's own header
    // provides the chrome; marketing page furniture is covered while measuring.
    return (
      <div className="fixed inset-0 z-40 overflow-hidden flex flex-col bg-slate-50">
        <TakeoffPhase
          key={stage.run}
          config={config}
          planDataUrl={stage.planDataUrl}
          unitSystem={stage.unitSystem}
          components={stage.components}
          collections={seedCollections}
          seed={activeSeed}
          onFinish={(payload) => {
            if (onFinish) {
              // Host mode: the host owns the finished-takeoff presentation
              // (the demo maps the payload into its own quote view).
              onFinish(payload);
              return;
            }
            setStage({
              phase: 'output',
              payload,
              run: stage.run,
              planDataUrl: stage.planDataUrl,
              startedAt: stage.startedAt,
              finishedAt: Date.now(),
              unitSystem: stage.unitSystem,
              components: stage.components,
              specs: stage.specs,
            });
            if (typeof window !== 'undefined') window.scrollTo(0, 0);
          }}
          onExit={exitToStart}
        />
      </div>
    );
  }

  // The entry presentation consumes existing state; the measuring owner above
  // is deliberately unchanged (including the stable desktop/touch bridge).
  return <FreeTakeoffEntry config={config} step={step} unitSystem={unitSystem} unitOption={unitOption}
    componentChoice={componentChoice} specs={specs} componentCount={userComponents.length} error={error}
    orientationNoticeOpen={orientationNoticeOpen} onDismissOrientation={() => setOrientationNoticeOpen(false)}
    onUnitChange={setUnitSystem} onChoiceChange={handleChoiceChange}
    onBack={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2)}
    onContinue={() => setStep(step === 1 ? 2 : 3)}
    onCreateComponent={openBuilder} onEditComponent={openEditBuilder}
    onRemoveComponent={id => setSpecs(prev => prev.filter(spec => spec.id !== id))}
    onFile={onFileSelected} onExamplePlan={handleExamplePlan} exampleLoading={exampleLoading}
    pdfModal={pdfPicker.modal}>
    {builderOpen && <ComponentBuilderModal key={editingSpecId ?? 'new'}
      initial={editingSpecId ? specs.find((s) => s.id === editingSpecId) ?? null : null}
      measurementSystem={unitOption.lengthUnit === 'meters' ? 'metric' : 'imperial_ft'}
      trade={config.tradeName as 'roofing' | 'cladding' | 'flooring'}
      showPitchRules={config.requiresPitch}
      onSave={handleBuilderSave} onClose={() => setBuilderOpen(false)} />}
  </FreeTakeoffEntry>;
}
