// Main flow orchestrator: Step 1 (entry mode + inline upload / sub-choice)
// - in-tool takeoff station (measure a plan) OR measurement entry - one
// product step per populated group - output. Standard/Advanced mode is a
// persistent toggle held here. Fully self-contained: no links out to any
// other tool.

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EntryMode, HaveSubMode, MeasurementSet, Mode } from './types';
import { emptyMeasurementSet, GROUP_DEFS } from './types';
import type { SupplierProduct } from './types';
import { StepProgress } from './StepShell';
import { EntryModeStep } from './EntryModeStep';
import { MeasureEntryStep } from './MeasureEntryStep';
import { ProductStep } from './ProductStep';
import { OutputView } from './OutputView';
import { TakeoffStation, stageSlug } from './TakeoffStation';
import { tradeUnitPrice, useSupplierConfig } from './supplierConfig';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';

export function PortalFlow() {
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [haveSubMode, setHaveSubMode] = useState<HaveSubMode | null>(null);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [measureSet, setMeasureSet] = useState<MeasurementSet>(emptyMeasurementSet());
  const [mode, setMode] = useState<Mode>('standard');
  const [step, setStep] = useState(1);

  const populated = GROUP_DEFS.filter(g => measureSet.groups[g.key].entries.length > 0);
  const productDefs = populated;

  // Trade pricing (Phase 5): logged-in users see trade prices when the
  // supplier config allows it; anonymous users always see baseline prices.
  const { config } = useSupplierConfig();
  const { user } = useFreeToolsAuth();
  const showTrade = user != null || !config.tradeRequiresLogin;
  const catalog = useMemo<SupplierProduct[]>(() =>
    showTrade
      ? config.products.map(p => ({ ...p, unitPrice: tradeUnitPrice(p, config) }))
      : config.products,
    [config, showTrade]);

  const steps = [
    { key: 'mode', label: 'How do you want to price this job?' },
    ...(entryMode === 'measure'
      ? [{ key: 'takeoff', label: 'Measure your plan' }]
      : [{ key: 'measure', label: 'Enter measurements' }]),
    ...productDefs.map(d => ({ key: d.key, label: `Products - ${d.label}` })),
    { key: 'output', label: 'Output' },
  ];
  const currentStep = Math.min(step, steps.length);
  const productStepIdx = step - 3; // 0-based index into productDefs
  const activeGroupKey = step >= 3 && productStepIdx < productDefs.length ? productDefs[productStepIdx].key : null;

  // Keep the URL hash in sync with the current stage so the user always
  // knows where they are (e.g. #digital-takeoff, #products-ridges, #output).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const slug = stageSlug(step, entryMode, activeGroupKey);
    if (window.location.hash !== slug) {
      window.history.replaceState(null, '', `/supplier-pricing-tool${slug}`);
    }
  }, [step, entryMode, activeGroupKey]);

  function reset() {
    setEntryMode(null);
    setHaveSubMode(null);
    setPlanFile(null);
    if (planUrl) URL.revokeObjectURL(planUrl);
    setPlanUrl(null);
    setMeasureSet(emptyMeasurementSet());
    setStep(1);
  }

  function handleTakeoffFinish(set: MeasurementSet) {
    setMeasureSet(set);
    // skip the manual entry step - measurements came from the station
    setStep(3);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {step < 3 && (
        <StepProgress steps={steps} current={currentStep} />
      )}
      <div className="mx-auto max-w-5xl px-4 py-6 pb-16">
        {/* Persistent Standard/Advanced toggle - entry step onward, but NOT on the takeoff step */}
        {step >= 2 && !(step === 2 && entryMode === 'measure') && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 w-fit">
              <button
                onClick={() => setMode('standard')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${mode === 'standard' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
              >
                Standard
              </button>
              <button
                onClick={() => setMode('advanced')}
                title="Advanced adds per-entry products, labour, waste and overrides - your choice is remembered across steps"
                className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${mode === 'advanced' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
              >
                Advanced
              </button>
            </div>
            <span className="text-xs text-slate-400">
              {mode === 'standard' ? 'Fast materials pricing' : 'Detailed job costing - per-entry products, labour, waste, overrides'}
            </span>
          </div>
        )}

        {step === 1 && (
          <EntryModeStep
            entryMode={entryMode}
            setEntryMode={setEntryMode}
            haveSubMode={haveSubMode}
            setHaveSubMode={setHaveSubMode}
            planFile={planFile}
            setPlanFile={f => {
              if (planUrl) URL.revokeObjectURL(planUrl);
              setPlanFile(f);
              setPlanUrl(f ? URL.createObjectURL(f) : null);
            }}
            onNext={() => {
              if (entryMode === 'have' && haveSubMode === 'plan') {
                setMeasureSet({ ...emptyMeasurementSet(), entryPath: 'plan' });
              } else {
                setMeasureSet({ ...emptyMeasurementSet(), entryPath: entryMode === 'measure' ? 'measure' : 'actual' });
              }
              setStep(2);
            }}
          />
        )}

        {/* Step 2a: in-tool takeoff station (measure a plan) */}
        {step === 2 && entryMode === 'measure' && planUrl && (
          <TakeoffStation planUrl={planUrl} onFinish={handleTakeoffFinish} />
        )}

        {/* Step 2b: manual measurement entry (have measurements) */}
        {step === 2 && entryMode !== 'measure' && (
          <MeasureEntryStep
            measureSet={measureSet}
            setMeasureSet={setMeasureSet}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step >= 3 && productStepIdx < productDefs.length && (
          <ProductStep
            def={productDefs[productStepIdx]}
            measureSet={measureSet}
            catalog={catalog}
            setMeasureSet={setMeasureSet}
            mode={mode}
            onBack={() => setStep(step - 1)}
            onNext={() => setStep(step + 1)}
            stepNum={productStepIdx + 1}
            totalSteps={productDefs.length}
          />
        )}

        {step >= 3 && productStepIdx >= productDefs.length && (
          <OutputView
            measureSet={measureSet}
            catalog={catalog}
            baselineCatalog={config.products}
            showTrade={showTrade}
            tradeLabel={showTrade && config.discountPct > 0 ? `trade pricing (-${config.discountPct}%)` : null}
            onBack={() => setStep(step - 1)}
            onRestart={reset}
          />
        )}
      </div>
    </div>
  );
}
