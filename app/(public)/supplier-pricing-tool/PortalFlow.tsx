// Main flow orchestrator: Step 1 (entry mode) - Step 2 (measurements)
// - one product step per populated group - output.

'use client';

import { useState } from 'react';
import type { EntryMode, HaveSubMode, MeasurementSet } from './types';
import { emptyMeasurementSet, GROUP_DEFS } from './types';
import { StepProgress, type StepDef } from './StepShell';
import { EntryModeStep } from './EntryModeStep';
import { MeasureEntryStep } from './MeasureEntryStep';
import { ProductStep } from './ProductStep';
import { OutputView } from './OutputView';
import { DEMO_CATALOG } from './supplier';

export function PortalFlow() {
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [haveSubMode, setHaveSubMode] = useState<HaveSubMode | null>(null);
  const [measureSet, setMeasureSet] = useState<MeasurementSet>(emptyMeasurementSet());
  // step >= 3 means product step index (step - 3); last = output
  const [step, setStep] = useState(1);

  const populated = GROUP_DEFS.filter(g => measureSet.groups[g.key].entries.length > 0);
  const productDefs = populated;

  // Build display steps: 1 = mode, 2 = measurements, one per populated group, then output
  const steps: StepDef[] = [
    { key: 'mode', label: 'How do you want to price this job?' },
    { key: 'measure', label: 'Enter measurements' },
    ...productDefs.map(d => ({ key: d.key, label: `Products - ${d.label}` })),
    { key: 'output', label: 'Output' },
  ];
  const currentStep = Math.min(step, steps.length);
  const productStepIdx = step - 3; // 0-based index into productDefs

  function reset() {
    setEntryMode(null);
    setHaveSubMode(null);
    setMeasureSet(emptyMeasurementSet());
    setStep(1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <StepProgress steps={steps} current={currentStep} />
      <div className="mx-auto max-w-5xl px-4 py-6 pb-16">
        {step === 1 && (
          <EntryModeStep
            entryMode={entryMode}
            setEntryMode={setEntryMode}
            haveSubMode={haveSubMode}
            setHaveSubMode={setHaveSubMode}
            onNext={() => {
              if (entryMode === 'have' && haveSubMode === 'plan') {
                // Phase 3: plan measurement entry. For now route to actual entry
                // with a note; pitch conversion lands with Phase 3.
                setMeasureSet({ ...emptyMeasurementSet(), entryPath: 'plan' });
              } else {
                setMeasureSet({ ...emptyMeasurementSet(), entryPath: entryMode === 'measure' ? 'measure' : 'actual' });
              }
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
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
            catalog={DEMO_CATALOG}
            setMeasureSet={setMeasureSet}
            onBack={() => setStep(step - 1)}
            onNext={() => setStep(step + 1)}
            stepNum={productStepIdx + 1}
            totalSteps={productDefs.length}
          />
        )}

        {step >= 3 && productStepIdx >= productDefs.length && (
          <OutputView
            measureSet={measureSet}
            catalog={DEMO_CATALOG}
            onBack={() => setStep(step - 1)}
            onRestart={reset}
          />
        )}
      </div>
    </div>
  );
}
