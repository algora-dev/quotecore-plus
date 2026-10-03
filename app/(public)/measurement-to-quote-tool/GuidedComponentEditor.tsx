'use client';

import { useMemo, useState } from 'react';
import type { BuilderComponent, MeasurementType, PricingStrategy, UnitSystem, WasteType } from './types';
import { lenLabel, areaLabel } from './types';
import { HelperPanel, type HelperTopic } from './HelperPanel';
import { ComponentTestPanel } from '@/app/components/pricing/ComponentTestPanel';
import type { ComponentTestDraft } from '@/app/components/pricing/componentTest';
import type { MeasurementSystem } from '@/app/lib/types';

/**
 * Guided pricing component editor (owner 2026-10-03): the main app's
 * SmartComponentEditor structure ported to the free tool - three numbered
 * settings sections on the left, and on the right (1) a contextual HELPER
 * that follows the field the user is in (always open by default, user can
 * minimise it) and (2) below it the main-app ComponentTestPanel ("Try a
 * measurement" with the full calculation breakdown), toggleable via the
 * "Test component" button. One editor serves every door: "Show me how it
 * works" (guided=true opens the test column immediately), "Create a pricing
 * component", and Edit from the testing price list. Flow-first build - the
 * external UX agent restyles to the v2 standard.
 */

const MEASUREMENT_TYPES: { value: MeasurementType; label: string; hint: string }[] = [
  { value: 'lineal', label: 'Linear', hint: 'Ridges, hips, valleys, barges, spouting, flashings' },
  { value: 'area', label: 'Area', hint: 'Roof planes, underlay, cladding sheets' },
  { value: 'quantity', label: 'Quantity', hint: 'Screws, brackets, fixings - counted per piece' },
];

const WASTE_TYPES: { value: WasteType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'percent', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed (total)' },
  { value: 'fixed_per_segment', label: 'Fixed (per segment)' },
];

