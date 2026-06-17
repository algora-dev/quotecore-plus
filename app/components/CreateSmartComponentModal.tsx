'use client';

/**
 * CreateSmartComponentModal
 *
 * Allows the user to create a new Smart Component™ mid-quote without leaving
 * the quote builder. The form is intentionally identical to the create form in
 * the component library page — same fields, same logic, same trade-aware
 * behaviour. On save the component is persisted to the library and the
 * onCreated callback receives the new row so the caller can add it to the
 * current quote immediately.
 */

import { useState, useEffect } from 'react';
import { createComponent } from '@/app/(auth)/[workspaceSlug]/components/actions';
import { loadFlashingLibrary } from '@/app/(auth)/[workspaceSlug]/flashings/actions';
import type {
  ComponentLibraryRow,
  ComponentLibraryInsert,
  ComponentType,
  MeasurementType,
  WasteType,
  WasteUnit,
  PricingStrategy,
  MeasurementSystem,
  FlashingLibraryRow,
} from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import { getTradeLabels } from '@/app/lib/trades/labels';
import { UpgradeModal } from '@/app/components/UpgradeModal';

// ---------------------------------------------------------------------------
// Constants / helpers (mirrors component-list.tsx exactly)
// ---------------------------------------------------------------------------

const genericTradesEnabled = process.env.NEXT_PUBLIC_GENERIC_TRADES_V1 === 'true';

function buildMeasurementLabels(system: MeasurementSystem): Record<MeasurementType, string> {
  const norm = normalizeMeasurementSystem(system);
  const areaUnit = norm === 'metric' ? 'm²' : norm === 'imperial_ft' ? 'ft²' : 'RS';
  const linealUnit = norm === 'metric' ? 'm' : 'ft';
  const volumeUnit = norm === 'metric' ? 'm³' : 'ft³';
  return {
    area: `Area (${areaUnit})`,
    lineal: `Linear (${linealUnit})`,
    linear: `Linear (${linealUnit})`,
    quantity: 'Quantity',
    fixed: 'Fixed',
    length_x_height: `Length × Height (${areaUnit})`,
    volume: `Volume - Preset Depth (${volumeUnit})`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    volume_3d: `Volume (${volumeUnit})`,
    hours_days: 'Hours / Days',
    count: 'Count (each)',
    curved_line: `Curved Line (${linealUnit})`,
    irregular_area: `Irregular Area (${areaUnit})`,
    multi_lineal: `Multi-Line Total (${linealUnit})`,
    multi_lineal_lxh: `Multi-Line Height x Length (${areaUnit})`,
    length_x_height_freestyle: `Length × Height - Freestyle (${areaUnit})`,
    multi_lineal_lxh_freestyle: `Multi-Line Height × Length - Freestyle (${areaUnit})`,
  };
}

const ROOFING_DEFAULT_TYPES = new Set<MeasurementType>([
  'area',
  'lineal',
  'quantity',
  'fixed',
]);

const PRICING_STRATEGY_LABELS: Record<PricingStrategy, string> = {
  per_unit: 'Per unit (default)',
  per_pack_length: 'Per pack - by length (e.g. 20m cable rolls)',
  per_pack_area: 'Per pack - by area (e.g. 50m² underlay rolls)',
  per_pack_coverage: 'Per Coverage Area (e.g. 20L paint coverage)',
  per_pack_volume: 'Per pack - by volume (e.g. 5m³ concrete units)',
};

const WASTE_LABELS: Record<WasteType, string> = {
  none: 'None',
  percent: 'Percentage',
  fixed: 'Fixed (total)',
  fixed_per_segment: 'Fixed (per segment)',
};

const WASTE_UNIT_LABELS: Record<WasteUnit, string> = {
  percent: 'Percentage (% of measured)',
  flat: 'Flat - total length (added once to total)',
  flat_per_segment: 'Flat - per segment (added per point-to-point length)',
};

function allowedStrategiesFor(mt: MeasurementType): PricingStrategy[] {
  const base: PricingStrategy[] = ['per_unit'];
  if (['lineal', 'linear', 'multi_lineal', 'curved_line'].includes(mt)) {
    base.push('per_pack_length');
  }
  if (['area', 'length_x_height', 'length_x_height_freestyle', 'irregular_area', 'multi_lineal_lxh', 'multi_lineal_lxh_freestyle'].includes(mt)) {
    base.push('per_pack_area', 'per_pack_coverage');
  }
  if (mt === 'volume' || mt === 'volume_3d') {
    base.push('per_pack_volume');
  }
  return base;
}

