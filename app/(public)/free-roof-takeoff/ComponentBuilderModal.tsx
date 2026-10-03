'use client';

import { useId, useRef, useState } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import '@/app/components/ui/v2/qc-dialog-actions.css';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcField, QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import './free-takeoff-ui.css';
import type { TakeoffComponentSpec } from './tradeConfig';

/**
 * Component builder modal for the free takeoff tool (step 2, "build your own").
 *
 * Mirrors the app's Add Component form fields (component_library columns):
 * name, measurement type, material + labour rates, pricing strategy
 * (per-unit or fixed-quantity packs), waste (percent / fixed / per-segment)
 * and pitch calculation. The saved spec persists through the session and,
 * on signup, becomes a real component_library row (import-takeoff-draft).
 */

type MeasurementSystemLite = 'metric' | 'imperial_ft' | 'imperial_rs';

const MEASUREMENT_TYPES: { value: TakeoffComponentSpec['measurementType']; label: string; hint: string }[] = [
  { value: 'lineal', label: 'Linear', hint: 'Ridges, hips, valleys, barges, spouting, flashings' },
  { value: 'area', label: 'Area', hint: 'Roof planes, underlay, cladding sheets' },
  { value: 'quantity', label: 'Quantity', hint: 'Screws, brackets, fixings - counted by click' },
];

/** Flooring variant: area / lineal / single item only, no roofing hints. */
const FLOORING_MEASUREMENT_TYPES: typeof MEASUREMENT_TYPES = [
  { value: 'area', label: 'Floor Area', hint: 'Plank, carpet, tile, underlay - measured by area' },
  { value: 'lineal', label: 'Lineal', hint: 'Skirting, scotia, transition strips - measured by length' },
  { value: 'quantity', label: 'Single Item', hint: 'Glue buckets, sundries, trims - counted by click' },
];

const WASTE_TYPES: { value: TakeoffComponentSpec['wasteType']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'percent', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed (total)' },
  { value: 'fixed_per_segment', label: 'Fixed (per segment)' },
];

