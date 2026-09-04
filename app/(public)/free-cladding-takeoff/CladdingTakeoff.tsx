'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { TOOL_COLLECTIONS, DEMO_AI_POINTS } from '@/app/(marketing)/takeoff-demo/demo-data/baseline';
import {
  CLADDING_TAKEOFF_CONFIG,
  resolveUnitOption,
  type TakeoffUnitSystem,
  type TakeoffPlaceholderComponent,
  type TakeoffComponentSpec,
} from '../free-roof-takeoff/tradeConfig';
import type { DemoFinishPayload } from '@/app/(marketing)/takeoff-demo/DemoWorkstation';
import { TakeoffOutputView, type TakeoffOutputExtras } from '../free-roof-takeoff/TakeoffOutputView';
import { ComponentBuilderModal } from '../free-roof-takeoff/ComponentBuilderModal';
import { usePdfPagePicker } from '@/app/components/PdfPagePicker';
import { trackFreeToolEvent } from '../lib/trackFreeToolEvent';
import type { QuoteRow } from '@/app/lib/types';

/**
 * Free Wall & Cladding Takeoff tool.
 *
 * Same engine + wizard as the free roof takeoff (DemoWorkstation +
 * TakeoffOutputView + ComponentBuilderModal are REUSED, never forked). The only
 * differences are the trade config below (cladding components, no pitch) and
 * wall-facing copy. Terminology: walls / wall areas - never roof.
 */

// Fabric.js + the full workstation load ONLY when the user enters the tool.
const Workstation = dynamic(
  () => import('@/app/(marketing)/takeoff-demo/DemoWorkstation').then(mod => ({ default: mod.DemoWorkstation })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-sm">Loading canvas...</div>
      </div>
    ),
  }
);

type Stage =
  | { phase: 'landing' }
  | { phase: 'takeoff'; run: number; planDataUrl: string; startedAt: number; unitSystem: TakeoffUnitSystem; components: ToolComponent[]; specs: TakeoffComponentSpec[] }
  | { phase: 'output'; payload: DemoFinishPayload; run: number; planDataUrl: string; startedAt: number; unitSystem: TakeoffUnitSystem; components: ToolComponent[]; specs: TakeoffComponentSpec[] };

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

const CONFIG = CLADDING_TAKEOFF_CONFIG;

/** Minimal component shape the workstation accepts (mirrors its local interface). */
interface ToolComponent {
  id: string;
  name: string;
  measurement_type?: string;
  collection_id?: string | null;
  is_system?: boolean;
}

function toComponents(list: TakeoffPlaceholderComponent[]): ToolComponent[] {
  return list.map(c => ({
    id: c.id,
    name: c.name,
    measurement_type: c.measurement_type,
    is_system: true,
    collection_id: 'tool-builtin',
  }));
}

