'use client';

import { useState, useRef, useEffect } from 'react';
import { useUnitSystem, useSharedState } from '../RoofingCalculator';
import type { MeasurementType, WasteType, PitchType, PricingStrategy } from '@/app/lib/types';

// ─── All measurement types from the app ──────────────

const MEASUREMENT_TYPES: { value: MeasurementType; label: string; tooltip: string }[] = [
  { value: 'area', label: 'Area (m²)', tooltip: 'Area measurement in square metres. Used for roofing, flooring, cladding.' },
  { value: 'lineal', label: 'Linear: Single (m)', tooltip: 'Single linear measurement in metres. Used for gutters, flashings, trims.' },
  { value: 'quantity', label: 'Quantity', tooltip: 'Simple count of items. No unit conversion. Used for fixings, brackets, accessories.' },
  { value: 'fixed', label: 'Fixed', tooltip: 'Fixed quantity that does not change with measurements. Used for lump sum items.' },
  { value: 'length_x_height', label: 'Length x Height (m²)', tooltip: 'Area calculated from a preset height multiplied by measured length. Used for walls, cladding.' },
  { value: 'volume', label: 'Volume - Preset Depth (m³)', tooltip: 'Volume from area multiplied by a preset depth. Used for concrete slabs, fill, excavation.' },
  { value: 'volume_3d', label: 'Volume (m³)', tooltip: 'True 3D volume from length × width × depth. Used for concrete pours, excavation, fill.' },
  { value: 'hours_days', label: 'Hours / Days', tooltip: 'Labour time in hours or days. Used for labour-only line items.' },
  { value: 'count', label: 'Count (each)', tooltip: 'Count of individual items. Similar to quantity but with per-each pricing.' },
  { value: 'curved_line', label: 'Curved Line (m)', tooltip: 'Curved or non-straight linear measurement. Used for curved flashings, gutters.' },
  { value: 'irregular_area', label: 'Irregular Area (m²)', tooltip: 'Area of irregular shapes. Measured on canvas with polygon tool.' },
  { value: 'multi_lineal', label: 'Linear: Multi-Length (m)', tooltip: 'Multiple linear measurements of the same type. Used for multiple pipe runs, cable lengths.' },
  { value: 'multi_lineal_lxh', label: 'Length x Height: Multi (m²)', tooltip: 'Multiple L×H area measurements. Used for multiple wall sections at different heights.' },
  { value: 'length_x_height_freestyle', label: 'Length x Height: Custom (m²)', tooltip: 'L×H where height is entered at measurement time. Used when heights vary per section.' },
  { value: 'multi_lineal_lxh_freestyle', label: 'L x H: Multi Custom (m²)', tooltip: 'Multiple L×H with custom heights per section. Maximum flexibility for varying wall heights.' },
];

const WASTE_TYPES: { value: WasteType; label: string; tooltip: string }[] = [
  { value: 'none', label: 'None', tooltip: 'No waste added.' },
  { value: 'percent', label: 'Percentage', tooltip: 'Waste as a percentage of measured quantity. Typical: 5-15% depending on material.' },
  { value: 'fixed', label: 'Fixed (total)', tooltip: 'Fixed waste amount added once to the total. Used for offcuts.' },
  { value: 'fixed_per_segment', label: 'Fixed (per segment)', tooltip: 'Fixed waste amount added per measurement segment. Used for per-cut waste.' },
];

const PRICING_STRATEGIES: { value: PricingStrategy; label: string; tooltip: string }[] = [
  { value: 'per_unit', label: 'Per unit (default)', tooltip: 'Price per individual unit of measurement. Most common.' },
  { value: 'per_pack_length', label: 'Fixed Quantity (e.g. 20m rolls)', tooltip: 'Priced per pack of fixed length. Used for cable reels, conduit, pipe.' },
  { value: 'per_pack_area', label: 'Fixed Quantity (e.g. 50m² bundles)', tooltip: 'Priced per pack of fixed area. Used for tile bundles, sheet packs.' },
  { value: 'per_pack_volume', label: 'Fixed Quantity (e.g. 5m³ units)', tooltip: 'Priced per pack of fixed volume. Used for concrete deliveries.' },
];