export function ComponentBuilderModal({
  initial,
  measurementSystem = 'metric',
  trade = 'roofing',
  onSave,
  onClose,
}: {
  /** Existing spec to edit, or null to create. */
  initial: TakeoffComponentSpec | null;
  measurementSystem?: MeasurementSystemLite;
  /** Trade variant: flooring swaps measurement-type labels/hints and hides pitch. */
  trade?: 'roofing' | 'cladding' | 'flooring';
  onSave: (spec: TakeoffComponentSpec, isNew: boolean) => void;
  onClose: () => void;
}) {
  const typeOptions = trade === 'flooring' ? FLOORING_MEASUREMENT_TYPES : MEASUREMENT_TYPES;
  const metric = measurementSystem === 'metric';
  const lengthUnit = metric ? 'm' : 'ft';
  const areaUnit = metric ? 'm\u00b2' : 'ft\u00b2';
  const unitLabelFor = (mt: TakeoffComponentSpec['measurementType']) =>
    mt === 'area' ? areaUnit : mt === 'lineal' ? lengthUnit : 'ea';

  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [measurementType, setMeasurementType] = useState<TakeoffComponentSpec['measurementType']>(initial?.measurementType ?? 'lineal');
  const [materialRate, setMaterialRate] = useState(initial ? String(initial.materialRate) : '');
  const [labourRate, setLabourRate] = useState(initial ? String(initial.labourRate) : '');
  const [pricingStrategy, setPricingStrategy] = useState<TakeoffComponentSpec['pricingStrategy']>(initial?.pricingStrategy ?? 'per_unit');
  const [packPrice, setPackPrice] = useState(initial?.packPrice != null ? String(initial.packPrice) : '');
  const [packSize, setPackSize] = useState(initial?.packSize != null ? String(initial.packSize) : '');
  const [wasteType, setWasteType] = useState<TakeoffComponentSpec['wasteType']>(initial?.wasteType ?? 'none');
  const [wasteValue, setWasteValue] = useState(initial && initial.wasteValue > 0 ? String(initial.wasteValue) : '');
  const [pitchEnabled, setPitchEnabled] = useState(initial?.pitchEnabled ?? false);
  const [pitchType, setPitchType] = useState<TakeoffComponentSpec['pitchType']>(initial?.pitchType ?? 'rafter');

  const isPack = pricingStrategy !== 'per_unit';
  const packStrategies: TakeoffComponentSpec['pricingStrategy'][] =
    measurementType === 'area' ? ['per_pack_area'] : ['per_pack_length'];

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const spec: TakeoffComponentSpec = {
      id: initial?.id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim().slice(0, 120),
      measurementType,
      materialRate: Math.max(0, parseFloat(materialRate) || 0),
      labourRate: Math.max(0, parseFloat(labourRate) || 0),
      pricingStrategy: isPack ? packStrategies[0] : 'per_unit',
      packPrice: isPack ? Math.max(0, parseFloat(packPrice) || 0) : null,
      packSize: isPack ? Math.max(0, parseFloat(packSize) || 0) : null,
      wasteType,
      wasteValue: wasteType === 'none' ? 0 : Math.max(0, parseFloat(wasteValue) || 0),
      pitchEnabled: pitchEnabled && measurementType !== 'quantity',
      pitchType,
    };
    onSave(spec, isNew);
  };

  const rateUnit = unitLabelFor(measurementType);

  const fieldId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  return <QcDialog open pending onRequestClose={onClose} size="md" className="qc-free-component-dialog qc-dialog-fixed-actions"
    title={isNew ? 'Create component' : 'Edit component'}
    description="A component is an item you measure. Add your own costs to include an estimate in the report."
    initialFocusRef={nameRef}
    footer={<><QcButton onClick={onClose}>Cancel</QcButton>
      <QcButton variant="primary" onClick={handleSave} disabled={!canSave}>{isNew ? 'Create component' : 'Save changes'}</QcButton></>}>
    <div className="qc-free-component-form">
      <QcField label="Component name" htmlFor={`${fieldId}-name`} help="Use a name you will recognise when measuring.">
        <QcInput id={`${fieldId}-name`} ref={nameRef} value={name} aria-required="true"
          onChange={e => setName(e.target.value)} placeholder={trade === 'flooring' ? 'e.g. Skirting' : 'e.g. Ridge Flashing'} />
      </QcField>
      <fieldset className="qc-free-choices"><legend>How is it measured?</legend>
        {typeOptions.map(t => <label key={t.value} className="qc-free-choice" data-selected={measurementType === t.value || undefined}>
          <input type="radio" name="measurement-type" checked={measurementType === t.value}
            onChange={() => {
              setMeasurementType(t.value);
              if (t.value === 'quantity') { setPitchEnabled(false); setPricingStrategy('per_unit'); }
              if (t.value === 'area' && pricingStrategy === 'per_pack_length') setPricingStrategy('per_pack_area');
              if (t.value === 'lineal' && pricingStrategy === 'per_pack_area') setPricingStrategy('per_pack_length');
            }} />
          <span><strong>{t.label}</strong><span>{t.hint}</span></span>
        </label>)}
      </fieldset>
      <div className="qc-free-component-section">
        <h3>Your costs</h3><p className="qc-free-help">Rates are optional. Leave them at zero for measurements only.</p>
        <div className="qc-free-field-pair">
          <QcField label={`Material ($ / ${rateUnit})`} htmlFor={`${fieldId}-material`}>
            <QcInput id={`${fieldId}-material`} type="number" inputMode="decimal" step="0.01" min="0" value={materialRate}
              onChange={e => setMaterialRate(e.target.value)} placeholder="e.g. 18.50" disabled={isPack} />
          </QcField>
          <QcField label={`Labour ($ / ${rateUnit})`} htmlFor={`${fieldId}-labour`}>
            <QcInput id={`${fieldId}-labour`} type="number" inputMode="decimal" step="0.01" min="0" value={labourRate}
              onChange={e => setLabourRate(e.target.value)} placeholder="e.g. 11.00" />
          </QcField>
        </div>
        {packStrategies.length > 0 && <div className="qc-free-pack-settings">
          <label className="qc-free-check-label"><input type="checkbox" checked={isPack}
            onChange={e => setPricingStrategy(e.target.checked ? packStrategies[0] : 'per_unit')} />
            <span>Material is bought in fixed-size packs</span></label>
          {isPack && <div className="qc-free-field-pair">
            <QcField label="Pack price ($)" htmlFor={`${fieldId}-pack-price`}>
              <QcInput id={`${fieldId}-pack-price`} type="number" inputMode="decimal" step="0.01" min="0" value={packPrice}
                onChange={e => setPackPrice(e.target.value)} placeholder="e.g. 500" />
            </QcField>
            <QcField label={`Pack size (${measurementType === 'area' ? areaUnit : lengthUnit})`} htmlFor={`${fieldId}-pack-size`}>
              <QcInput id={`${fieldId}-pack-size`} type="number" inputMode="decimal" step="0.01" min="0" value={packSize}
                onChange={e => setPackSize(e.target.value)} placeholder="e.g. 50" />
            </QcField>
          </div>}
        </div>}
      </div>
      <div className="qc-free-component-section">
        <h3>Allowances</h3>
        <div className="qc-free-field-pair">
          <QcField label="Waste allowance" htmlFor={`${fieldId}-waste-type`}>
            <QcSelect id={`${fieldId}-waste-type`} value={wasteType}
              onChange={e => setWasteType(e.target.value as TakeoffComponentSpec['wasteType'])}>
              {WASTE_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </QcSelect>
          </QcField>
          {wasteType !== 'none' && <QcField label={wasteType === 'percent' ? 'Waste (%)' : `Waste (${rateUnit})`} htmlFor={`${fieldId}-waste-value`}>
            <QcInput id={`${fieldId}-waste-value`} type="number" inputMode="decimal" step="0.01" min="0" value={wasteValue}
              onChange={e => setWasteValue(e.target.value)} placeholder={wasteType === 'percent' ? '%' : rateUnit} />
          </QcField>}
        </div>
        {measurementType !== 'quantity' && trade !== 'flooring' && <div className="qc-free-pitch-settings">
          <label className="qc-free-check-label"><input type="checkbox" checked={pitchEnabled} onChange={e => setPitchEnabled(e.target.checked)} />
            <span>Apply pitch calculation</span></label>
          {pitchEnabled && <>
            <div className="qc-free-pitch-choice" role="group" aria-label="Pitch factor">
              <QcButton aria-pressed={pitchType === 'rafter'} onClick={() => setPitchType('rafter')}>Rafter</QcButton>
              <QcButton aria-pressed={pitchType === 'valley_hip'} onClick={() => setPitchType('valley_hip')}>Hip / Valley</QcButton>
            </div>
            <p className="qc-free-help">Plan measurements use the pitch of the area they are drawn on. You enter the pitch while measuring.</p>
          </>}
        </div>}
      </div>
      <p className="qc-free-help">These settings are for this takeoff session. They travel with the takeoff when you choose to save it to QuoteCore+.</p>
    </div>
  </QcDialog>;
}