export function CladdingTakeoff() {
  const [stage, setStage] = useState<Stage>({ phase: 'landing' });
  const [device, setDevice] = useState<Device>('desktop');
  const [deviceNoticeOpen, setDeviceNoticeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wizard state (step 1: unit, step 2: components, step 3: upload)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [unitSystem, setUnitSystem] = useState<TakeoffUnitSystem>('metric');
  // Step 2 choice: 'ours' = placeholder set, 'own' = build up to 7 custom components.
  const [componentChoice, setComponentChoice] = useState<'ours' | 'own'>('ours');
  const [specs, setSpecs] = useState<TakeoffComponentSpec[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);

  useEffect(() => {
    const d = detectDevice();
    setDevice(d);
    if (d !== 'desktop') setDeviceNoticeOpen(true);
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
    setSpecs(prev => (isNew ? [...prev, spec] : prev.map(s => (s.id === spec.id ? spec : s))));
    setBuilderOpen(false);
  };

  const unitOption = resolveUnitOption(unitSystem, CONFIG);

  const specComponents = useMemo<ToolComponent[]>(
    () =>
      componentChoice !== 'own'
        ? []
        : specs.map(s => ({
            id: s.id,
            name: s.name,
            measurement_type: s.measurementType,
            is_system: false,
            collection_id: 'tool-custom',
          })),
    [componentChoice, specs]
  );

  const toolComponents = useMemo<ToolComponent[]>(
    () => [...(componentChoice === 'ours' ? toComponents(CONFIG.placeholderComponents) : []), ...specComponents],
    [componentChoice, specComponents]
  );

  const activeSpecs = componentChoice === 'own' ? specs : [];

  const TOOL_QUOTE = useMemo(
    () =>
      ({
        id: 'tool-quote',
        company_id: 'tool-company',
        customer_name: 'Wall Plan',
        quote_number: 1,
        measurement_system: unitOption.lengthUnit === 'meters' ? 'metric' : 'imperial_ft',
        trade: 'cladding',
        currency: 'NZD',
      }) as unknown as QuoteRow,
    [unitOption.lengthUnit]
  );

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
        setStage(prev => {
          const run = prev.phase === 'landing' ? 1 : (prev.run ?? 0) + 1;
          return { phase: 'takeoff', run, planDataUrl: dataUrl, startedAt: Date.now(), unitSystem, components: toolComponents, specs: activeSpecs };
        });
      };
      reader.onerror = () => setError('Could not read that image. Try a different file.');
      reader.readAsDataURL(file);
    },
    [unitSystem, toolComponents, activeSpecs]
  );

  // PDF support: convert the chosen page to a PNG client-side, then run the
  // normal image flow. PDFs get a higher size limit because only one page
  // is ultimately converted and used.
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
    [pdfPicker, handleFile]
  );

  const restart = useCallback(() => {
    setStage({ phase: 'landing' });
    setStep(1);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  if (stage.phase === 'output') {
    const extras: TakeoffOutputExtras = { planDataUrl: stage.planDataUrl, elapsedMs: Date.now() - stage.startedAt };
    return (
      <TakeoffOutputView
        payload={stage.payload}
        extras={extras}
        unitSystem={stage.unitSystem}
        specs={stage.specs}
        trade="cladding"
        onRestart={restart}
        onBackToCanvas={() =>
          setStage({ phase: 'takeoff', run: stage.run + 1, planDataUrl: stage.planDataUrl, startedAt: stage.startedAt, unitSystem: stage.unitSystem, components: stage.components, specs: stage.specs })
        }
      />
    );
  }

  if (stage.phase === 'takeoff') {
    return (
      <div className="mx-auto max-w-5xl px-4">
        <div className="w-[125%] -ml-[12.5%]">
          <Workstation
          key={stage.run}
          workspaceSlug="takeoff-tool"
          quote={TOOL_QUOTE}
          planUrl={stage.planDataUrl}
          components={stage.components}
          collections={TOOL_COLLECTIONS}
          hydrationData={null}
          aiTakeoffAvailable={false}
          aiAssistPoints={DEMO_AI_POINTS}
          demoMode="upload"
          onExitToStart={restart}
          preferredLengthUnit={unitOption.lengthUnit}
          unitSystem={stage.unitSystem}
          componentSpecs={stage.specs}
          guideTrade="cladding"
          onFinish={payload => {
            trackFreeToolEvent('finish');
            setStage({ phase: 'output', payload, run: stage.run, planDataUrl: stage.planDataUrl, startedAt: stage.startedAt, unitSystem: stage.unitSystem, components: stage.components, specs: stage.specs });
          }}
                />
        </div>
      </div>
    );
  }

  const stepIndicator = (
    <div className="flex items-center gap-2">
      {([1, 2, 3] as const).map(n => (
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
    step === 1 ? 'Choose your measurement unit' : step === 2 ? 'Choose your components' : 'Upload your plan';

  // Landing wizard
  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center px-4 py-16">
      {deviceNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-base font-semibold text-slate-900">
                {device === 'mobile' ? 'Not available on mobile' : 'Not optimized for tablets'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {device === 'mobile'
                  ? 'This takeoff tool needs a desktop computer - the precision measuring tools do not work on a phone screen. Open this page on a desktop to use it.'
                  : 'You can use this tool on a tablet, but it is not optimized - touch input is less accurate for placing points. For the best experience, use a desktop computer.'}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => setDeviceNoticeOpen(false)}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
                >
                  {device === 'mobile' ? 'Close' : 'Continue anyway'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-lg p-8 md:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Free takeoff tool</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">Measure your own wall plan</p>
        <p className="mt-1 text-sm font-medium text-[#BD4A1A]">The QuoteCore Plus Free Wall &amp; Cladding Takeoff tool — free, no signup required.</p>
        <div className="mt-4 flex items-center justify-between">
          {stepIndicator}
          {step > 1 && (
            <button onClick={() => setStep(s => (s === 3 ? 2 : 1) as 1 | 2)} className="text-sm text-slate-500 hover:text-slate-800">
              Back
            </button>
          )}
        </div>
        <h2 className="mt-5 text-base font-semibold text-slate-800">{stepTitle}</h2>

        {step === 1 && (
          <div className="mt-4 space-y-3">
            {CONFIG.unitOptions.map(o => (
              <label
                key={o.value}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  unitSystem === o.value ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="unit-system-cladding"
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
              Wall areas are measured as drawn - straight off your elevation or plan. No pitch to worry about.
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
            {/* Option A: our placeholders */}
            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                componentChoice === 'ours' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="component-choice-cladding"
                checked={componentChoice === 'ours'}
                onChange={() => setComponentChoice('ours')}
                className="mt-0.5 w-4 h-4 accent-orange-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Use our cladding components</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Building Wrap, Cavity Battens, Horizontal Cladding (Cedar / Corrugate), Window &amp; Door Trim, Corner Trims, Soffit, Openings (no pricing) - standard placeholders
                </span>
              </span>
            </label>

            {/* Option B: build your own */}
            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                componentChoice === 'own' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="component-choice-cladding"
                checked={componentChoice === 'own'}
                onChange={() => setComponentChoice('own')}
                className="mt-0.5 w-4 h-4 accent-orange-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Build your own components</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Same component builder as the app - name, measurement type, rates, pricing and waste. Works for any wall or cladding material. Up to {CONFIG.maxCustomComponents}.
                </span>
              </span>
            </label>

            {componentChoice === 'own' && (
              <div className="pt-2 border-t border-slate-100">
                {specs.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {specs.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-orange-200 hover:bg-orange-50/40">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">
                            {s.measurementType === 'lineal' ? 'Lineal' : s.measurementType === 'area' ? 'Area' : 'Quantity'}
                            {s.materialRate > 0 || s.labourRate > 0 ? ` - $${s.materialRate} mat / $${s.labourRate} labour` : ''}
                            {s.wasteType !== 'none' ? ` - waste ${s.wasteType === 'percent' ? s.wasteValue + '%' : s.wasteValue}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditBuilder(s.id)} className="text-xs text-slate-500 hover:text-slate-800">Edit</button>
                          <button onClick={() => setSpecs(prev => prev.filter(x => x.id !== s.id))} className="text-xs text-slate-400 hover:text-[#BD4A1A]">Remove</button>
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
              disabled={toolComponents.length === 0}
              className="w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
            >
              Continue
            </button>
            {toolComponents.length === 0 && (
              <p className="text-xs text-[#BD4A1A] text-center">Build at least one component to continue.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mt-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Unit: <span className="font-semibold text-slate-800">{unitOption.label}</span> &middot; Components:{' '}
              <span className="font-semibold text-slate-800">{toolComponents.length}</span>
              {componentChoice === 'own' && <> (your own{specs.length > 0 ? `, ${specs.length} built` : ''})</>}
            </div>
            <label
              className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-12 cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFileSelected(f);
              }}
            >
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <span className="mt-3 text-sm font-medium text-slate-700">Click to upload your plan image or PDF</span>
              <span className="mt-1 text-xs text-slate-400">Elevation or plan view - PNG, JPG, WebP up to 10 MB - PDF up to 50 MB (pick a page)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={e => {
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
                <li className="flex gap-2"><span className="text-[#BD4A1A]">&#10003;</span>Showing at least one clear, obvious measurement (e.g. a wall length) you can use to calibrate the scale</li>
              </ul>
            </div>
          </div>
        )}

        {builderOpen && (
          <ComponentBuilderModal
            key={editingSpecId ?? 'new'}
            initial={editingSpecId ? specs.find(s => s.id === editingSpecId) ?? null : null}
            measurementSystem={unitOption.lengthUnit === 'meters' ? 'metric' : 'imperial_ft'}
            onSave={handleBuilderSave}
            onClose={() => setBuilderOpen(false)}
          />
        )}

        <p className="mt-6 text-xs text-slate-400">
          Manual measuring only - no AI scan in this free tool. Nothing is saved unless you choose
          to send the result into the app. Desktop recommended; tablets work but are not optimized.
        </p>

        {device !== 'desktop' && (
          <p className="mt-3 text-xs font-medium text-[#BD4A1A]">
            {device === 'mobile'
              ? 'This tool does not work on mobile. Please open it on a desktop computer.'
              : 'You are on a tablet - this tool works but is not optimized. A desktop gives the most accurate results.'}
          </p>
        )}

        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
          <Link href="/free-roof-takeoff" className="text-sm text-slate-500 hover:text-slate-800">
            Measuring a roof instead? Free roof takeoff
          </Link>
        </div>
      </div>

      {/* PDF page picker modal (client-side pdfjs) */}
      {pdfPicker.modal}
    </div>
  );
}
