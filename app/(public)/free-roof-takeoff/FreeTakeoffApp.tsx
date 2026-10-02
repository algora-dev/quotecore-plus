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
import Link from 'next/link';
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

  const stepIndicator = (
    <div className="flex items-center gap-2">
      {([1, 2, 3] as const).map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              n === step ? 'bg-black text-white' : n < step ? 'bg-[#FF6B35] text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {n < step ? '\u2713' : n}
          </div>
          {n < 3 && <div className={`w-8 h-0.5 ${n < step ? 'bg-[#FF6B35]' : 'bg-slate-100'}`} />}
        </div>
      ))}
    </div>
  );

  const stepTitle =
    step === 1 ? 'Choose your measurement unit' : step === 2 ? 'Choose your components' : 'Upload your roof plan';

  // Landing wizard
  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center px-4 py-16">
      {orientationNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-base font-semibold text-slate-900">Measure on your phone</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                This tool works on mobile - rotate your phone to landscape for the most accurate
                measuring. You can also continue in portrait or open this page on a desktop.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => setOrientationNoticeOpen(false)}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-lg p-8 md:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Free takeoff tool</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">Measure your own roof plan</p>
        <p className="mt-1 text-sm font-medium text-[#BD4A1A]">The QuoteCore Plus Free Roof Takeoff tool - free, no signup required.</p>
        <div className="mt-4 flex items-center justify-between">
          {stepIndicator}
          {step > 1 && (
            <button onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2)} className="text-sm text-slate-500 hover:text-slate-800">
              Back
            </button>
          )}
        </div>
        <h2 className="mt-5 text-base font-semibold text-slate-800">{stepTitle}</h2>

        {step === 1 && (
          <div className="mt-4 space-y-3">
            {CONFIG.unitOptions.map((o) => (
              <label
                key={o.value}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  unitSystem === o.value ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="unit-system"
                  checked={unitSystem === o.value}
                  onChange={() => setUnitSystem(o.value)}
                  className="mt-0.5 w-4 h-4 accent-orange-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{o.label}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{o.description}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-slate-400">
              Imperial and Roofing Squares users can enter roof pitch as either an angle (degrees) or a ratio (e.g. 6:12).
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-4 w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                componentChoice === 'ours' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="component-choice"
                checked={componentChoice === 'ours'}
                onChange={() => setComponentChoice('ours')}
                className="mt-0.5 w-4 h-4 accent-orange-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Use our roofing components</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Ridge, Hip, Valley, Barge, Spouting, Roof Area (no pricing) - standard placeholders
                </span>
              </span>
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                componentChoice === 'own' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="component-choice"
                checked={componentChoice === 'own'}
                onChange={() => setComponentChoice('own')}
                className="mt-0.5 w-4 h-4 accent-orange-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Build your own components</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Same component builder as the app - name, measurement type, rates, pricing, waste and pitch. Up to {CONFIG.maxCustomComponents}.
                </span>
              </span>
            </label>

            {componentChoice === 'own' && (
              <div className="pt-2 border-t border-slate-100">
                {specs.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {specs.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-orange-200 hover:bg-orange-50/40">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">
                            {s.measurementType === 'lineal' ? 'Lineal' : s.measurementType === 'area' ? 'Area' : 'Quantity'}
                            {s.materialRate > 0 || s.labourRate > 0 ? ` - $${s.materialRate} mat / $${s.labourRate} labour` : ''}
                            {s.wasteType !== 'none' ? ` - waste ${s.wasteType === 'percent' ? s.wasteValue + '%' : s.wasteValue}` : ''}
                            {s.pitchEnabled ? ' - pitch calc' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditBuilder(s.id)} className="text-xs text-slate-500 hover:text-slate-800">Edit</button>
                          <button onClick={() => setSpecs((prev) => prev.filter((x) => x.id !== s.id))} className="text-xs text-slate-400 hover:text-[#BD4A1A]">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {specs.length < CONFIG.maxCustomComponents ? (
                  <button
                    onClick={openBuilder}
                    className="w-full px-3 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-[#FF6B35] hover:bg-orange-50/40 text-sm text-gray-600 hover:text-gray-800 transition-all"
                  >
                    + Create component {specs.length > 0 ? `(${specs.length}/${CONFIG.maxCustomComponents})` : ''}
                  </button>
                ) : (
                  <p className="text-xs text-slate-400 text-center">
                    {CONFIG.maxCustomComponents} components max - a free account saves unlimited components permanently.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => setStep(3)}
              disabled={userComponents.length === 0}
              className="w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
            >
              Continue
            </button>
            {userComponents.length === 0 && (
              <p className="text-xs text-[#BD4A1A] text-center">Build at least one component to continue.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mt-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Unit: <span className="font-semibold text-slate-800">{unitOption.label}</span> &middot; Components:{' '}
              <span className="font-semibold text-slate-800">{userComponents.length}</span>
              {componentChoice === 'own' && <> (your own{specs.length > 0 ? `, ${specs.length} built` : ''})</>}
            </div>
            <label
              className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-12 cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFileSelected(f);
              }}
            >
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <span className="mt-3 text-sm font-medium text-slate-700">Click to upload your plan image or PDF</span>
              <span className="mt-1 text-xs text-slate-400">PNG, JPG, WebP up to 10 MB - PDF up to 50 MB (pick a page)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFileSelected(f);
                }}
              />
            </label>
            {error && <p className="mt-2 text-sm text-[#BD4A1A]">{error}</p>}

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">For best results, your plan should be:</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li className="flex gap-2"><span className="text-[#BD4A1A]">&#10003;</span>High quality and clear, with straight, sharp lines</li>
                <li className="flex gap-2"><span className="text-[#BD4A1A]">&#10003;</span>Square to the page (lines running at 90 degrees)</li>
                <li className="flex gap-2"><span className="text-[#BD4A1A]">&#10003;</span>Showing at least one clear, obvious measurement (e.g. a wall or ridge length) you can use to calibrate the scale</li>
              </ul>
            </div>
          </div>
        )}

        {builderOpen && (
          <ComponentBuilderModal
            key={editingSpecId ?? 'new'}
            initial={editingSpecId ? specs.find((s) => s.id === editingSpecId) ?? null : null}
            measurementSystem={unitOption.lengthUnit === 'meters' ? 'metric' : 'imperial_ft'}
            onSave={handleBuilderSave}
            onClose={() => setBuilderOpen(false)}
          />
        )}

        <p className="mt-6 text-xs text-slate-400">
          Works on mobile (landscape) and desktop - the same measuring engine as the QuoteCore+ app.
          Manual measuring only - no AI scan in this free tool. Nothing is saved unless you choose to
          send the result into the app.
        </p>

        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
          <Link href="/takeoff-demo" className="text-sm text-slate-500 hover:text-slate-800">
            No plan handy? Try the demo with a sample plan
          </Link>
        </div>
      </div>

      {pdfPicker.modal}
    </div>
  );
}