function toMeasurementSystem(unit: UnitSystem): MeasurementSystem {
  if (unit === 'imperial') return 'imperial_ft';
  if (unit === 'squares') return 'imperial_rs';
  return 'metric';
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400';
const labelCls = 'block text-xs text-slate-500 mb-1';

export function GuidedComponentEditor({
  initial,
  unitSystem,
  guided = false,
  onSave,
  onClose,
}: {
  initial: BuilderComponent | null;
  unitSystem: UnitSystem;
  /** true = opened via "Show me how it works" - the test column starts open. */
  guided?: boolean;
  onSave: (component: BuilderComponent, isNew: boolean) => void;
  onClose: () => void;
}) {
  const len = lenLabel(unitSystem);
  const areaUnit = areaLabel(unitSystem);
  const unitLabelFor = (mt: MeasurementType) => (mt === 'area' ? areaUnit : mt === 'lineal' ? len : 'ea');

  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [measurementType, setMeasurementType] = useState<MeasurementType>(initial?.measurementType ?? 'lineal');
  const [materialRate, setMaterialRate] = useState(initial ? String(initial.materialRate || '') : '');
  const [labourRate, setLabourRate] = useState(initial ? String(initial.labourRate || '') : '');
  const [pricingStrategy, setPricingStrategy] = useState<PricingStrategy>(initial?.pricingStrategy ?? 'per_unit');
  const [packPrice, setPackPrice] = useState(initial?.packPrice != null && initial.packPrice > 0 ? String(initial.packPrice) : '');
  const [packSize, setPackSize] = useState(initial?.packSize != null && initial.packSize > 0 ? String(initial.packSize) : '');
  const [wasteType, setWasteType] = useState<WasteType>(initial?.wasteType ?? 'none');
  const [wasteValue, setWasteValue] = useState(initial && initial.wasteValue > 0 ? String(initial.wasteValue) : '');
  const [pitchEnabled, setPitchEnabled] = useState(initial?.pitchEnabled ?? false);
  const [pitchType, setPitchType] = useState<BuilderComponent['pitchType']>(initial?.pitchType ?? 'rafter');

  // Tutorial layer: helper always open by default (minimisable), test column
  // toggleable - both independently (owner 2026-10-03 13:48).
  const [topic, setTopic] = useState<HelperTopic>('intro');
  const [helperMinimized, setHelperMinimized] = useState(false);
  const [testOpen, setTestOpen] = useState(guided);
  const [mobileView, setMobileView] = useState<'settings' | 'test'>(guided ? 'test' : 'settings');

  const isPack = pricingStrategy !== 'per_unit';
  const packStrategies: PricingStrategy[] = measurementType === 'area' ? ['per_pack_area'] : ['per_pack_length'];
  const rateUnit = unitLabelFor(measurementType);
  const canSave = name.trim().length > 0;

  // Live draft for the main-app test panel: every keystroke updates the test.
  const draft = useMemo<ComponentTestDraft>(() => ({
    name: name.trim() || 'Untitled component',
    measurementType,
    materialRate: materialRate || '0',
    labourRate: labourRate || '0',
    wasteType,
    wasteAmount: wasteValue || '0',
    pitchType: pitchEnabled ? pitchType : 'none',
    strategy: isPack ? packStrategies[0] : 'per_unit',
    packPrice: packPrice || '0',
    packSize: packSize || '0',
    packCoverage: '',
    heightMm: '',
    depthMm: '',
    timeUnit: 'hr',
  }), [name, measurementType, materialRate, labourRate, wasteType, wasteValue, pitchEnabled, pitchType, isPack, packStrategies, packPrice, packSize]);

  const handleSave = () => {
    if (!canSave) return;
    const component: BuilderComponent = {
      id: initial?.id ?? `comp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      name: name.trim().slice(0, 120),
      sku: sku.trim() || undefined,
      measurementType,
      materialRate: Math.max(0, parseFloat(materialRate) || 0),
      labourRate: Math.max(0, parseFloat(labourRate) || 0),
      pricingStrategy: isPack ? packStrategies[0] : 'per_unit',
      packPrice: isPack ? Math.max(0, parseFloat(packPrice) || 0) : null,
      packSize: isPack ? Math.max(0, parseFloat(packSize) || 0) : null,
      wasteType,
      wasteValue: wasteType === 'none' ? 0 : Math.max(0, parseFloat(wasteValue) || 0),
      pitchEnabled: pitchEnabled && measurementType !== 'quantity',
      pitchType: pitchEnabled ? pitchType : 'none',
      source: initial?.source ?? 'manual',
    };
    onSave(component, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={isNew ? 'Create a pricing component' : 'Edit pricing component'}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {guided && isNew ? 'Show me how it works' : isNew ? 'Create a pricing component' : 'Edit pricing component'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Same fields as the app - on sign up these become real components in your account.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { if (testOpen) { setTestOpen(false); setMobileView('settings'); } else { setTestOpen(true); setMobileView('test'); } }}
              className="hidden rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 lg:inline-flex"
              aria-pressed={testOpen}
            >
              {testOpen ? 'Hide test' : 'Test component'}
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile tabs: Settings / Test + tips */}
        <div className="flex gap-2 border-b border-slate-100 px-5 py-2 lg:hidden" role="group" aria-label="Editor view">
          <button type="button" onClick={() => setMobileView('settings')} aria-pressed={mobileView === 'settings'} className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${mobileView === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Settings
          </button>
          <button type="button" onClick={() => { setTestOpen(true); setMobileView('test'); }} aria-pressed={mobileView === 'test'} className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${mobileView === 'test' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Test + tips
          </button>
        </div>

        {/* Body: settings left / helper + test right */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">

            {/* Settings column */}
            <div className={`${mobileView === 'settings' ? 'block' : 'hidden'} space-y-6 lg:block`}>

              <section>
                <header className="mb-3 flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">1</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">What are you pricing?</h3>
                    <p className="text-xs text-slate-500">A product, service or charge you can recognise later.</p>
                  </div>
                </header>
                <div className="space-y-4 pl-10">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Component name <span className="text-red-400">*</span>
                    </label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} onFocus={() => setTopic('name')} placeholder="e.g. Ridge Flashing" autoFocus className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Product code / SKU (optional)</label>
                    <input type="text" value={sku} onChange={e => setSku(e.target.value)} onFocus={() => setTopic('sku')} placeholder="e.g. CF-0.42-G300" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Measurement type</label>
                    <div className="space-y-1.5">
                      {MEASUREMENT_TYPES.map(t => (
                        <label key={t.value} className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-2.5 cursor-pointer hover:border-orange-200 hover:bg-orange-50/40">
                          <input
                            type="radio"
                            name="measurement-type"
                            checked={measurementType === t.value}
                            onChange={() => {
                              setMeasurementType(t.value);
                              setTopic('type');
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
                </div>
              </section>

              <section>
                <header className="mb-3 flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">2</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">What does it cost you?</h3>
                    <p className="text-xs text-slate-500">Enter your costs in $. Margins and tax are added later.</p>
                  </div>
                </header>
                <div className="space-y-4 pl-10">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <span className={labelCls}>Material (/{rateUnit})</span>
                      <input type="number" step="0.01" min="0" value={materialRate} onChange={e => setMaterialRate(e.target.value)} onFocus={() => setTopic('pricing')} placeholder="e.g. 18.50" disabled={isPack} className={inputCls} />
                    </div>
                    <div className="flex-1">
                      <span className={labelCls}>Labour (/{rateUnit})</span>
                      <input type="number" step="0.01" min="0" value={labourRate} onChange={e => setLabourRate(e.target.value)} onFocus={() => setTopic('labour')} placeholder="e.g. 11.00" className={inputCls} />
                    </div>
                  </div>
                  <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-2.5 cursor-pointer hover:border-orange-200 hover:bg-orange-50/40">
                    <input
                      type="checkbox"
                      checked={isPack}
                      onChange={e => { setPricingStrategy(e.target.checked ? packStrategies[0] : 'per_unit'); setTopic('pricing'); }}
                      className="mt-0.5 w-4 h-4 accent-orange-500"
                    />
                    <span className="flex-1">
                      <span className="block text-sm text-slate-900">Fixed quantity (sold in packs)</span>
                      {isPack && (
                        <span className="mt-2 flex gap-2">
                          <span className="flex-1">
                            <span className={labelCls}>Pack price ($)</span>
                            <input type="number" step="0.01" min="0" value={packPrice} onChange={e => setPackPrice(e.target.value)} onFocus={() => setTopic('pricing')} placeholder="e.g. 500" className={inputCls} />
                          </span>
                          <span className="flex-1">
                            <span className={labelCls}>Pack size ({measurementType === 'area' ? areaUnit : len})</span>
                            <input type="number" step="0.01" min="0" value={packSize} onChange={e => setPackSize(e.target.value)} onFocus={() => setTopic('pricing')} placeholder="e.g. 50" className={inputCls} />
                          </span>
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              </section>

              <section>
                <header className="mb-3 flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">3</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">What allowances apply?</h3>
                    <p className="text-xs text-slate-500">Leave these off when they do not apply.</p>
                  </div>
                </header>
                <div className="space-y-4 pl-10">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Waste allowance</label>
                    <div className="flex gap-2">
                      <select value={wasteType} onChange={e => setWasteType(e.target.value as WasteType)} onFocus={() => setTopic('waste')} className={`flex-1 ${inputCls}`}>
                        {WASTE_TYPES.map(w => (
                          <option key={w.value} value={w.value}>{w.label}</option>
                        ))}
                      </select>
                      {wasteType !== 'none' && (
                        <div className="w-32">
                          <input type="number" step="0.01" min="0" value={wasteValue} onChange={e => setWasteValue(e.target.value)} onFocus={() => setTopic('waste')} placeholder={wasteType === 'percent' ? '%' : rateUnit} className={inputCls} />
                        </div>
                      )}
                    </div>
                  </div>
                  {measurementType !== 'quantity' && (
                    <div>
                      <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 cursor-pointer hover:border-orange-200 hover:bg-orange-50/40">
                        <input type="checkbox" checked={pitchEnabled} onChange={e => { setPitchEnabled(e.target.checked); setTopic('pitch'); }} className="w-4 h-4 accent-orange-500" />
                        <span className="text-sm text-slate-900">Apply pitch calculation</span>
                      </label>
                      {pitchEnabled && (
                        <div className="mt-2 px-1">
                          <span className={labelCls}>Pitch factor</span>
                          <div className="flex rounded-full border border-slate-200 overflow-hidden w-fit">
                            <button type="button" onClick={() => { setPitchType('rafter'); setTopic('pitch'); }} className={`px-3 py-1.5 text-xs font-medium ${pitchType === 'rafter' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                              Rafter
                            </button>
                            <button type="button" onClick={() => { setPitchType('valley_hip'); setTopic('pitch'); }} className={`px-3 py-1.5 text-xs font-medium ${pitchType === 'valley_hip' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                              Hip / Valley
                            </button>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-400">
                            Quantities measured on the plan get multiplied by the pitch factor of each area.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Helper + test column - helper always present, test toggleable */}
            <div className={`${mobileView === 'test' ? 'block' : 'hidden'} space-y-3 lg:block`} aria-label="Helper and test panel">
              <HelperPanel topic={topic} minimized={helperMinimized} onToggle={() => setHelperMinimized(m => !m)} />
              {testOpen && (
                <ComponentTestPanel
                  key={measurementType}
                  draft={draft}
                  measurementSystem={toMeasurementSystem(unitSystem)}
                  currency="$"
                  onClose={() => { setTestOpen(false); setMobileView('settings'); }}
                />
              )}
              {!testOpen && (
                <button
                  type="button"
                  onClick={() => setTestOpen(true)}
                  className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 transition-colors hover:border-[#FF6B35] hover:bg-orange-50/40 hover:text-slate-800"
                >
                  Test this component with a sample measurement
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="hidden text-xs text-slate-400 sm:block">Testing does not save. Save explicitly when your settings are ready.</p>
          <div className="flex flex-1 gap-2 justify-end sm:flex-none">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="button"
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
