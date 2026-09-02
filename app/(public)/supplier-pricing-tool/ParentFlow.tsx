// Parent-model flow (cladding / flooring): entry mode -> (digital takeoff
// station when measuring from plans) -> parents & measurements -> products
// per parent -> custom components -> output. Mirrors PortalFlow structure;
// data model is parent areas (see tradeConfig.ts). Fully self-contained.

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EntryMode, MeasurementSet, ParentJob } from './types';
import { emptyParentJob } from './types';
import type { SupplierProduct } from './types';
import { StepProgress } from './StepShell';
import { ParentMeasureStep } from './ParentMeasureStep';
import { ParentProductStep } from './ParentProductStep';
import { ParentOutputView } from './ParentOutputView';
import { CustomComponentsStep } from './CustomComponentsStep';
import { ParentTakeoffStation } from './ParentTakeoffStation';
import { tradeConfigFor } from './tradeConfig';
import type { TradeConfig } from './tradeConfig';
import { tradeUnitPrice, useSupplierConfig } from './supplierConfig';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';
import { usePdfPagePicker } from '@/app/components/PdfPagePicker';

const FLOW_KEY = 'qc-spt-parentflow-v2';

interface PersistedParentFlow {
  entryMode: 'measure' | 'have' | null;
  step: number;
  mode: 'standard' | 'advanced';
  job: ParentJob;
}

