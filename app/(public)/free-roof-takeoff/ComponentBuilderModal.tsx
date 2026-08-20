'use client';

import { useState } from 'react';
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

const WASTE_TYPES: { value: TakeoffComponentSpec['wasteType']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'percent', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed (total)' },
  { value: 'fixed_per_segment', label: 'Fixed (per segment)' },
];

export function ComponentBuilderModal({
  initial,
  measurementSystem = 'metric',
  onSave,
  onClose,
}: {
  /** Existing spec to edit, or null to create. */
  initial: TakeoffComponentSpec | null;
  measurementSystem?: MeasurementSystemLite;
  onSave: (spec: TakeoffComponentSpec, isNew: boolean) => void;
  onClose: () => void;
}) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">{isNew ? 'Create component' : 'Edit component'}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Same fields as the app - on sign up these become real components in your account.
          </p>

          <div className="mt-5 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Component name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ridge Flashing"
                autoFocus
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Measurement type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Measurement type</label>
              <div className="space-y-1.5">
                {MEASUREMENT_TYPES.map(t => (
                  <label key={t.value} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:border-orange-200 hover:bg-orange-50/40">
                    <input
                      type="radio"
                      name="measurement-type"
                      checked={measurementType === t.value}
                      onChange={() => {
                        setMeasurementType(t.value);
                        if (t.value === 'quantity') { setPitchEnabled(false); setPricingStrategy('per_unit'); }
                        if (t.value === 'area' && pricingStrategy === 'per_pack_length') setPricingStrategy('per_pack_area');
                        if (t.value === 'lineal' && pricingStrategy === 'per_pack_area') setPricingStrategy('per_pack_length');
                      }}
                      className="mt-0.5 w-4 h-4 accent-orange-500"
                    />
                    <span>
                      <span className="block text-sm text-slate-900">{t.label}</span>
                      <span className="block text-xs text-slate-400">{t.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pricing</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <span className="block text-xs text-slate-500 mb-1">Material (${rateUnit})</span>
                  <input
                    type="number" step="0.01" min="0" value={materialRate}
                    onChange={e => setMaterialRate(e.target.value)}
                    placeholder="e.g. 18.50" disabled={isPack}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div className="flex-1">
                  <span className="block text-xs text-slate-500 mb-1">Labour (${rateUnit})</span>
                  <input
                    type="number" step="0.01" min="0" value={labourRate}
                    onChange={e => setLabourRate(e.target.value)}
                    placeholder="e.g. 11.00"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Fixed-quantity pack option */}
              {packStrategies.length > 0 && (
                <label className="mt-2 flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:border-orange-200 hover:bg-orange-50/40">
                  <input
                    type="checkbox"
                    checked={isPack}
                    onChange={e => setPricingStrategy(e.target.checked ? packStrategies[0] : 'per_unit')}
                    className="mt-0.5 w-4 h-4 accent-orange-500"
                  />
                  <span className="flex-1">
                    <span className="block text-sm text-slate-900">Fixed quantity (sold in packs)</span>
                    {isPack && (
                      <span className="mt-2 flex gap-2">
                        <span className="flex-1">
                          <span className="block text-xs text-slate-500 mb-1">Pack price ($)</span>
                          <input
                            type="number" step="0.01" min="0" value={packPrice}
                            onChange={e => setPackPrice(e.target.value)} placeholder="e.g. 500"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                          />
                        </span>
                        <span className="flex-1">
                          <span className="block text-xs text-slate-500 mb-1">Pack size ({measurementType === 'area' ? areaUnit : lengthUnit})</span>
                          <input
                            type="number" step="0.01" min="0" value={packSize}
                            onChange={e => setPackSize(e.target.value)} placeholder="e.g. 50"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                          />
                        </span>
                      </span>
                    )}
                  </span>
                </label>
              )}
            </div>

            {/* Waste */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Waste</label>
              <div className="flex gap-2">
                <select
                  value={wasteType}
                  onChange={e => setWasteType(e.target.value as TakeoffComponentSpec['wasteType'])}
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                >
                  {WASTE_TYPES.map(w => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
                {wasteType !== 'none' && (
                  <div className="w-32">
                    <input
                      type="number" step="0.01" min="0" value={wasteValue}
                      onChange={e => setWasteValue(e.target.value)}
                      placeholder={wasteType === 'percent' ? '%' : rateUnit}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Pitch */}
            {measurementType !== 'quantity' && (
              <div>
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:border-orange-200 hover:bg-orange-50/40">
                  <input
                    type="checkbox"
                    checked={pitchEnabled}
                    onChange={e => setPitchEnabled(e.target.checked)}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm text-slate-900">Apply pitch calculation</span>
                </label>
                {pitchEnabled && (
                  <div className="mt-2 px-1">
                    <span className="block text-xs text-slate-500 mb-1">Pitch factor</span>
                    <div className="flex rounded-full border border-slate-200 overflow-hidden w-fit">
                      <button
                        type="button"
                        onClick={() => setPitchType('rafter')}
                        className={`px-3 py-1.5 text-xs font-medium ${pitchType === 'rafter' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        Rafter (1/cos)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPitchType('valley_hip')}
                        className={`px-3 py-1.5 text-xs font-medium ${pitchType === 'valley_hip' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        Hip / Valley
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Quantities measured on the plan get multiplied by the pitch factor of each roof area.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-5 py-2 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-40"
            >
              {isNew ? 'Create component' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
