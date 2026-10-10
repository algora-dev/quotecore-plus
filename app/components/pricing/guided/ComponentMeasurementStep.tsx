'use client';
import { useId, useRef, useState, type FormEvent } from 'react';
import type { MeasurementSystem } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcField, QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { COMMON_MEASUREMENT_TYPES, availableMeasurementTypes, measurementOption, requiresHeight, requiresDepth, validateMeasurement,
  type MeasurementFields, type MeasurementErrors, type NewMeasurementType } from './measurement-state';
import './guided-measurement.css';

export interface ComponentMeasurementStepProps {
  value: MeasurementFields;
  chosen: boolean;
  componentName: string;
  measurementSystem: MeasurementSystem;
  genericTradesEnabled: boolean;
  onChange: (patch: Partial<MeasurementFields>) => void;
  onChoose: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export function ComponentMeasurementStep({ value, chosen, componentName, measurementSystem, genericTradesEnabled, onChange, onChoose, onBack, onContinue }: ComponentMeasurementStepProps) {
  const id = useId();
  const firstChoiceRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSelectElement>(null);
  const [errors, setErrors] = useState<MeasurementErrors>({});
  const available = availableMeasurementTypes(genericTradesEnabled);
  const additional = available.filter(type => !COMMON_MEASUREMENT_TYPES.includes(type));
  const isAvailable = available.includes(value.measurementType as NewMeasurementType);
  const selection = chosen && isAvailable ? value.measurementType as NewMeasurementType : null;
  const extraSelected = selection !== null && additional.includes(selection);
  const [moreOpen, setMoreOpen] = useState(extraSelected);
  const selected = selection ? measurementOption(selection, measurementSystem, value.hoursUnit) : null;

  function choose(type: NewMeasurementType) {
    if (!available.includes(type)) return;
    // The parent is the existing editor settings owner. Pricing strategy compatibility
    // and canonical save mapping remain there, unchanged.
    onChange({ measurementType: type }); onChoose(); setErrors({});
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = validateMeasurement(value, chosen, genericTradesEnabled);
    setErrors(next);
    if (next.measurementType) firstChoiceRef.current?.focus();
    else if (next.heightMm) heightRef.current?.focus();
    else if (next.depthMm) depthRef.current?.focus();
    else if (next.hoursUnit) timeRef.current?.focus();
    else onContinue();
  }

  return <form className="qc-measure-form" onSubmit={submit} noValidate>
    <div className="qc-measure-input-content">
      <p className="qc-measure-context"><span>YOUR ITEM</span><strong>{componentName}</strong></p>
      <fieldset className="qc-measure-choices" aria-describedby={errors.measurementType ? `${id}-type-error` : undefined}>
        <legend>Choose one measurement type</legend>
        <div className="qc-measure-choice-grid">
          {COMMON_MEASUREMENT_TYPES.filter(type => available.includes(type)).map((type, index) => {
            const option = measurementOption(type, measurementSystem);
            return <label key={type} className="qc-measure-choice" data-selected={selection === type || undefined}>
              <input ref={index === 0 ? firstChoiceRef : undefined} type="radio" name={`${id}-measurement`} value={type}
                checked={selection === type} onChange={() => choose(type)} aria-invalid={!!errors.measurementType}
                aria-describedby={errors.measurementType ? `${id}-type-error` : undefined} />
              <span className="qc-measure-choice-copy"><strong>{option.title}</strong><span>{option.short}</span></span>
              <span className="qc-measure-choice-unit" aria-hidden="true">{option.unit}</span>
            </label>;
          })}
        </div>
      </fieldset>
      {errors.measurementType && <p className="qc-identity-error" id={`${id}-type-error`} role="alert">{errors.measurementType}</p>}
      {additional.length > 0 && <div className="qc-measure-more">
        <div className="qc-measure-more-content"><QcField htmlFor={`${id}-other`} label="Additional measurement types">
          <QcSelect id={`${id}-other`} value={extraSelected ? selection! : ''} onChange={event => choose(event.target.value as NewMeasurementType)}>
            <option value="" disabled>Choose another measurement type</option>
            {additional.map(type => <option key={type} value={type}>{measurementOption(type, measurementSystem).title}</option>)}
          </QcSelect>
        </QcField></div>
      </div>}
      {chosen && !isAvailable && !errors.measurementType && <p className="qc-identity-error" role="alert">That measurement type is not available in this workspace. Choose one above.</p>}
      {selected && <>
        <div className="qc-measure-selected" role="status" aria-live="polite" aria-atomic="true">
          <div><span className="qc-measure-small-label">HOW YOU’LL USE IT</span><p>{selected.explanation}</p><span className="qc-measure-editor-label">In the quick editor: {selected.editorLabel}</span></div>
        </div>
        {(requiresHeight(selection!) || requiresDepth(selection!)) && <div className="qc-measure-preset">
          {requiresHeight(selection!) && <QcField htmlFor={`${id}-height`} label="Set height (mm)" help="Set a height to reuse every time. To enter a different height for each measurement, choose a custom height." helpId={`${id}-height-help`}>
            <QcInput ref={heightRef} type="number" inputMode="decimal" min="0" step="any" id={`${id}-height`} value={value.heightMm}
              placeholder="e.g. 2400" aria-invalid={!!errors.heightMm} aria-describedby={`${id}-height-help${errors.heightMm ? ` ${id}-height-error` : ''}`}
              onChange={event => { onChange({ heightMm: event.target.value }); setErrors(previous => ({ ...previous, heightMm: undefined })); }} />
          </QcField>}
          {requiresDepth(selection!) && <QcField htmlFor={`${id}-depth`} label="Set depth (mm)" help="Set a depth to reuse every time, in millimetres. Choose a custom depth if it changes between measurements." helpId={`${id}-depth-help`}>
            <QcInput ref={depthRef} type="number" inputMode="decimal" min="0" step="any" id={`${id}-depth`} value={value.depthMm}
              placeholder="e.g. 100" aria-invalid={!!errors.depthMm} aria-describedby={`${id}-depth-help${errors.depthMm ? ` ${id}-depth-error` : ''}`}
              onChange={event => { onChange({ depthMm: event.target.value }); setErrors(previous => ({ ...previous, depthMm: undefined })); }} />
          </QcField>}
          {errors.heightMm && <p className="qc-identity-error" id={`${id}-height-error`} role="alert">{errors.heightMm}</p>}
          {errors.depthMm && <p className="qc-identity-error" id={`${id}-depth-error`} role="alert">{errors.depthMm}</p>}
          {normalizeMeasurementSystem(measurementSystem) !== 'metric' && <p className="qc-measure-unit-note">Saved heights and depths use millimetres, just as in your quick editor. Job measurements use your account’s preferred units.</p>}
        </div>}
        {selection === 'hours_days' && <div className="qc-measure-preset"><QcField htmlFor={`${id}-time`} label="Time unit for your test" help="Choose hours or days. This sets up your example test, not an automatic conversion of rates." helpId={`${id}-time-help`}>
          <QcSelect ref={timeRef} id={`${id}-time`} value={value.hoursUnit} aria-invalid={!!errors.hoursUnit} aria-describedby={`${id}-time-help${errors.hoursUnit ? ` ${id}-time-error` : ''}`}
            onChange={event => { onChange({ hoursUnit: event.target.value as 'hr' | 'day' }); setErrors(previous => ({ ...previous, hoursUnit: undefined })); }}>
            <option value="hr">Hours</option><option value="day">Days</option>
          </QcSelect>
        </QcField>{errors.hoursUnit && <p className="qc-identity-error" id={`${id}-time-error`} role="alert">{errors.hoursUnit}</p>}</div>}
      </>}
    </div>
    <footer className="qc-identity-footer"><QcButton onClick={onBack}><QcIcon name="back" />Back</QcButton>
      <div className="qc-identity-footer-next"><span>Next: your material costs</span><QcButton variant="primary" type="submit" className="qc-identity-glint">Continue<QcIcon name="arrow" /></QcButton></div>
    </footer>
  </form>;
}
