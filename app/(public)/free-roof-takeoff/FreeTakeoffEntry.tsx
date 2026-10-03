'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { QcJourney, QcJourneySteps } from '@/app/components/ui/v2/QcJourney';
import { QcHostedDialogScope } from '@/app/components/ui/v2/QcHostedDialog';
import { ROOFING_TAKEOFF_CONFIG as CONFIG, type TakeoffComponentSpec, type TakeoffUnitOption, type TakeoffUnitSystem } from './tradeConfig';
import './free-takeoff-ui.css';

/** Presentation only. The existing free-tool owner keeps every stage, upload,
 * session, device, component and canvas callback. No second wizard state. */
export function FreeTakeoffEntry({ step, unitSystem, unitOption, componentChoice, specs, componentCount, error,
  orientationNoticeOpen, onDismissOrientation, onUnitChange, onChoiceChange, onBack, onContinue,
  onCreateComponent, onEditComponent, onRemoveComponent, onFile, children, pdfModal }: {
  step: 1 | 2 | 3; unitSystem: TakeoffUnitSystem; unitOption: TakeoffUnitOption;
  componentChoice: 'ours' | 'own'; specs: TakeoffComponentSpec[]; componentCount: number;
  error: string | null; orientationNoticeOpen: boolean; onDismissOrientation: () => void;
  onUnitChange: (unit: TakeoffUnitSystem) => void; onChoiceChange: (choice: 'ours' | 'own') => void;
  onBack: () => void; onContinue: () => void; onCreateComponent: () => void;
  onEditComponent: (id: string) => void; onRemoveComponent: (id: string) => void;
  onFile: (file: File) => void; children?: ReactNode; pdfModal: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus({ preventScroll: true });
    previousStep.current = step;
  }, [step]);
  const title = step === 1 ? 'Which units do you use?' : step === 2 ? 'What would you like to measure?' : 'Add your roof plan';
  const description = step === 1 ? 'Choose the units you want to measure and report in.'
    : step === 2 ? 'Use the standard roofing items, or add your own with rates.'
      : 'Choose an image or a page from a PDF. You’ll set its scale on the canvas next.';

  return <QcJourney className="qc-free-entry">
    {orientationNoticeOpen && <QcDialog open pending onRequestClose={onDismissOrientation}
      title="Measure on your phone" description="This tool works in portrait or landscape. Rotate your phone for more drawing room, or use a desktop."
      footer={<QcButton variant="primary" onClick={onDismissOrientation}>Continue</QcButton>} />}
    <div className="qc-free-entry-layout">
      <aside className="qc-free-entry-guide">
        <p className="qc-free-eyebrow">Your plan. Your measurements.</p>
        <h2>Three small steps.<br />Then you’re measuring.</h2>
        <p>Use the same measuring engine as the QuoteCore+ app. No account is needed to try it.</p>
        <ol><li><strong>Choose your units</strong><span>Metric, imperial or roofing squares.</span></li>
          <li><strong>Choose what to measure</strong><span>Start with familiar roofing items.</span></li>
          <li><strong>Upload a plan</strong><span>Set the scale, then draw your measurements.</span></li></ol>
        <Link href="/takeoff-demo" className="qc-free-text-link">No plan handy? Try a sample plan<QcIcon name="arrow" /></Link>
      </aside>
      <div className="qc-free-entry-card">
        <QcJourneySteps steps={['Units', 'Components', 'Plan']} current={step - 1} label="Takeoff setup" />
        <div className="qc-free-step-heading">
          {step > 1 && <QcButton size="sm" className="qc-free-back" onClick={onBack}><QcIcon name="back" />Back</QcButton>}
          <h2 ref={heading} tabIndex={-1}>{title}</h2><p>{description}</p>
        </div>
        {step === 1 && <>
          <fieldset className="qc-free-choices"><legend className="qc-flow-sr-only">Measurement units</legend>
            {CONFIG.unitOptions.map(option => <label key={option.value} className="qc-free-choice" data-selected={unitSystem === option.value || undefined}>
              <input type="radio" name="unit-system" checked={unitSystem === option.value} onChange={() => onUnitChange(option.value)} />
              <span><strong>{option.label}</strong><span>{option.description}</span></span>
            </label>)}
          </fieldset>
          <p className="qc-free-help">With imperial or roofing squares, pitch can be entered in degrees or as a ratio, such as 6:12.</p>
          <QcButton variant="primary" className="qc-free-next" onClick={onContinue}>Choose components<QcIcon name="arrow" /></QcButton>
        </>}
        {step === 2 && <>
          <fieldset className="qc-free-choices"><legend className="qc-flow-sr-only">Components to measure</legend>
            <label className="qc-free-choice" data-selected={componentChoice === 'ours' || undefined}>
              <input type="radio" name="component-choice" checked={componentChoice === 'ours'} onChange={() => onChoiceChange('ours')} />
              <span><strong>Use standard roofing components</strong><span>Roof area, ridge, hip, valley, barge and spouting. Measurements only, without prices.</span></span>
            </label>
            <label className="qc-free-choice" data-selected={componentChoice === 'own' || undefined}>
              <input type="radio" name="component-choice" checked={componentChoice === 'own'} onChange={() => onChoiceChange('own')} />
              <span><strong>Build my own components</strong><span>Add names, material and labour rates, purchasing, waste and pitch rules. Up to {CONFIG.maxCustomComponents} components.</span></span>
            </label>
          </fieldset>
          {componentChoice === 'own' && <div className="qc-free-custom-components">
            {specs.length > 0 && <ul>{specs.map(spec => <li key={spec.id}>
              <div><strong>{spec.name}</strong><span>{spec.measurementType === 'lineal' ? 'Length' : spec.measurementType === 'area' ? 'Area' : 'Quantity'}
                {spec.materialRate > 0 || spec.labourRate > 0 ? ` · $${spec.materialRate} material / $${spec.labourRate} labour` : ''}
                {spec.wasteType !== 'none' ? ` · waste ${spec.wasteType === 'percent' ? spec.wasteValue + '%' : spec.wasteValue}` : ''}
                {spec.pitchEnabled ? ' · pitch calculation' : ''}</span></div>
              <div className="qc-free-component-actions"><QcButton size="sm" onClick={() => onEditComponent(spec.id)} aria-label={`Edit ${spec.name}`}>Edit</QcButton>
                <QcButton size="sm" onClick={() => onRemoveComponent(spec.id)} aria-label={`Remove ${spec.name}`}>Remove</QcButton></div>
            </li>)}</ul>}
            {specs.length < CONFIG.maxCustomComponents
              ? <QcButton className="qc-free-add-component" onClick={onCreateComponent}><QcIcon name="plus" />Create component{specs.length ? ` (${specs.length}/${CONFIG.maxCustomComponents})` : ''}</QcButton>
              : <p className="qc-free-help">You’ve reached this tool’s {CONFIG.maxCustomComponents}-component limit. Edit or remove one to add another.</p>}
          </div>}
          <QcButton variant="primary" className="qc-free-next" onClick={onContinue} disabled={componentCount === 0}>Continue to plan<QcIcon name="arrow" /></QcButton>
          {componentCount === 0 && <p className="qc-free-help">Create at least one component to continue.</p>}
        </>}
        {step === 3 && <>
          <div className="qc-free-setup-summary"><span><strong>{unitOption.label}</strong> measurements</span>
            <span><strong>{componentCount}</strong> {componentChoice === 'own' ? 'custom' : 'standard'} components</span></div>
          <label className="qc-free-upload" onDragOver={event => event.preventDefault()} onDrop={event => {
            event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) onFile(file);
          }}>
            <QcIcon name="upload" />
            <strong>Drop your plan here</strong><span>or choose a file from your device</span>
            <span className="qc-button" data-qc-variant="primary" aria-hidden="true">Choose plan</span>
            <span className="qc-free-upload-limits" id="qc-free-upload-help">PNG, JPG or WebP · up to 10 MB<br />PDF · up to 50 MB · choose one page</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" aria-label="Upload your roof plan"
              aria-describedby={error ? 'qc-free-upload-help qc-free-upload-error' : 'qc-free-upload-help'} aria-invalid={!!error}
              onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); }} />
          </label>
          {error && <p id="qc-free-upload-error" role="alert" className="qc-free-error">{error}</p>}
          <details className="qc-free-help-details"><summary>What makes a good plan?</summary>
            <ul><li>A clear, high-quality image with sharp lines.</li><li>A straight, overhead view, square to the page.</li>
              <li>At least one known dimension, such as a wall length, to set the scale.</li></ul>
          </details>
        </>}
        <p className="qc-free-session-note"><QcIcon name="info" />Keep this page open while you work. Your takeoff stays in this session unless you choose to save it to QuoteCore+.</p>
        <Link href="/takeoff-demo" className="qc-free-text-link qc-free-mobile-demo">No plan? Use a sample plan<QcIcon name="arrow" /></Link>
      </div>
    </div>
    {children}
    <QcHostedDialogScope enabled>{pdfModal}</QcHostedDialogScope>
  </QcJourney>;
}