const PITCH_TYPES: { value: PitchType; label: string }[] = [
  { value: 'rafter', label: 'Rafter Pitch' },
  { value: 'valley_hip', label: 'Valley/Hip Pitch' },
];

// ─── Component ───────────────────────────────────────

interface ComponentSpec {
  name: string;
  measurementType: MeasurementType;
  wasteType: WasteType;
  wasteValue: string;
  pricePerUnit: string;
  pricingStrategy: PricingStrategy;
  packSize: string;
  labourAmount: string;
  pitchEnabled: boolean;
  pitchType: PitchType;
  pitchDegrees: string;
}

export function DraftSmartComponentTab() {
  const { areaUnit, lengthUnit, volumeUnit } = useUnitSystem();
  const { shared } = useSharedState();

  const [spec, setSpec] = useState<ComponentSpec>({
    name: 'Concrete tiles',
    measurementType: 'area',
    wasteType: 'percent',
    wasteValue: '10',
    pricePerUnit: '2.50',
    pricingStrategy: 'per_unit',
    packSize: '',
    labourAmount: '',
    pitchEnabled: true,
    pitchType: 'rafter',
    pitchDegrees: '25',
  });

  // Measurement input state
  const [areaInput, setAreaInput] = useState('');
  const [linearInput, setLinearInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [dimA, setDimA] = useState('');
  const [dimB, setDimB] = useState('');
  const [dimC, setDimC] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [entryMode, setEntryMode] = useState<'direct' | 'dims'>('direct');

  const [result, setResult] = useState<null | {
    rawValue: number;
    wasteAmount: number;
    totalValue: number;
    materialCost: number;
    labourCost: number;
    totalCost: number;
    unit: string;
  }>(null);

  const [showSavePopup, setShowSavePopup] = useState(false);
  const [showSyncHint, setShowSyncHint] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pre-fill area from shared state
  useEffect(() => {
    if (shared.calculatedArea) {
      setAreaInput(shared.calculatedArea);
      setSpec((s) => ({ ...s, measurementType: 'area' }));
    }
  }, [shared.calculatedArea]);

  const update = (key: keyof ComponentSpec, value: string | boolean) => {
    setSpec((s) => ({ ...s, [key]: value }));
  };

  function calculate() {
    const mt = spec.measurementType;
    let rawValue = 0;
    let unit = '';

    if (mt === 'area') {
      if (entryMode === 'dims') {
        rawValue = (parseFloat(dimA) || 0) * (parseFloat(dimB) || 0);
      } else {
        rawValue = parseFloat(areaInput) || 0;
      }
      unit = areaUnit;
    } else if (mt === 'lineal' || mt === 'curved_line' || mt === 'multi_lineal') {
      rawValue = parseFloat(linearInput) || 0;
      unit = lengthUnit;
    } else if (mt === 'length_x_height' || mt === 'length_x_height_freestyle' || mt === 'multi_lineal_lxh' || mt === 'multi_lineal_lxh_freestyle') {
      if (entryMode === 'dims') {
        const l = parseFloat(dimA) || 0;
        const h = parseFloat(heightInput) || 0;
        rawValue = l * h;
      } else {
        rawValue = parseFloat(areaInput) || 0;
      }
      unit = areaUnit;
    } else if (mt === 'volume') {
      if (entryMode === 'dims') {
        const a = parseFloat(dimA) || 0;
        const b = parseFloat(dimB) || 0;
        const d = parseFloat(dimC) || 0;
        rawValue = a * b * d;
      } else {
        rawValue = parseFloat(areaInput) || 0;
      }
      unit = volumeUnit;
    } else if (mt === 'volume_3d') {
      if (entryMode === 'dims') {
        const l = parseFloat(dimA) || 0;
        const w = parseFloat(dimB) || 0;
        const d = parseFloat(dimC) || 0;
        rawValue = l * w * d;
      } else {
        rawValue = parseFloat(areaInput) || 0;
      }
      unit = volumeUnit;
    } else if (mt === 'hours_days') {
      rawValue = parseFloat(quantityInput) || 0;
      unit = 'hrs';
    } else {
      // quantity, fixed, count
      rawValue = parseFloat(quantityInput) || 0;
      unit = 'units';
    }

    // Apply waste
    let wasteAmount = 0;
    if (spec.wasteType === 'percent') {
      const pct = parseFloat(spec.wasteValue) || 0;
      wasteAmount = rawValue * (pct / 100);
    } else if (spec.wasteType === 'fixed' || spec.wasteType === 'fixed_per_segment') {
      wasteAmount = parseFloat(spec.wasteValue) || 0;
    }

    const totalValue = rawValue + wasteAmount;
    const price = parseFloat(spec.pricePerUnit) || 0;

    // Pricing strategy
    let pricedQuantity = totalValue;
    if (spec.pricingStrategy !== 'per_unit' && spec.pricingStrategy !== 'per_pack_coverage') {
      const packSize = parseFloat(spec.packSize) || 1;
      if (packSize > 0) {
        pricedQuantity = Math.ceil(totalValue / packSize);
      }
    }

    const materialCost = pricedQuantity * price;
    const labourCost = parseFloat(spec.labourAmount) || 0;
    const totalCost = materialCost + labourCost;

    setResult({ rawValue, wasteAmount, totalValue, materialCost, labourCost, totalCost, unit });
  }

  useEffect(() => {
    if (result && result.totalCost > 0) {
      const dismissed = sessionStorage.getItem('qcp:sync-hint-dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => setShowSyncHint(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [result?.totalCost]);

  const mt = spec.measurementType;
  const isAreaType = mt === 'area' || mt === 'irregular_area';
  const isLxhType = mt === 'length_x_height' || mt === 'length_x_height_freestyle' || mt === 'multi_lineal_lxh' || mt === 'multi_lineal_lxh_freestyle';
  const isVolumeType = mt === 'volume' || mt === 'volume_3d';
  const isLinearType = mt === 'lineal' || mt === 'curved_line' || mt === 'multi_lineal';
  const isCountType = mt === 'quantity' || mt === 'fixed' || mt === 'count' || mt === 'hours_days';
  const hasDimToggle = isAreaType || isLxhType || isVolumeType;
  const showPackSize = spec.pricingStrategy !== 'per_unit' && spec.pricingStrategy !== 'per_pack_coverage';

  function renderMeasurementInputs() {
    if (isAreaType) {
      return entryMode === 'dims' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Width (${lengthUnit})`} value={dimA} onChange={setDimA} />
          <Field label={`Length (${lengthUnit})`} value={dimB} onChange={setDimB} />
        </div>
      ) : (
        <Field label={`Area (${areaUnit})`} value={areaInput} onChange={setAreaInput} placeholder="Enter area or use from roof area tab" />
      );
    }
    if (isLxhType) {
      return entryMode === 'dims' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Length (${lengthUnit})`} value={dimA} onChange={setDimA} />
          <Field label={`Height (${lengthUnit})`} value={heightInput} onChange={setHeightInput} />
        </div>
      ) : (
        <Field label={`Area (${areaUnit})`} value={areaInput} onChange={setAreaInput} />
      );
    }
    if (isVolumeType) {
      return entryMode === 'dims' ? (
        <div className="grid grid-cols-3 gap-3">
          <Field label={`Length (${lengthUnit})`} value={dimA} onChange={setDimA} />
          <Field label={`Width (${lengthUnit})`} value={dimB} onChange={setDimB} />
          <Field label={`Depth (${lengthUnit})`} value={dimC} onChange={setDimC} />
        </div>
      ) : (
        <Field label={`Volume (${volumeUnit})`} value={areaInput} onChange={setAreaInput} />
      );
    }
    if (isLinearType) {
      return <Field label={`Length (${lengthUnit})`} value={linearInput} onChange={setLinearInput} />;
    }
    if (isCountType) {
      const label = mt === 'hours_days' ? 'Hours' : 'Quantity';
      return <Field label={label} value={quantityInput} onChange={setQuantityInput} />;
    }
    return null;
  }

  return (
    <div ref={panelRef} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Draft Smart Component</h2>
        <p className="mt-1 text-sm text-slate-500">
          Build a component with pricing, waste, and labour rules, then calculate cost from measurements
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Component spec (full form from the app) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">Component spec</h3>

          {/* Name */}
          <FormField label="Component name" tooltip="The name of this component as it appears in quotes.">
            <input
              type="text"
              value={spec.name}
              onChange={(e) => update('name', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </FormField>

          {/* Measurement type */}
          <FormField label="Measurement type" tooltip="How this component is measured. Determines what inputs are available.">
            <select
              value={spec.measurementType}
              onChange={(e) => update('measurementType', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {MEASUREMENT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">{MEASUREMENT_TYPES.find((t) => t.value === spec.measurementType)?.tooltip}</p>
          </FormField>

          {/* Pricing strategy */}
          <FormField label="Pricing strategy" tooltip="How this component is priced. Per unit is most common.">
            <select
              value={spec.pricingStrategy}
              onChange={(e) => update('pricingStrategy', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {PRICING_STRATEGIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>

          {/* Pack size (if pack-based pricing) */}
          {showPackSize && (
            <FormField label="Pack size" tooltip="Quantity per pack. Used to calculate number of packs needed.">
              <input
                type="number"
                value={spec.packSize}
                onChange={(e) => update('packSize', e.target.value)}
                min={0}
                step={0.1}
                placeholder="e.g. 20"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </FormField>
          )}

          {/* Price per unit */}
          <FormField label="Price per unit" tooltip="Price per individual unit or per pack (depending on pricing strategy).">
            <div className="mt-1 relative">
              <span className="absolute left-3 top-2 text-sm text-slate-400">$</span>
              <input
                type="number"
                value={spec.pricePerUnit}
                onChange={(e) => update('pricePerUnit', e.target.value)}
                min={0}
                step={0.01}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </FormField>

          {/* Waste */}
          <FormField label="Waste" tooltip="Additional material added to account for cuts, breakage, and offcuts.">
            <div className="mt-1 grid grid-cols-2 gap-2">
              <select
                value={spec.wasteType}
                onChange={(e) => update('wasteType', e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              >
                {WASTE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {spec.wasteType !== 'none' && (
                <input
                  type="number"
                  value={spec.wasteValue}
                  onChange={(e) => update('wasteValue', e.target.value)}
                  min={0}
                  step={0.1}
                  placeholder={spec.wasteType === 'percent' ? '%' : 'amount'}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              )}
            </div>
          </FormField>

          {/* Labour */}
          <FormField label="Labour amount" tooltip="Fixed labour cost added to the total. For hourly labour, use Hours/Days measurement type.">
            <div className="mt-1 relative">
              <span className="absolute left-3 top-2 text-sm text-slate-400">$</span>
              <input
                type="number"
                value={spec.labourAmount}
                onChange={(e) => update('labourAmount', e.target.value)}
                min={0}
                step={0.01}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </FormField>

          {/* Pitch */}
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 space-y-3">
            <FormField label="Apply pitch calculation" tooltip="When enabled, pitch factor is applied to area measurements. Used for sloped roofs.">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={spec.pitchEnabled}
                  onChange={(e) => update('pitchEnabled', e.target.checked)}
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-slate-600">Enable pitch</span>
              </label>
            </FormField>
            {spec.pitchEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={spec.pitchType}
                  onChange={(e) => update('pitchType', e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                >
                  {PITCH_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={spec.pitchDegrees}
                  onChange={(e) => update('pitchDegrees', e.target.value)}
                  min={0}
                  max={89}
                  step={0.5}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Save as Smart Component CTA */}
          <button
            onClick={() => setShowSavePopup(true)}
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
          >
            Save as Smart Component
          </button>
        </div>

        {/* Right: Measurement input */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">Measurement</h3>

          {/* Entry mode toggle */}
          {hasDimToggle && (
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 w-fit">
              <button
                onClick={() => setEntryMode('direct')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  entryMode === 'direct' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Direct
              </button>
              <button
                onClick={() => setEntryMode('dims')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  entryMode === 'dims' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {isVolumeType ? 'L × W × D' : isLxhType ? 'L × H' : 'W × L'}
              </button>
            </div>
          )}

          {renderMeasurementInputs()}

          {shared.calculatedArea && areaInput === shared.calculatedArea && (
            <p className="text-xs text-slate-400">Pre-filled from roof area calculation</p>
          )}

          {/* Calculate button */}
          <button
            onClick={calculate}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
          >
            Calculate
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Results */}
          {result && result.totalValue > 0 && (
            <div className="space-y-3">
              <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
                <p className="text-xs text-slate-500">Total cost</p>
                <p className="text-2xl font-bold text-slate-900">${result.totalCost.toFixed(2)}</p>
                {result.labourCost > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Material: ${result.materialCost.toFixed(2)} + Labour: ${result.labourCost.toFixed(2)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Raw measurement</p>
                  <p className="text-base font-semibold text-slate-900">{result.rawValue.toFixed(2)} {result.unit}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">
                    Waste {spec.wasteType === 'percent' ? `(${spec.wasteValue}%)` : ''}
                  </p>
                  <p className="text-base font-semibold text-slate-900">+{result.wasteAmount.toFixed(2)} {result.unit}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Total quantity</p>
                  <p className="text-base font-semibold text-slate-900">{result.totalValue.toFixed(2)} {result.unit}</p>
                </div>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition select-none">
                  Show calculation
                </summary>
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-slate-600 font-mono leading-relaxed">
                    Raw = {result.rawValue.toFixed(2)} {result.unit}
                    <br />
                    {spec.wasteType === 'percent'
                      ? `Waste = ${result.rawValue.toFixed(2)} × ${spec.wasteValue}% = ${result.wasteAmount.toFixed(2)} ${result.unit}`
                      : spec.wasteType === 'fixed'
                        ? `Waste = ${spec.wasteValue} ${result.unit} (fixed)`
                        : 'Waste = none'
                    }
                    <br />
                    Total = {result.totalValue.toFixed(2)} {result.unit}
                    <br />
                    Material = ${result.materialCost.toFixed(2)}
                    {result.labourCost > 0 && ` + Labour = $${result.labourCost.toFixed(2)}`}
                    <br />
                    <strong>Total = ${result.totalCost.toFixed(2)}</strong>
                  </p>
                </div>
              </details>
            </div>
          )}

          {result && result.totalValue === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
              <p className="text-sm text-slate-500">Enter a measurement value greater than zero.</p>
            </div>
          )}
        </div>
      </div>

      {/* Save popup */}
      {showSavePopup && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900">Save as Smart Component</h3>
            <p className="mt-2 text-sm text-slate-500">
              Create a free QuoteCore+ account to save and reuse this component across quotes. Smart Components
              store materials, waste, pricing, and pitch — ready to drop into any quote.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowSavePopup(false)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Maybe later
              </button>
              <a
                href="/signup?ref=free-roofing-calculator"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800"
              >
                Create free account
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Sync hint */}
      {showSyncHint && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            Your calculations are saved on this device. Create an account to sync across devices.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href="/signup?ref=free-roofing-calculator" className="text-xs font-semibold text-[#FF6B35] hover:text-[#ff5722]">
              Sync now
            </a>
            <button
              onClick={() => { setShowSyncHint(false); sessionStorage.setItem('qcp:sync-hint-dismissed', '1'); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper components ───────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={0}
        step={0.1}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
      />
    </div>
  );
}

function FormField({ label, tooltip, children }: { label: string; tooltip: string; children: React.ReactNode }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="relative inline-flex" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
          <button
            type="button"
            onClick={() => setShowTip((s) => !s)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </button>
          {showTip && (
            <div className="absolute z-[60] left-0 top-5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
              <p className="text-xs text-slate-600 leading-relaxed">{tooltip}</p>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
