'use client';
import { useId } from 'react';
import { DEMO_SYSTEMS, type DemoSystem } from '@/app/lib/demo/presentation';
import './demo-units.css';

/** Choosing units is not a destructive action. Only the explicit primary
 * button starts/replaces a workspace. Native radios retain keyboard semantics. */
export function DemoUnitChoice({ value, onChange, disabled = false, legend = 'Measurement system' }: {
  value: DemoSystem | null; onChange: (value: DemoSystem) => void; disabled?: boolean; legend?: string;
}) {
  const name = useId();
  return <fieldset className="qc-demo-units" disabled={disabled}>
    <legend>{legend}</legend>
    {DEMO_SYSTEMS.map(option => <label key={option.id} className="qc-demo-unit-option" data-selected={value === option.id}>
      <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
      <span className="qc-demo-unit-label"><strong>{option.title}</strong><small>{option.detail}</small></span>
      <span className="qc-demo-unit-symbol" aria-hidden="true">{option.symbol}</span>
    </label>)}
  </fieldset>;
}
