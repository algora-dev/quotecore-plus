'use client';
import './qc.css';

export interface QcWorkflowStep<T extends string> {
  key: T; label: string; description?: string; disabled?: boolean;
}
/** C34. Ordinals are navigation, not an inferred completion/progress score. */
export function QcWorkflowStepper<T extends string>({ steps, current, onSelect }: {
  steps: readonly QcWorkflowStep<T>[]; current: T; onSelect: (step: T) => void;
}) {
  return (
    <nav aria-label="Quote builder steps" data-qc-component="C34" className="qc-stepper">
      <ol>
        {steps.map((step, index) => (
          <li key={step.key}>
            <button type="button" onClick={() => onSelect(step.key)} disabled={step.disabled}
              aria-current={current === step.key ? 'step' : undefined}>
              <span className="qc-step-number" aria-hidden="true">{index + 1}</span>
              <span className="qc-step-copy"><span className="qc-step-label">{step.label}</span>
                {step.description && <span className="qc-step-description">{step.description}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