function readPersisted(): PersistedParentFlow | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(FLOW_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedParentFlow;
    if (!p?.job || !Array.isArray(p.job.parents) || typeof p.step !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

export function ParentFlow() {
  const { config, basePath } = useSupplierConfig();
  const trade: TradeConfig = tradeConfigFor(config.trade);
  const { user } = useFreeToolsAuth();

  const restored = readPersisted();
  const [entryMode, setEntryMode] = useState<'measure' | 'have' | null>(restored?.entryMode ?? null);
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [step, setStep] = useState(() => {
    // A restored measure flow at the station step has no plan file to
    // re-render - land on the measurement edit step (job data survives).
    if (restored && restored.entryMode === 'measure' && restored.step === 2) return 3;
    return restored?.step ?? 1;
  });
  const [mode, setMode] = useState<'standard' | 'advanced'>(restored?.mode ?? 'standard');
  const [job, setJob] = useState<ParentJob>(restored?.job ?? emptyParentJob());

  useEffect(() => {
    try {
      window.sessionStorage.setItem(FLOW_KEY, JSON.stringify({ entryMode, step, mode, job } satisfies PersistedParentFlow));
    } catch { /* ignore quota */ }
  }, [entryMode, step, mode, job]);

  // Trade pricing parity with the roofing flow
  const showTrade = (config.features.login && user != null) || !config.tradeRequiresLogin;
  const catalog = useMemo<SupplierProduct[]>(() =>
    showTrade
      ? config.products.map(p => ({ ...p, unitPrice: tradeUnitPrice(p, config) }))
      : config.products,
    [config, showTrade]);

  // Dynamic step list: the takeoff station only exists on the measure path.
  const stationStep = entryMode === 'measure' ? 2 : 0;
  const measureStepNum = entryMode === 'measure' ? 3 : 2;
  const productStepNum = measureStepNum + 1;
  const customStepNum = productStepNum + 1;
  const outputStepNum = customStepNum + 1;

  const steps = [
    { key: 'mode', label: 'How do you want to price this job?' },
    ...(entryMode === 'measure' ? [{ key: 'takeoff', label: 'Measure your plans' }] : []),
    { key: 'measure', label: `${trade.areaLabel} & measurements` },
    { key: 'products', label: 'Products' },
    { key: 'custom', label: 'Custom components' },
    { key: 'output', label: 'Output' },
  ];
  const currentStep = Math.min(step, steps.length);

  // Shim so the shared CustomComponentsStep (MeasurementSet-typed) can be
  // reused verbatim - it only touches the customComponents slice.
  const customsShim = { entryPath: 'actual', groups: {}, appliedProducts: [], customComponents: job.customComponents } as unknown as MeasurementSet;
  function setCustomsShim(next: MeasurementSet) {
    setJob(j => ({ ...j, customComponents: next.customComponents }));
  }

  function reset() {
    setEntryMode(null);
    if (planUrl) URL.revokeObjectURL(planUrl);
    setPlanUrl(null);
    setJob(emptyParentJob());
    setStep(1);
    try { window.sessionStorage.removeItem(FLOW_KEY); } catch { /* ignore */ }
  }

  /** Station finished: merge its parents/entries/customs into the job and
   *  land on the measurement edit step so names/values can be reviewed. */
  function handleStationFinish(next: ParentJob) {
    setJob(next);
    setStep(measureStepNum);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {step < outputStepNum && (
        <StepProgress steps={steps} current={currentStep} />
      )}
      <div className="mx-auto max-w-5xl px-4 py-6 pb-16">
        {/* Persistent Standard/Advanced toggle (mirrors the roofing flow) */}
        {step >= measureStepNum && step < outputStepNum && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 w-fit">
              <button
                onClick={() => setMode('standard')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${mode === 'standard' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
              >
                Standard
              </button>
              <button
                onClick={() => setMode('advanced')}
                title="Advanced adds waste, labour and quantity overrides per area group - your choice is remembered across steps"
                className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${mode === 'advanced' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
              >
                Advanced
              </button>
            </div>
            <span className="text-xs text-slate-400">
              {mode === 'standard' ? 'Fast materials pricing' : 'Detailed job costing - waste, labour, overrides'}
            </span>
          </div>
        )}

        {step === 1 && (
          <ParentEntryStep
            trade={trade}
            entryMode={entryMode}
            setEntryMode={setEntryMode}
            planUrl={planUrl}
            setPlanUrl={setPlanUrl}
            onBackToChoice={() => { setEntryMode(null); setPlanUrl(null); }}
            onNext={() => setStep(entryMode === 'measure' ? stationStep : measureStepNum)}
          />
        )}

        {/* Digital takeoff station (measure from plans). Multi-plan: use
            "Upload another plan or image" inside the station to add the
            floor plan then each elevation in the same takeoff. */}
        {step === stationStep && entryMode === 'measure' && planUrl && (
          <ParentTakeoffStation
            trade={trade.key}
            planUrl={planUrl}
            onFinish={handleStationFinish}
          />
        )}

        {step === measureStepNum && (
          <ParentMeasureStep
            trade={trade}
            job={job}
            setJob={setJob}
            onBack={() => setStep(entryMode === 'measure' ? stationStep : 1)}
            onNext={() => setStep(productStepNum)}
          />
        )}

        {step === productStepNum && (
          <ParentProductStep
            job={job}
            setJob={setJob}
            catalog={catalog}
            mode={mode}
            currency={config.currency}
            trade={trade}
            onBack={() => setStep(measureStepNum)}
            onNext={() => setStep(customStepNum)}
          />
        )}

        {step === customStepNum && (
          <CustomComponentsStep
            measureSet={customsShim}
            setMeasureSet={setCustomsShim}
            onBack={() => setStep(productStepNum)}
            onNext={() => setStep(outputStepNum)}
          />
        )}

        {step >= outputStepNum && (
          <ParentOutputView
            trade={trade}
            job={job}
            catalog={catalog}
            baselineCatalog={config.products}
            showTrade={showTrade}
            tradeLabel={showTrade && config.discountPct > 0 ? `trade pricing (-${config.discountPct}%)` : null}
            currency={config.currency}
            basePath={basePath}
            onBack={() => setStep(customStepNum)}
            onAddCustom={() => setStep(customStepNum)}
            onRestart={reset}
          />
        )}
      </div>
    </div>
  );
}

/** Step 1: two paths - measure from plans (upload PNG/JPG/PDF) or enter
 *  known measurements. The station handles multi-plan in-session. */
function ParentEntryStep({
  trade, entryMode, setEntryMode, planUrl, setPlanUrl, onBackToChoice, onNext,
}: {
  trade: TradeConfig;
  entryMode: 'measure' | 'have' | null;
  setEntryMode: (m: 'measure' | 'have' | null) => void;
  planUrl: string | null;
  setPlanUrl: (u: string | null) => void;
  onBackToChoice: () => void;
  onNext: () => void;
}) {
  const pdfPicker = usePdfPagePicker();
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(raw: File) {
    setBusy(true);
    try {
      const isPdf = raw.type === 'application/pdf' || /\.pdf$/i.test(raw.name);
      const file = isPdf ? await pdfPicker.convertIfNeeded(raw) : raw;
      if (!file) return; // PDF page picker cancelled
      const url = URL.createObjectURL(file);
      setPlanUrl(url);
      setFileName(raw.name);
      setEntryMode('measure');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">How do you want to price this job?</h2>
        <p className="mt-1 text-sm text-slate-500">
          {trade.label} - {trade.areaLabel.toLowerCase()} drive the product quantities.
        </p>

        <div className="mt-4 space-y-3">
          <button
            onClick={() => setEntryMode('measure')}
            className={`w-full rounded-xl border px-4 py-4 text-left transition cursor-pointer ${entryMode === 'measure'
              ? 'border-blue-300 bg-blue-50/40 shadow-[0_0_8px_rgba(37,99,235,0.08)]'
              : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'}`}
          >
            <span className="text-sm font-semibold text-slate-900">Measure from plans</span>
            <p className="mt-1 text-xs text-slate-500">
              Upload a floor plan and/or elevation plans{trade.allowHeight ? ' - measure wall runs (length x height) or draw areas' : ' - draw the areas on the plan'}. Add more plans in the same takeoff.
            </p>
            {entryMode === 'measure' && (
              <div className="mt-3">
                <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center hover:border-blue-300 transition">
                  <span className="text-sm font-medium text-slate-700">
                    {busy ? 'Processing PDF...' : planUrl ? 'Choose a different plan' : 'Upload your first plan'}
                  </span>
                  <span className="mt-1 text-xs text-slate-400">PDF, PNG, JPG</span>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {fileName && (
                  <p className="mt-2 truncate text-xs text-slate-500">Selected: {fileName}</p>
                )}
              </div>
            )}
          </button>

          <button
            onClick={() => setEntryMode('have')}
            className={`w-full rounded-xl border px-4 py-4 text-left transition cursor-pointer ${entryMode === 'have'
              ? 'border-blue-300 bg-blue-50/40 shadow-[0_0_8px_rgba(37,99,235,0.08)]'
              : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'}`}
          >
            <span className="text-sm font-semibold text-slate-900">Enter measurements I already have</span>
            <p className="mt-1 text-xs text-slate-500">
              Add each {trade.areaNoun} area group (one per product type) with its m\u00B2 values, then apply products.
            </p>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {entryMode ? (
          <button onClick={onBackToChoice} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
            Clear choice
          </button>
        ) : <span className="text-xs text-slate-400">Step 1 of 5</span>}
        <button
          onClick={onNext}
          disabled={entryMode === null || (entryMode === 'measure' && !planUrl) || busy}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
        >
          {entryMode === 'measure' ? 'Next: Measure your plans' : `Next: ${trade.areaLabel}`}
        </button>
      </div>
    </div>
  );
}
