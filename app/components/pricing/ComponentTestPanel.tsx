'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { MeasurementSystem } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcField, QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { calculateComponentTest, canonicalUnit, displayQuantity, inputDimension, pricedDimension, unitForDimension, type ComponentTestDraft } from './componentTest';
import './pricing-activation.css';

const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(value);
export function ComponentTestPanel({ draft, measurementSystem, currency, onClose, onCalculated, focusOnMount = false }: {
  draft: ComponentTestDraft; measurementSystem: MeasurementSystem; currency: string;
  onClose?: () => void; onCalculated?: () => void; focusOnMount?: boolean;
}) {
  const id = useId();
  const firstInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(['']);
  const [system, setSystem] = useState<MeasurementSystem>(measurementSystem);
  const [basis, setBasis] = useState<'surface' | 'plan'>(draft.pitchType !== 'none' ? 'plan' : 'surface');
  const [pitch, setPitch] = useState('');
  const [attempted, setAttempted] = useState(false);
  const inputDim = inputDimension(draft.measurementType);
  const pricedDim = pricedDimension(draft.measurementType);
  const inputUnit = unitForDimension(inputDim, system, draft.timeUnit);
  const outputUnit = unitForDimension(pricedDim, system, draft.timeUnit);
  const costUnit = canonicalUnit(draft.measurementType, draft.timeUnit);
  const result = attempted ? calculateComponentTest(draft, { values, system, basis, pitch }) : null;
  const errors = result && !result.ok ? result.errors : {};
  const total = result?.ok ? result.result : null;
  const money = (value: number) => formatCurrency(value, currency);
  const qty = (value: number) => `${number(displayQuantity(value, pricedDim, system))} ${outputUnit}`;
  const inputLabel = inputDim === 'length' ? 'Test length' : inputDim === 'area' ? 'Test area'
    : inputDim === 'volume' ? 'Test volume' : inputDim === 'time' ? 'Test time' : 'Test quantity';

  useEffect(() => { if (focusOnMount) firstInput.current?.focus({ preventScroll: true }); }, [focusOnMount]);
  function calculate() {
    setAttempted(true);
    const outcome = calculateComponentTest(draft, { values, system, basis, pitch });
    if (outcome.ok) onCalculated?.();
  }
  // Explicit non-existent form owner detaches test controls from an ancestor
  // component form. A bad sample must NEVER block Save via native validity.
  // No test controls have a name; Enter is handled locally below.
  return <aside className="qc-component-test" aria-labelledby={`${id}-title`} data-qc-component="C70">
    <header className="qc-pricing-heading"><div><span className="qc-eyebrow">Try a measurement</span>
      <h3 id={`${id}-title`}>Test component</h3></div>
      {onClose && <QcButton className="qc-icon-button" aria-label="Close component test" onClick={onClose}><QcIcon name="close" /></QcButton>}
    </header>
    <p className="qc-pricing-muted">Uses the settings in this editor. Nothing is saved and no quote is created — use this to fine tune your pricing until you are happy.</p>
    <div className="qc-test-inputs" onKeyDown={event => {
      // Enter calculates, never submits the parent component form.
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); calculate(); }
    }}>
      {inputDim !== 'fixed' && <>
        {['length', 'area', 'volume'].includes(inputDim) && <QcField label="Test measurement units" htmlFor={`${id}-system`}>
          <QcSelect form={`${id}-test-only`} id={`${id}-system`} value={normalizeMeasurementSystem(system)} onChange={e => {
            // Do not reinterpret 120 ft² as 120 m² without asking for a new value.
            setSystem(e.target.value as MeasurementSystem); setValues(['']); setAttempted(false);
          }}>
            <option value="metric">Metric</option><option value="imperial_ft">Feet / square feet</option><option value="imperial_rs">Feet / roofing squares</option>
          </QcSelect>
        </QcField>}
        {values.map((value, index) => <div key={index} className="qc-test-measure-row">
          <QcField htmlFor={`${id}-value-${index}`} label={`${inputLabel}${values.length > 1 ? ` ${index + 1}` : ''} (${inputUnit})`}>
            <QcInput form={`${id}-test-only`} ref={index === 0 ? firstInput : undefined} id={`${id}-value-${index}`} type="number" min="0" step="any" inputMode="decimal"
              value={value} placeholder={inputDim === 'quantity' ? 'e.g. 5' : 'e.g. 120'} aria-invalid={!!errors[`value-${index}`]}
              aria-describedby={errors[`value-${index}`] ? `${id}-errors` : undefined}
              onChange={e => setValues(previous => previous.map((v, i) => i === index ? e.target.value : v))} />
          </QcField>
          {values.length > 1 && <QcButton aria-label={`Remove test measurement ${index + 1}`} className="qc-icon-button" onClick={() => setValues(previous => previous.filter((_, i) => i !== index))}><QcIcon name="trash" /></QcButton>}
        </div>)}
        {(inputDim === 'length' || draft.measurementType.startsWith('multi_')) && <QcButton size="sm" onClick={() => setValues(previous => [...previous, ''])}><QcIcon name="plus" /> {inputDim === 'length' ? 'Add another length' : 'Add another measurement'}</QcButton>}
        {draft.measurementType.includes('freestyle') && <p className="qc-pricing-muted">Enter the area you have already worked out from the length and height.</p>}
        {draft.measurementType === 'volume_3d' && <p className="qc-pricing-muted">Enter the volume you have already worked out from length, width and depth.</p>}
      </>}
      {inputDim === 'fixed' && <p className="qc-pricing-callout">This test uses one fixed charge. No measurement is needed.</p>}
      {draft.pitchType !== 'none' && <>
        <QcField htmlFor={`${id}-basis`} label="Measurement basis" help="Already measured on the slope? Do not apply pitch a second time.">
          <QcSelect form={`${id}-test-only`} id={`${id}-basis`} value={basis} onChange={e => setBasis(e.target.value as 'surface' | 'plan')}>
            <option value="surface">Already measured / on the slope</option><option value="plan">Plan measurement - apply pitch</option>
          </QcSelect>
        </QcField>
        {basis === 'plan' && <QcField htmlFor={`${id}-pitch`} label="Pitch (degrees)">
          <QcInput form={`${id}-test-only`} id={`${id}-pitch`} type="number" inputMode="decimal" step="any" min="0" max="89.99" placeholder="e.g. 25" value={pitch}
            aria-invalid={!!errors.pitch} onChange={e => setPitch(e.target.value)} />
        </QcField>}
      </>}
      <QcButton variant="secondary" onClick={calculate}><QcIcon name="pricing" />{attempted ? 'Calculate again' : 'Calculate'}</QcButton>
    </div>
    {result && !result.ok && <div id={`${id}-errors`} className="qc-pricing-error" role="status">
      <strong>Check before calculating</strong><ul>{Object.values(result.errors).map(message => <li key={message}>{message}</li>)}</ul>
      <p>Enter 0 for an intentional zero cost. Empty costs are not assumed to be free.</p>
    </div>}
    {!attempted && <div className="qc-test-empty"><QcIcon name="measure" /><p>Enter a measurement to see materials, labour and allowances working together.</p></div>}
    {total && <div className="qc-test-result">
      <div className="qc-test-total" aria-live="polite" aria-atomic="true"><span>Component cost</span><strong>{money(total.total)}</strong><small>{currency} · before quote margins and tax</small></div>
      <dl className="qc-test-breakdown">
        <div><dt>{total.entryCount > 1 ? `${total.entryCount} measurements entered` : 'Measurement entered'}</dt><dd>{number(total.entered)} {inputUnit}</dd></div>
        {inputDim !== pricedDim && <div><dt>After preset {inputDim === 'length' ? 'height' : 'depth'}</dt><dd>{qty(total.measured)}</dd></div>}
        {total.pitchApplied && <div><dt>After {draft.pitchType === 'valley_hip' ? 'hip/valley' : 'rafter'} pitch ({pitch}°)</dt><dd>{qty(total.afterPitch)}</dd></div>}
        {draft.wasteType !== 'none' && <div><dt>Waste added{draft.wasteType === 'percent' ? ` (${draft.wasteAmount}%)` : ''}</dt><dd>{qty(total.wasteAdded)}</dd></div>}
        <div className="qc-test-emphasis"><dt>Required quantity</dt><dd>{qty(total.required)}</dd></div>
        {total.purchased !== null && <>
          <div><dt>Whole packs to buy</dt><dd>{number(total.packs)}</dd></div>
          <div><dt>Quantity purchased</dt><dd>{qty(total.purchased)}</dd></div>
          <div><dt>Spare after allowance</dt><dd>{qty(total.spare ?? 0)}</dd></div>
        </>}
        <div className="qc-test-emphasis"><dt>Materials</dt><dd>{money(total.materialCost)}</dd></div>
        <div><dt>Labour</dt><dd>{money(total.labourCost)}</dd></div>
      </dl>
      <p className="qc-pricing-muted">{total.effectiveCost !== null && `Effective cost: ${money(total.effectiveCost)} per entered ${inputUnit}. `}{total.purchased !== null && 'Whole-pack rounding can make a small job cost more per unit.'}</p>
      <details className="qc-pricing-details"><summary>How this was calculated</summary><div>
        <p>{draft.strategy === 'per_unit'
          ? `Materials: ${number(total.required)} ${costUnit} × ${money(Number(draft.materialRate))}.`
          : `Materials: ${number(total.packs)} whole packs × ${money(Number(draft.packPrice))}.`}</p>
        <p>Labour: {number(total.required)} {costUnit} × {money(Number(draft.labourRate))}. Labour uses the quantity after pitch and waste, not rounded-up pack coverage.</p>
        {(draft.wasteType === 'fixed' || draft.wasteType === 'fixed_per_segment') && <p>The fixed allowance is applied to each entered measurement in this manual-entry test. Takeoff keeps its existing segment rules.</p>}
        <p>Uses the quote calculation helpers with no job overrides, margins or tax. This explains the rules; it does not verify that your prices are right for your business.</p>
      </div></details>
      <p className="qc-test-live"><QcIcon name="check" /> Valid changes update this result immediately.</p>
    </div>}
  </aside>;
}
