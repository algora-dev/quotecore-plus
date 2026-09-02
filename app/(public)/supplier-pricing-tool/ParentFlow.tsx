// Parent-model flow (cladding / flooring): entry mode -> parents &
// measurements -> products per parent -> custom components -> output.
// Mirrors PortalFlow structure/UX; data model is parent areas (see
// tradeConfig.ts). Fully self-contained like the roofing flow.

'use client';

import { useEffect, useState } from 'react';
import type { EntryMode, MeasurementSet, ParentJob } from './types';
import { emptyParentJob, makeId } from './types';
import type { SupplierProduct } from './types';
import { StepProgress } from './StepShell';
import { ParentMeasureStep } from './ParentMeasureStep';
import { ParentProductStep } from './ParentProductStep';
import { ParentOutputView } from './ParentOutputView';
import { CustomComponentsStep } from './CustomComponentsStep';
import { tradeConfigFor } from './tradeConfig';
import type { TradeConfig } from './tradeConfig';
import { tradeUnitPrice, useSupplierConfig } from './supplierConfig';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';
import { useMemo } from 'react';

const FLOW_KEY = 'qc-spt-parent-flow-v1';

interface PersistedParentFlow {
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
  const [step, setStep] = useState(restored?.step ?? 1);
  const [mode, setMode] = useState<'standard' | 'advanced'>(restored?.mode ?? 'standard');
  const [job, setJob] = useState<ParentJob>(restored?.job ?? emptyParentJob());

  useEffect(() => {
    try {
      window.sessionStorage.setItem(FLOW_KEY, JSON.stringify({ step, mode, job } satisfies PersistedParentFlow));
    } catch { /* ignore quota */ }
  }, [step, mode, job]);

  // Trade pricing parity with the roofing flow
  const showTrade = (config.features.login && user != null) || !config.tradeRequiresLogin;
  const catalog = useMemo<SupplierProduct[]>(() =>
    showTrade
      ? config.products.map(p => ({ ...p, unitPrice: tradeUnitPrice(p, config) }))
      : config.products,
    [config, showTrade]);

  const steps = [
    { key: 'mode', label: 'How do you want to price this job?' },
    { key: 'measure', label: `${trade.areaLabel} & measurements` },
    { key: 'products', label: 'Products' },
    { key: 'custom', label: 'Custom components' },
    { key: 'output', label: 'Output' },
  ];
  const customStepNum = 4;
  const outputStepNum = 5;
  const currentStep = Math.min(step, steps.length);

  // Shim so the shared CustomComponentsStep (MeasurementSet-typed) can be
  // reused verbatim - it only touches the customComponents slice.
  const customsShim = { entryPath: 'actual', groups: {}, appliedProducts: [], customComponents: job.customComponents } as unknown as MeasurementSet;
  function setCustomsShim(next: MeasurementSet) {
    setJob(j => ({ ...j, customComponents: next.customComponents }));
  }

  function reset() {
    setJob(emptyParentJob());
    setStep(1);
    try { window.sessionStorage.removeItem(FLOW_KEY); } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {step < outputStepNum && (
        <StepProgress steps={steps} current={currentStep} />
      )}
      <div className="mx-auto max-w-5xl px-4 py-6 pb-16">
        {/* Persistent Standard/Advanced toggle (mirrors the roofing flow) */}
        {step >= 2 && step < outputStepNum && (
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

        {step === 1 && <ParentEntryStep trade={trade} onNext={() => setStep(2)} />}

        {step === 2 && (
          <ParentMeasureStep
            trade={trade}
            job={job}
            setJob={setJob}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <ParentProductStep
            trade={trade}
            job={job}
            setJob={setJob}
            catalog={catalog}
            mode={mode}
            currency={config.currency}
            onBack={() => setStep(2)}
            onNext={() => setStep(customStepNum)}
          />
        )}

        {step === customStepNum && (
          <CustomComponentsStep
            measureSet={customsShim}
            setMeasureSet={setCustomsShim}
            onBack={() => setStep(3)}
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

/** Step 1: two paths - measure from plans, or enter known measurements.
 *  The digital takeoff for parent trades is the next build phase, so the
 *  measure option is visible but marked coming soon; known measurements is
 *  the live path. */
function ParentEntryStep({ trade, onNext }: { trade: TradeConfig; onNext: () => void }) {
  const [selected, setSelected] = useState<'measure' | 'have' | null>(null);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">How do you want to price this job?</h2>
        <p className="mt-1 text-sm text-slate-500">
          {trade.label} - {trade.areaLabel.toLowerCase()} drive the product quantities.
        </p>

        <div className="mt-4 space-y-3">
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left opacity-70"
            title="Digital takeoff for this trade is landing in the next update"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Measure from plans <span className="ml-2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Coming soon</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Upload a floor plan and/or elevation plans, measure {trade.areaNoun} areas on screen (length x height or area shapes), then apply products.
            </p>
          </button>

          <button
            onClick={() => setSelected('have')}
            className={`w-full rounded-xl border px-4 py-4 text-left transition cursor-pointer ${selected === 'have'
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
        <span className="text-xs text-slate-400">Step 1 of 5</span>
        <button
          onClick={onNext}
          disabled={selected !== 'have'}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
        >
          Next: {trade.areaLabel}
        </button>
      </div>
    </div>
  );
}

export function parentFlowMakeId(prefix: string): string {
  return makeId(prefix);
}
