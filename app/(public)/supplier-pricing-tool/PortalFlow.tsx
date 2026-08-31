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
import { CustomComponentsStep } from './CustomComponentsStep';
import { TakeoffStation, stageSlug } from './TakeoffStation';
import { tradeUnitPrice, useSupplierConfig } from './supplierConfig';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';

/** Session persistence: the whole in-progress flow survives Back navigation,
 *  refreshes and the output -> back loop. sessionStorage (not localStorage)
 *  so genuinely leaving (closing the tab) starts fresh. */
const FLOW_KEY = '***';

interface PersistedFlow {
  entryMode: EntryMode | null;
  haveSubMode: HaveSubMode | null;
  measureSet: MeasurementSet;
  mode: Mode;
  flowSpeed: 'guide' | 'fast';
  step: number;
}

function readPersisted(): PersistedFlow | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(FLOW_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedFlow;
    if (!p?.measureSet?.groups || typeof p.step !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

export function PortalFlow() {
  const restored = readPersisted();
  const [entryMode, setEntryMode] = useState<EntryMode | null>(restored?.entryMode ?? null);
  const [haveSubMode, setHaveSubMode] = useState<HaveSubMode | null>(restored?.haveSubMode ?? null);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [measureSet, setMeasureSet] = useState<MeasurementSet>(restored?.measureSet ?? emptyMeasurementSet());
  const [mode, setMode] = useState<Mode>(restored?.mode ?? 'standard');
  const [step, setStep] = useState(() => {
    // A restored takeoff flow at the station step has no plan file to
    // re-render - drop to start (measurements survive for the manual edit).
    if (restored && restored.entryMode === 'measure' && restored.step === 2) return 1;
    return restored?.step ?? 1;
  });
  // Guide (one product group per page) vs Fast (all groups on one page).
  // Mirrors the takeoff tool's Guide me / Fast mode switch.
  const [flowSpeed, setFlowSpeed] = useState<'guide' | 'fast'>(restored?.flowSpeed ?? 'guide');

  // Persist after every change so Back/refresh/output-return never loses work
  useEffect(() => {
    try {
      const p: PersistedFlow = { entryMode, haveSubMode, measureSet, mode, flowSpeed, step };
      window.sessionStorage.setItem(FLOW_KEY, JSON.stringify(p));
    } catch { /* ignore quota */ }
  }, [entryMode, haveSubMode, measureSet, mode, flowSpeed, step]);

  const populated = GROUP_DEFS.filter(g => measureSet.groups[g.key].entries.length > 0);
  const productDefs = populated;

  // Trade pricing (Phase 5): logged-in users see trade prices when the
  // supplier config allows it; anonymous users always see baseline prices.
  // When the login feature is OFF nobody can log in, so trade-requires-login
  // can never be satisfied - treat trade pricing as public in that case.
  const { config, basePath } = useSupplierConfig();
  const { user } = useFreeToolsAuth();
  const showTrade = (config.features.login && user != null) || !config.tradeRequiresLogin;
  const catalog = useMemo<SupplierProduct[]>(() =>
    showTrade
      ? config.products.map(p => ({ ...p, unitPrice: tradeUnitPrice(p, config) }))
      : config.products,
    [config, showTrade]);

  const steps = [
    { key: 'mode', label: 'How do you want to price this job?' },
    ...(entryMode === 'measure'
      ? [{ key: 'takeoff', label: 'Measure your plan' }]
      : [{ key: 'measure', label: 'Measurements & products' }]),
    // manual flow assigns products inline on the measurement pages (merged
    // flow) - only the takeoff path gets separate product steps.
    ...(entryMode === 'measure'
      ? productDefs.map(d => ({ key: d.key, label: `Products - ${d.label}` }))
      : []),
    { key: 'custom', label: 'Custom components' },
    { key: 'output', label: 'Output' },
  ];
  const currentStep = Math.min(step, steps.length);
  const productStepIdx = step - 3; // 0-based index into productDefs
  const activeGroupKey = step >= 3 && productStepIdx < productDefs.length ? productDefs[productStepIdx].key : null;
  // custom components step sits between the last product/measure step and
  // the output in BOTH flows (manual + takeoff).
  const customStepNum = 3 + (entryMode === 'measure' ? productDefs.length : 0);
  const outputStepNum = customStepNum + 1;

  // Keep the URL hash in sync with the current stage so the user always
  // knows where they are (e.g. #digital-takeoff, #products-ridges, #output).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const slug = stageSlug(step, entryMode, activeGroupKey);
    if (window.location.hash !== slug) {
      window.history.replaceState(null, '', `${basePath}${slug}`);
    }
  }, [step, entryMode, activeGroupKey, basePath]);

  function reset() {
    setEntryMode(null);
    setHaveSubMode(null);
    setPlanFile(null);
    if (planUrl) URL.revokeObjectURL(planUrl);
    setPlanUrl(null);
    setMeasureSet(emptyMeasurementSet());
    setStep(1);
    try { window.sessionStorage.removeItem(FLOW_KEY); } catch { /* ignore */ }
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
        {/* Persistent Standard/Advanced + Guide/Fast toggles - entry step onward, but NOT on the takeoff step */}
        {step >= 2 && !(step === 2 && entryMode === 'measure') && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
              {step >= 2 && (
                <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 w-fit">
                  <button
                    onClick={() => setFlowSpeed('guide')}
                    title="Step by step, one page at a time with diagrams"
                    className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${flowSpeed === 'guide' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                  >
                    Guide me
                  </button>
                  <button
                    onClick={() => setFlowSpeed('fast')}
                    title="Everything on one page"
                    className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${flowSpeed === 'fast' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                  >
                    Fast mode
                  </button>
                </div>
              )}
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

        {/* Step 2b: manual measurement entry (have measurements).
            Merged flow: entry + product assignment happen on the SAME page
            per group (guide = one group per page, fast = all stacked).
            Next goes straight to the output - there is no separate product phase. */}
        {step === 2 && entryMode !== 'measure' && (
          <MeasureEntryStep
            measureSet={measureSet}
            setMeasureSet={setMeasureSet}
            flowSpeed={flowSpeed}
            catalog={catalog}
            mode={mode}
            onBack={() => setStep(1)}
            onNext={() => setStep(customStepNum)}
          />
        )}

        {/* Product assignment: Fast mode = every populated group on one page;
            Guide = one group per step. */}
        {step >= 3 && productStepIdx < productDefs.length && flowSpeed === 'fast' && entryMode === 'measure' && (
          <div className="space-y-4">
            {productDefs.map(def => (
              <ProductStep
                key={def.key}
                def={def}
                measureSet={measureSet}
                catalog={catalog}
                setMeasureSet={setMeasureSet}
                mode={mode}
                hideNav
                onBack={() => setStep(2)}
                onNext={() => {}}
                stepNum={productDefs.indexOf(def) + 1}
                totalSteps={productDefs.length}
              />
            ))}
            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setStep(2)} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
                Back
              </button>
              <button
                onClick={() => setStep(customStepNum)}
                disabled={catalog.length === 0 || !measureSet.appliedProducts.some(ap => productDefs.some(d => d.key === ap.groupKey))}
                className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
              >
                Next: Custom components
              </button>
            </div>
          </div>
        )}

        {step >= 3 && flowSpeed === 'guide' && entryMode === 'measure' && productStepIdx < productDefs.length && productStepIdx >= 0 && (
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

        {/* Custom components: final step before the output in both flows */}
        {step === customStepNum && (
          <CustomComponentsStep
            measureSet={measureSet}
            setMeasureSet={setMeasureSet}
            onBack={() => setStep(customStepNum - 1)}
            onNext={() => setStep(outputStepNum)}
          />
        )}

        {step >= outputStepNum && (
          <OutputView
            measureSet={measureSet}
            catalog={catalog}
            baselineCatalog={config.products}
            showTrade={showTrade}
            tradeLabel={showTrade && config.discountPct > 0 ? `trade pricing (-${config.discountPct}%)` : null}
            onBack={() => setStep(customStepNum)}
            onAddCustom={() => setStep(customStepNum)}
            onRestart={reset}
          />
        )}
      </div>
    </div>
  );
}
