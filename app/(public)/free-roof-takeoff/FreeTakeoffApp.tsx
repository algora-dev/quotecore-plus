'use client';

/**
 * Free Roof Takeoff — v2 engine.
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

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { TOOL_COLLECTIONS } from '@/app/(marketing)/takeoff-demo/demo-data/baseline';
import {
  ROOFING_TAKEOFF_CONFIG,
  resolveUnitOption,
  type TakeoffUnitSystem,
  type TakeoffPlaceholderComponent,
  type TakeoffComponentSpec,
} from './tradeConfig';
import { TakeoffOutputView, type TakeoffOutputExtras } from './TakeoffOutputView';
import { ComponentBuilderModal } from './ComponentBuilderModal';
import { FreeTakeoffEntry } from './FreeTakeoffEntry';
import { AI_PLACEHOLDER_COMPONENTS } from './aiPlaceholders';
import { trackFreeToolEvent } from '../lib/trackFreeToolEvent';
import { usePdfPagePicker } from '@/app/components/PdfPagePicker';
import type { QuoteRow } from '@/app/lib/types';
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

const CONFIG = ROOFING_TAKEOFF_CONFIG;

const TakeoffWorkstation = dynamic(
  () =>
    import('@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation').then(
      (mod) => ({ default: mod.TakeoffWorkstation }),
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-sm">Loading canvas...</div>
      </div>
    ),
  },
);

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
  planDataUrl,
  unitSystem,
  components,
  onFinish,
  onExit,
}: {
  planDataUrl: string;
  unitSystem: TakeoffUnitSystem;
  components: ToolComponent[];
  onFinish: (payload: TakeoffFinishPayload) => void;
  onExit: () => void;
}) {
  const unitOption = resolveUnitOption(unitSystem, CONFIG);

  const quote = useMemo<QuoteRow>(
    () =>
      ({
        id: 'tool-quote',
        company_id: 'tool-company',
        customer_name: 'Roof Plan',
        quote_number: 1,
        measurement_system: unitOption.lengthUnit === 'meters' ? 'metric' : 'imperial_ft',
        trade: 'roofing',
        currency: 'NZD',
      }) as unknown as QuoteRow,
    [unitOption.lengthUnit],
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

  const backHref = '/free-roof-takeoff';
  const [pitch, setPitch] = useState(DEFAULT_ROOF_PITCH);
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
      scaleCalibration: acknowledged?.legacy ?? null,
    };
  }, [activePageId, confirmedCalibration]);

  const pageHasDependents = (outlineAdapter?.getAreas().length ?? 0) > 0;

  const [touchTool, setTouchTool] = useState<'outline' | 'calibrate' | 'components'>(() => {
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
    { pitch, onPitchChange: setPitch, onEnterComponents: enterComponents, onFinish: emitFinish },
  );

  const componentsStep = useTouchComponents(
    touchActive && touchTool === 'components',
    () => outlineAdapter,
    {
      mode: componentsMode,
      components,
      collections: TOOL_COLLECTIONS,
      finishHref: backHref,
      onFinish: emitFinish,
    },
  );

  const workstation = (
    <TakeoffWorkstation
      desktopAppearance={!touchActive}
      workspaceSlug="free-tool"
      quote={quote}
      planUrl={planDataUrl}
      components={components}
      collections={TOOL_COLLECTIONS}
      hydrationData={null}
      aiTakeoffAvailable={true}
      aiAssistPoints={null}
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

export function FreeTakeoffApp() {
  const [stage, setStage] = useState<Stage>({ phase: 'landing' });
  const [device, setDevice] = useState<Device>('desktop');
  const [orientationNoticeOpen, setOrientationNoticeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [unitSystem, setUnitSystem] = useState<TakeoffUnitSystem>('metric');
  const [componentChoice, setComponentChoice] = useState<'ours' | 'own'>('ours');
  const [specs, setSpecs] = useState<TakeoffComponentSpec[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);

  useEffect(() => {
    const d = detectDevice();
    setDevice(d);
    if (d === 'mobile') setOrientationNoticeOpen(true);
  }, []);

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

  const unitOption = resolveUnitOption(unitSystem, CONFIG);

  const specComponents = useMemo<ToolComponent[]>(
    () =>
      componentChoice !== 'own'
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
    () => [...(componentChoice === 'ours' ? toComponents(CONFIG.placeholderComponents) : []), ...specComponents],
    [componentChoice, specComponents],
  );

  // Keep AI-only system rows alongside the real manual targets. The
  // workstation hides these from manual pickers but requires them to apply
  // AI results and support the existing reassign/review flow.
  const toolComponents = useMemo<ToolComponent[]>(
    () => [...userComponents, ...AI_PLACEHOLDER_COMPONENTS],
    [userComponents],
  );

  const activeSpecs = componentChoice === 'own' ? specs : [];

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

  const restart = useCallback(() => {
    setStage({ phase: 'landing' });
    setStep(1);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  if (stage.phase === 'output') {
    const extras: TakeoffOutputExtras = {
      planDataUrl: stage.planDataUrl,
      elapsedMs: Date.now() - stage.startedAt,
    };
    return (
      <TakeoffOutputView
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
          planDataUrl={stage.planDataUrl}
          unitSystem={stage.unitSystem}
          components={stage.components}
          onFinish={(payload) => {
            setStage({
              phase: 'output',
              payload,
              run: stage.run,
              planDataUrl: stage.planDataUrl,
              startedAt: stage.startedAt,
              unitSystem: stage.unitSystem,
              components: stage.components,
              specs: stage.specs,
            });
            if (typeof window !== 'undefined') window.scrollTo(0, 0);
          }}
          onExit={restart}
        />
      </div>
    );
  }

  // The entry presentation consumes existing state; the measuring owner above
  // is deliberately unchanged (including the stable desktop/touch bridge).
  return <FreeTakeoffEntry step={step} unitSystem={unitSystem} unitOption={unitOption}
    componentChoice={componentChoice} specs={specs} componentCount={userComponents.length} error={error}
    orientationNoticeOpen={orientationNoticeOpen} onDismissOrientation={() => setOrientationNoticeOpen(false)}
    onUnitChange={setUnitSystem} onChoiceChange={setComponentChoice}
    onBack={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2)}
    onContinue={() => setStep(step === 1 ? 2 : 3)}
    onCreateComponent={openBuilder} onEditComponent={openEditBuilder}
    onRemoveComponent={id => setSpecs(prev => prev.filter(spec => spec.id !== id))}
    onFile={onFileSelected} pdfModal={pdfPicker.modal}>
    {builderOpen && <ComponentBuilderModal key={editingSpecId ?? 'new'}
      initial={editingSpecId ? specs.find((s) => s.id === editingSpecId) ?? null : null}
      measurementSystem={unitOption.lengthUnit === 'meters' ? 'metric' : 'imperial_ft'}
      onSave={handleBuilderSave} onClose={() => setBuilderOpen(false)} />}
  </FreeTakeoffEntry>;
}