// ---------------------------------------------------------------------------
// TypeSpecificFields sub-component (identical to component-list.tsx)
// ---------------------------------------------------------------------------

function TypeSpecificFields(props: {
  measurementType: MeasurementType;
  heightMm: string; setHeightMm: (v: string) => void;
  depthMm: string; setDepthMm: (v: string) => void;
  hoursUnit: 'hr' | 'day'; setHoursUnit: (v: 'hr' | 'day') => void;
}) {
  const { measurementType, heightMm, setHeightMm, depthMm, setDepthMm, hoursUnit, setHoursUnit } = props;
  if (!['length_x_height', 'multi_lineal_lxh', 'volume', 'volume_3d', 'hours_days'].includes(measurementType)) return null;
  return (
    <div className="space-y-3 mt-1">
      {(measurementType === 'length_x_height' || measurementType === 'multi_lineal_lxh') && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Component height (mm)</label>
          <input type="number" step="1" placeholder="e.g. 2400" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
          <p className="text-xs text-slate-400 mt-1">Area = measured length x height.</p>
        </div>
      )}
      {measurementType === 'volume' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Component depth (mm)</label>
          <input type="number" step="1" placeholder="e.g. 100" value={depthMm} onChange={(e) => setDepthMm(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
          <p className="text-xs text-slate-400 mt-1">Volume = measured area x depth.</p>
        </div>
      )}
      {measurementType === 'hours_days' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Time unit</label>
          <select value={hoursUnit} onChange={(e) => setHoursUnit(e.target.value as 'hr' | 'day')} className="w-full px-2 py-1 text-sm border border-slate-300 rounded">
            <option value="hr">Hours</option>
            <option value="day">Days</option>
          </select>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  measurementSystem: MeasurementSystem;
  defaultTrade: string;
  /** Default type pre-selects Main or Extra depending on which phase triggered the modal. */
  defaultComponentType: 'main' | 'extra';
  /** Company component collections for the library picker. */
  collections: { id: string; name: string; is_bootstrap: boolean }[];
  onCreated: (comp: ComponentLibraryRow) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function CreateSmartComponentModal({
  measurementSystem,
  defaultTrade,
  defaultComponentType,
  collections,
  onCreated,
  onClose,
}: Props) {
  // ------- trade-aware labels (mirrors component-list.tsx) -------
  const tradeLabels = getTradeLabels(defaultTrade);
  const pitchVisible = tradeLabels.pitchRequired || !!tradeLabels.pitchOptional;
  const pitchCheckboxLabel = tradeLabels.pitchCheckboxLabel ?? 'Apply pitch calculation';
  const pitchHidesValleyHip = !!tradeLabels.pitchHidesValleyHip;
  const pitchRafterLabel = tradeLabels.pitchRafterLabel ?? 'Rafter Pitch';
  const isRoofingTrade = defaultTrade === 'roofing';
  const featureLabel = tradeLabels.featureLabel ?? 'Flashings';
  const imageAssignLabel = isRoofingTrade ? 'Assign Flashings (Optional)' : 'Assign Image (Optional)';
  const imageSelectPlaceholder = isRoofingTrade ? 'Select a flashing...' : 'Select an image...';
  const imageHelperText = isRoofingTrade
    ? 'Add flashing drawings to use in material order forms'
    : 'Add images/drawings to use in material order forms';

  const MEASUREMENT_LABELS = buildMeasurementLabels(measurementSystem);
  const unitForMeasurement = (mt: MeasurementType) =>
    getUnitLabel(mt as 'area' | 'lineal' | 'quantity' | 'fixed', measurementSystem);
  const wasteAmountSuffix = (wt: WasteType, mt: MeasurementType): string => {
    if (wt === 'percent') return '%';
    if (wt === 'fixed') return unitForMeasurement(mt);
    return '';
  };
  const wasteAmountPlaceholder = (wt: WasteType, mt: MeasurementType): string => {
    if (wt === 'percent') return '% e.g. 10';
    return `e.g. 0.25 (${unitForMeasurement(mt)})`;
  };

  // ------- form state -------
  const [saving, setSaving] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [formMeasurementType, setFormMeasurementType] = useState<MeasurementType>('area');
  const [formWasteType, setFormWasteType] = useState<WasteType>('none');
  const [formPitchEnabled, setFormPitchEnabled] = useState(false);
  const [formPricingStrategy, setFormPricingStrategy] = useState<PricingStrategy>('per_unit');
  const [formPackPrice, setFormPackPrice] = useState('');
  const [formPackSize, setFormPackSize] = useState('');
  const [formPackCoverageM2, setFormPackCoverageM2] = useState('');
  const [formHeightMm, setFormHeightMm] = useState('');
  const [formDepthMm, setFormDepthMm] = useState('');
  const [formHoursUnit, setFormHoursUnit] = useState<'hr' | 'day'>('hr');
  const [formWasteUnit, setFormWasteUnit] = useState<WasteUnit>('percent');
  const [formNotes, setFormNotes] = useState('');
  const [assignedFlashings, setAssignedFlashings] = useState<string[]>([]);
  const [selectedFlashingId, setSelectedFlashingId] = useState('');
  const [flashings, setFlashings] = useState<FlashingLibraryRow[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    collections.find(c => c.is_bootstrap)?.id ?? collections[0]?.id ?? ''
  );

  // Load flashings on mount (same pattern as component-list.tsx)
  useEffect(() => {
    async function fetchFlashings() {
      try {
        const data = await loadFlashingLibrary();
        setFlashings(data);
      } catch {
        // Non-fatal - flashings just won't be available
      }
    }
    fetchFlashings();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const wasteAmountLabel = wasteAmountSuffix(formWasteType, formMeasurementType);
  const wasteAmountPlaceholderText = wasteAmountPlaceholder(formWasteType, formMeasurementType);

  function addFlashing() {
    if (!selectedFlashingId) return;
    if (assignedFlashings.includes(selectedFlashingId)) {
      alert('This flashing is already assigned');
      return;
    }
    setAssignedFlashings(prev => [...prev, selectedFlashingId]);
    setSelectedFlashingId('');
  }

  function removeFlashing(id: string) {
    setAssignedFlashings(prev => prev.filter(f => f !== id));
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    if (formPricingStrategy === 'per_pack_coverage') {
      if (!formPackPrice || !formPackSize || !formPackCoverageM2) {
        alert('Per Coverage Area requires Pack price, Pack size, and Coverage per pack to all be filled in.');
        setSaving(false);
        return;
      }
    }

    const fd = new FormData(e.currentTarget);
    const wasteType = fd.get('default_waste_type') as WasteType;
    const wasteAmountRaw = fd.get('waste_amount') as string || '0';
    const wasteAmount = Number(wasteAmountRaw) || 0;

    if (wasteType === 'fixed' && wasteAmountRaw.includes('.')) {
      const decimals = wasteAmountRaw.split('.')[1];
      if (decimals && decimals.length > 2) {
        alert('Reduce your decimal places to two or less (e.g. 0.25)');
        setSaving(false);
        return;
      }
    }

    const input: ComponentLibraryInsert = {
      name: fd.get('name') as string,
      component_type: fd.get('component_type') as ComponentType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      measurement_type: fd.get('measurement_type') as any,
      default_material_rate: Number(fd.get('default_material_rate')) || 0,
      default_labour_rate: Number(fd.get('default_labour_rate')) || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      default_waste_type: wasteType as any,
      default_waste_percent: wasteType === 'percent' ? wasteAmount : 0,
      default_waste_fixed: (wasteType === 'fixed' || wasteType === 'fixed_per_segment') ? wasteAmount : 0,
      default_pitch_type: formPitchEnabled ? (fd.get('default_pitch_type') as 'rafter' | 'valley_hip' | 'none') : 'none',
      eligible_for_orders: fd.get('eligible_for_orders') === 'on',
      flashing_ids: assignedFlashings.length > 0 ? assignedFlashings : null,
    };

    const fullInput = genericTradesEnabled
      ? ({
          ...input,
          height_value_mm: (formMeasurementType === 'length_x_height' || formMeasurementType === 'multi_lineal_lxh') && formHeightMm
            ? Number(formHeightMm) : null,
          depth_value_mm: formMeasurementType === 'volume' && formDepthMm
            ? Number(formDepthMm) : null,
          waste_unit: formWasteUnit,
          pricing_strategy: formPricingStrategy,
          pack_price: formPricingStrategy === 'per_unit' || !formPackPrice ? null : Number(formPackPrice),
          pack_size: formPricingStrategy === 'per_unit' || !formPackSize ? null : Number(formPackSize),
          pack_coverage_m2: formPricingStrategy === 'per_pack_coverage' && formPackCoverageM2
            ? Number(formPackCoverageM2) : null,
          collection_id: selectedCollectionId || null,
          notes: formNotes.trim() || null,
        } as unknown as ComponentLibraryInsert)
      : { ...input, collection_id: selectedCollectionId || null, notes: formNotes.trim() || null } as unknown as ComponentLibraryInsert;

    try {
      const result = await createComponent(fullInput);
      if (!result.ok) {
        if (result.code === 'component_limit_reached') {
          setUpgradeOpen(true);
        } else {
          alert(result.code === 'internal_error' ? result.message : 'Could not create Smart Component™.');
        }
        return;
      }
      onCreated(result.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create Smart Component™');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center backdrop-blur-sm bg-black/40 p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-component-modal-title"
      >
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl my-8">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
            <div>
              <h2 id="create-component-modal-title" className="text-lg font-semibold text-slate-900">
                New Smart Component™
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Saved to your library and added to this quote.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form body */}
          <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">

              {/* Name */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Name</label>
                <input
                  name="name"
                  required
                  autoFocus
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select
                  name="component_type"
                  required
                  defaultValue={defaultComponentType}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="main">Main Component</option>
                  <option value="extra">Extra</option>
                </select>
              </div>

              {/* Measurement type */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Measurement</label>
                <select
                  name="measurement_type"
                  required
                  value={formMeasurementType}
                  onChange={(e) => setFormMeasurementType(e.target.value as MeasurementType)}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                >
                  {(Object.entries(MEASUREMENT_LABELS) as Array<[MeasurementType, string]>)
                    .filter(([k]) => k !== 'linear' && k !== 'count' && k !== 'curved_line' && k !== 'irregular_area')
                    .filter(([k]) => genericTradesEnabled || ROOFING_DEFAULT_TYPES.has(k))
                    .map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                </select>
              </div>

              {/* Labour rate */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Labour Rate ({unitForMeasurement(formMeasurementType)})
                </label>
                <input
                  name="default_labour_rate"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Material pricing strategy (generic trades) */}
              {genericTradesEnabled && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Material pricing</label>
                  <select
                    value={formPricingStrategy}
                    onChange={(e) => setFormPricingStrategy(e.target.value as PricingStrategy)}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                  >
                    {allowedStrategiesFor(formMeasurementType).map((s) => (
                      <option key={s} value={s}>{PRICING_STRATEGY_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Per-unit material rate */}
              {(!genericTradesEnabled || formPricingStrategy === 'per_unit') && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Material Price ({unitForMeasurement(formMeasurementType)})
                  </label>
                  <input
                    name="default_material_rate"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {/* Pack pricing fields (generic trades) */}
              {genericTradesEnabled && formPricingStrategy !== 'per_unit' && (
                <>
                  <input type="hidden" name="default_material_rate" value="0" />
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Pack price</label>
                    <input
                      type="number" step="0.01" placeholder="e.g. 60"
                      value={formPackPrice} onChange={(e) => setFormPackPrice(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Pack size ({formPricingStrategy === 'per_pack_length' ? 'm' : formPricingStrategy === 'per_pack_area' ? 'm²' : formPricingStrategy === 'per_pack_volume' ? 'm³' : 'qty'})
                    </label>
                    <input
                      type="number" step="0.01" placeholder="e.g. 50"
                      value={formPackSize} onChange={(e) => setFormPackSize(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  {formPricingStrategy === 'per_pack_coverage' && (
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Coverage per pack (m²)</label>
                      <input
                        type="number" step="0.01" placeholder="e.g. 50"
                        value={formPackCoverageM2} onChange={(e) => setFormPackCoverageM2(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Waste type */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Waste Type</label>
                <select
                  name="default_waste_type"
                  value={formWasteType}
                  onChange={(e) => setFormWasteType(e.target.value as WasteType)}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                >
                  {Object.entries(WASTE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Waste amount */}
              {formWasteType !== 'none' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Waste Amount {wasteAmountLabel}
                  </label>
                  <input
                    name="waste_amount"
                    type="number"
                    step="0.01"
                    placeholder={wasteAmountPlaceholderText}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {/* Waste unit (generic trades, lineal types) */}
              {genericTradesEnabled && formWasteType !== 'none' && ['lineal', 'multi_lineal', 'curved_line'].includes(formMeasurementType) && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Waste unit</label>
                  <select
                    value={formWasteUnit}
                    onChange={(e) => setFormWasteUnit(e.target.value as WasteUnit)}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                  >
                    {Object.entries(WASTE_UNIT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}

            </div>

            {/* Type-specific fields (generic trades) */}
            {genericTradesEnabled && (
              <TypeSpecificFields
                measurementType={formMeasurementType}
                heightMm={formHeightMm} setHeightMm={setFormHeightMm}
                depthMm={formDepthMm} setDepthMm={setFormDepthMm}
                hoursUnit={formHoursUnit} setHoursUnit={setFormHoursUnit}
              />
            )}

            {/* Pitch (trade-dependent) */}
            {pitchVisible && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal-pitch-enabled"
                    checked={formPitchEnabled}
                    onChange={(e) => setFormPitchEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="modal-pitch-enabled" className="text-xs text-slate-700">
                    {pitchCheckboxLabel}
                  </label>
                </div>
                {formPitchEnabled && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Pitch Type</label>
                    <select name="default_pitch_type" className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg">
                      <option value="rafter">{pitchRafterLabel}</option>
                      {!pitchHidesValleyHip && <option value="valley_hip">Valley/Hip Pitch</option>}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Material Orders / flashings */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-slate-700">Material Orders</h4>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="modal-eligible-orders" name="eligible_for_orders" defaultChecked className="rounded" />
                <label htmlFor="modal-eligible-orders" className="text-xs text-slate-700">Include in material orders</label>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{imageAssignLabel}</label>
                <div className="flex gap-2">
                  <select
                    value={selectedFlashingId}
                    onChange={(e) => setSelectedFlashingId(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="">{imageSelectPlaceholder}</option>
                    {flashings.map(f => (
                      <option key={f.id} value={f.id}>{f.name}{f.description ? ` - ${f.description}` : ''}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addFlashing}
                    disabled={!selectedFlashingId}
                    className="px-3 py-1 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Add
                  </button>
                </div>
                {assignedFlashings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {assignedFlashings.map(fId => {
                      const f = flashings.find(fl => fl.id === fId);
                      return (
                        <div key={fId} className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded border border-slate-200">
                          <span className="text-xs text-slate-700">{f?.name ?? 'Unknown'}{f?.description ? ` - ${f.description}` : ''}</span>
                          <button type="button" onClick={() => removeFlashing(fId)} className="text-red-600 hover:text-red-700 text-xs font-medium">Remove</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">{imageHelperText}</p>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-slate-200 pt-4">
              <label className="block text-xs text-slate-500 mb-1">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <p className="text-xs text-slate-400 mb-1">Explainers or usage tips visible when this component is expanded.</p>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="e.g. Use for main field area. Check manufacturer spec for coverage rate."
                rows={3}
                maxLength={500}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              {formNotes.length > 0 && (
                <p className="text-xs text-slate-400 text-right mt-0.5">{formNotes.length}/500</p>
              )}
            </div>

            {/* Library / collection picker */}
            {collections.length > 0 && (
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-xs text-slate-500 mb-1">Save to Library</label>
                <select
                  value={selectedCollectionId}
                  onChange={e => setSelectedCollectionId(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                >
                  {collections.map(col => (
                    <option key={col.id} value={col.id}>
                      {col.name}{col.is_bootstrap ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save & Add to Quote'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Upgrade modal for component limit */}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => { setUpgradeOpen(false); onClose(); }}
        title="Smart Components™ library full"
        description="You've reached your component limit. Upgrade your plan to add more Smart Components™."
        recommendedPlan="growth"
      />
    </>
  );
}
