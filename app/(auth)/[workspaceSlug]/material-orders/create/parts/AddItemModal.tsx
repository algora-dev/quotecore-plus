'use client';

import { useState, useEffect, useRef } from 'react';
import type { FlashingLibraryRow } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import { convertLinear, convertArea, convertAreaFt2 } from '@/app/lib/measurements/conversions';
import { CatalogSearchModal } from '../../../quotes/[id]/customer-edit/CatalogSearchModal';
import { AngleCalculatorWidget } from '../../../drawings/draw/AngleCalculatorWidget';
import { SearchableFlashingSelect } from '@/app/components/SearchableFlashingSelect';
import { AlertModal } from '@/app/components/AlertModal';
import type { AddItemModalProps, OrderEntryMode, LengthEntry, Variable, ComponentOption, ComponentCollection } from './types';
import type { OrderLineItem } from './types';
import { ALL_LIBRARIES } from './types';

export function AddItemModal({ flashings, components = [], collections = [], workspaceSlug = '', measurementSystem = 'metric', existingLine, onSave, onCancel, showAlert }: AddItemModalProps) {
  const [showAngleCalc, setShowAngleCalc] = useState(false);
  const [angleCopied, setAngleCopied] = useState(false);

  function handleAngleApply(angle: number) {
    void navigator.clipboard.writeText(String(angle)).then(() => {
      setAngleCopied(true);
      setTimeout(() => setAngleCopied(false), 2500);
    });
  }

  // Metric vs imperial drives every unit option in this modal so the two
  // systems never mix. imperial_ft / imperial_rs / imperial all map to imperial.
  const isMetric = measurementSystem === 'metric';
  const isImperialRs = measurementSystem === 'imperial_rs' || measurementSystem === 'imperial';
  // Area unit depends on the full system: m² (metric), ft² (imperial_ft),
  // or RS Roofing Squares (imperial_rs / legacy imperial).
  const UNITS = isMetric
    ? { linear: 'm', area: 'm\u00b2', volume: 'm\u00b3' }
    : isImperialRs
      ? { linear: 'ft', area: 'RS', volume: 'ft\u00b3' }
      : { linear: 'ft', area: 'ft\u00b2', volume: 'ft\u00b3' };
  // Variable dimension units by system (Task 3): metric mm/M/°, imperial in/ft/°.
  const VAR_UNITS: { value: string; label: string }[] = isMetric
    ? [ { value: 'mm', label: 'mm' }, { value: 'm', label: 'M' }, { value: '\u00b0', label: '\u00b0' } ]
    : [ { value: 'in', label: 'in' }, { value: 'ft', label: 'ft' }, { value: '\u00b0', label: '\u00b0' } ];

  const [componentName, setComponentName] = useState(existingLine?.componentName || '');
  // Library filter for the "Add from component library" dropdown. "All" shows
  // every company component regardless of which named library it belongs to.
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(ALL_LIBRARIES);
  // Catalog search modal toggle (one of the three ways to fill the item name).
  const [showCatalogSearch, setShowCatalogSearch] = useState(false);
  const [flashingId, setFlashingId] = useState(existingLine?.flashingId || '');
  const [entryMode, setEntryMode] = useState<OrderEntryMode>(existingLine?.entryMode || 'single');
  
  // Single mode (unit dropdown removed - quantity + optional description only)
  const [quantity, setQuantity] = useState(existingLine?.quantity || 0);
  const [unit, setUnit] = useState(existingLine?.unit || 'pcs');
  
  // Linear / area / volume entries (all stored in `lengths`).
  // lengthUnit is derived from the measurement system, not user-chosen.
  const [lengths, setLengths] = useState<LengthEntry[]>(existingLine?.lengths || []);
  const entryUnit = entryMode === 'area' ? UNITS.area : entryMode === 'volume' ? UNITS.volume : UNITS.linear;
  const [newLength, setNewLength] = useState(0);
  const [newMultiplier, setNewMultiplier] = useState(1);
  // Area/volume calculator inputs (optional - user can type the total directly).
  const [calcL, setCalcL] = useState(0);
  const [calcW, setCalcW] = useState(0);
  const [calcD, setCalcD] = useState(0);
  
  // Variables for current length entry
  const [showVariables, setShowVariables] = useState(false);
  const [currentVariables, setCurrentVariables] = useState<Variable[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState(0);
  const [newVarUnit, setNewVarUnit] = useState(VAR_UNITS[0].value);
  
  const [notes, setNotes] = useState(existingLine?.notes || '');
  
  // Fixed Quantity display overrides: editable text values that show in the
  // order preview (e.g. "5" and "231.71m²"). Pre-fill from existingLine when
  // editing; empty for new items. These are order-line-only — they never
  // write back to the quote or component library.
  const [pricedQuantity, setPricedQuantity] = useState(
    existingLine?.pricedQuantity != null ? String(existingLine.pricedQuantity) : ''
  );
  // Split measurementDisplay into numeric value + unit selector so the user
  // doesn't have to type the unit manually. Parse from existingLine if present.
  // All common units available in the dropdown so the user can pick
  // whatever fits — includes RS (Roofing Squares) for imperial_rs users.
  const FIXED_QTY_UNITS = isMetric
    ? [UNITS.area, UNITS.linear, UNITS.volume]
    : isImperialRs
      ? ['RS', 'ft\u00b2', 'ft', 'ft\u00b3', 'm\u00b2', 'm']
      : ['ft\u00b2', 'ft', 'ft\u00b3', 'm\u00b2', 'm'];
  function parseMeasurementDisplay(raw: string): { value: string; unit: string } {
    if (!raw) return { value: '', unit: FIXED_QTY_UNITS[0] };
    // Try to split numeric prefix from unit suffix (e.g. "38.56m²" → "38.56" + "m²").
    const match = raw.match(/^([\d.\s]+)\s*(.*)$/);
    if (match) {
      const val = match[1].trim();
      const unit = match[2].trim();
      return { value: val, unit: unit || FIXED_QTY_UNITS[0] };
    }
    return { value: raw, unit: FIXED_QTY_UNITS[0] };
  }
  const parsedInitial = parseMeasurementDisplay(existingLine?.measurementDisplay || '');
  const [measurementValue, setMeasurementValue] = useState(parsedInitial.value);
  const [measurementUnit, setMeasurementUnit] = useState(parsedInitial.unit);
  // Toggle for showing the Fixed Quantity Display section on new items.
  // Auto-shows when editing a line that already has pricedQuantity.
  const [showFixedQty, setShowFixedQty] = useState(existingLine?.pricedQuantity != null);
  
  function addVariable() {
    if (!newVarName.trim()) {
      showAlert('Variable name required', 'Please enter a name for the variable.', 'info');
      return;
    }
    if (newVarValue <= 0) {
      showAlert('Invalid variable value', 'The variable value must be greater than 0.', 'info');
      return;
    }
    
    setCurrentVariables([...currentVariables, { 
      name: newVarName.trim(), 
      value: newVarValue, 
      unit: newVarUnit 
    }]);
    setNewVarName('');
    setNewVarValue(0);
    setNewVarUnit(VAR_UNITS[0].value);
  }
  
  function removeVariable(index: number) {
    setCurrentVariables(currentVariables.filter((_, i) => i !== index));
  }

  // Area/volume calculator: total = L x W (area) or L x W x D (volume).
  // Returns null when the relevant calc inputs aren't all filled.
  function calcTotal(): number | null {
    if (entryMode === 'area') {
      if (calcL > 0 && calcW > 0) return calcL * calcW;
      return null;
    }
    if (entryMode === 'volume') {
      if (calcL > 0 && calcW > 0 && calcD > 0) return calcL * calcW * calcD;
      return null;
    }
    return null;
  }
  
  function addLength() {
    // For area/volume the value can come from the calculator OR a typed total.
    const calc = calcTotal();
    const value = calc != null ? calc : newLength;
    if (value <= 0) {
      const label = entryMode === 'area' ? 'area' : entryMode === 'volume' ? 'volume' : 'length';
      showAlert(`Invalid ${label}`, `The ${label} must be greater than 0. Enter it directly or use the calculator.`, 'info');
      return;
    }
    if (newMultiplier <= 0) {
      showAlert('Invalid multiplier', 'The multiplier must be greater than 0.', 'info');
      return;
    }
    
    setLengths([...lengths, { 
      length: Number(value.toFixed(4)), 
      multiplier: newMultiplier,
      variables: currentVariables.length > 0 ? currentVariables : undefined,
      ...(calc != null ? { calcLength: calcL, calcWidth: calcW, ...(entryMode === 'volume' ? { calcDepth: calcD } : {}) } : {}),
    }]);
    setNewLength(0);
    setNewMultiplier(1);
    setCalcL(0);
    setCalcW(0);
    setCalcD(0);
    setCurrentVariables([]);
    setShowVariables(false);
  }
  
  function removeLength(index: number) {
    setLengths(lengths.filter((_, i) => i !== index));
  }
  
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!componentName.trim()) {
      showAlert('Component name required', 'Please enter a name for this component.', 'info');
      return;
    }

    // Parse fixed-quantity display overrides. Empty = not set (falls back to
    // normal display). pricedQuantity is parsed as a number; measurementDisplay
    // is free-text so the user can type "240m²" or anything else.
    const parsedPricedQty = pricedQuantity.trim() === '' ? undefined : parseFloat(pricedQuantity);
    // Combine numeric value + unit selector into the display string.
    const trimmedMeasurement = measurementValue.trim() === ''
      ? undefined
      : `${measurementValue.trim()}${measurementUnit}`;

    if (entryMode === 'single') {
      if (quantity <= 0) {
        showAlert('Invalid quantity', 'The quantity must be greater than 0.', 'info');
        return;
      }
      
      onSave({
        componentName: componentName.trim(),
        flashingId: flashingId || undefined,
        entryMode: 'single',
        quantity,
        // Single items no longer carry a unit dropdown; keep a neutral default
        // so existing render/save paths that read `unit` stay happy.
        unit: unit || 'pcs',
        notes: notes.trim() || undefined,
        pricedQuantity: parsedPricedQty,
        measurementDisplay: trimmedMeasurement,
      });
    } else {
      // linear / area / volume all accumulate into `lengths`.
      const label = entryMode === 'area' ? 'area' : entryMode === 'volume' ? 'volume' : 'length';
      if (lengths.length === 0) {
        showAlert(`No ${label} entries`, `Add at least one ${label} entry before saving.`, 'info');
        return;
      }
      
      onSave({
        componentName: componentName.trim(),
        flashingId: flashingId || undefined,
        entryMode,
        lengths,
        lengthUnit: entryUnit,
        notes: notes.trim() || undefined,
        pricedQuantity: parsedPricedQty,
        measurementDisplay: trimmedMeasurement,
      });
    }
  }
  
  const selectedFlashing = flashingId ? flashings.find(f => f.id === flashingId) : undefined;
  
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {existingLine ? 'Edit Order Item' : 'Add Order Item'}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">Enter component details and measurements</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Three ways to fill the item name: (1) pick from the component
              library, (2) search a catalog, (3) just type it. All three feed
              the same Component Name field below. Editing an existing item only
              needs name/image/measurements, so these pickers are add-only. */}
          {!existingLine && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Add from component library <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              {/* Library selector: pick a named library or "All components".
                  Only shown when the company has named libraries. */}
              {collections.length > 0 && (
                <select
                  value={selectedLibraryId}
                  onChange={(e) => setSelectedLibraryId(e.target.value)}
                  className="w-full px-3 py-2 mb-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  aria-label="Filter components by library"
                >
                  <option value={ALL_LIBRARIES}>All components</option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              )}
              {(() => {
                const filtered = components.filter((c) =>
                  selectedLibraryId === ALL_LIBRARIES
                    ? true
                    : (c.collection_id ?? null) === selectedLibraryId,
                );
                const showLib = selectedLibraryId === ALL_LIBRARIES && collections.length > 0;
                return (
                  <select
                    value=""
                    onChange={(e) => {
                      const picked = components.find((c) => c.id === e.target.value);
                      if (picked) setComponentName(picked.name);
                    }}
                    disabled={filtered.length === 0}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {components.length === 0
                        ? 'No saved components'
                        : filtered.length === 0
                          ? 'No components in this library'
                          : 'Choose a component…'}
                    </option>
                    {filtered.map((c) => {
                      const libName = showLib && c.collection_id
                        ? collections.find((col) => col.id === c.collection_id)?.name
                        : null;
                      return (
                        <option key={c.id} value={c.id}>
                          {libName ? `${c.name} · ${libName}` : c.name}
                        </option>
                      );
                    })}
                  </select>
                );
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Or search a catalog <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCatalogSearch(true)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-left text-slate-600 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 inline-flex items-center gap-2"
              >
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
                Search catalog items…
              </button>
            </div>
          </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Component Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              required
              placeholder="e.g., Ridge Flashing, Valley Gutter - or pick/search above"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="mt-1 text-xs text-slate-400">Pick from your library or search a catalog above, or type a custom item here.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Flashing Drawing <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <SearchableFlashingSelect
              flashings={flashings}
              value={flashingId || undefined}
              onChange={(id) => setFlashingId(id || '')}
              size="md"
              placeholder="Search drawings & images..."
            />
            {selectedFlashing && (
              <div className="mt-3 border border-slate-200 rounded-lg p-2 bg-slate-50">
                <img 
                  src={selectedFlashing.image_url} 
                  alt={selectedFlashing.name}
                  className="w-full max-w-sm mx-auto"
                />
              </div>
            )}
          </div>

          {/* Fixed Quantity Display: editable text overrides that show in the
              order preview as "Quantity: N (measurement)". Pre-fills from the
              existing line when editing. For new items, a toggle reveals the
              fields. These are order-line-only display values — they never
              write back to the quote or component library. */}
          {(existingLine?.pricedQuantity != null || showFixedQty) && (
            <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Fixed Quantity Display
                </label>
                {!existingLine?.pricedQuantity && (
                  <button
                    type="button"
                    onClick={() => setShowFixedQty(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                These values appear in the order as "Quantity: N (measurement)". Edit them to adjust what shows on this order — the quote stays unchanged.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                  <input
                    type="text"
                    value={pricedQuantity}
                    onChange={(e) => setPricedQuantity(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Measurement</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={measurementValue}
                      onChange={(e) => setMeasurementValue(e.target.value)}
                      placeholder="e.g. 231.71"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <select
                      value={measurementUnit}
                      onChange={(e) => setMeasurementUnit(e.target.value)}
                      className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {FIXED_QTY_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Show toggle to add Fixed Quantity Display for new items or items
              that don't already have it. */}
          {existingLine?.pricedQuantity == null && !showFixedQty && (
            <button
              type="button"
              onClick={() => setShowFixedQty(true)}
              className="text-sm text-[#FF6B35] hover:text-orange-700 font-medium"
            >
              + Add Fixed Quantity Display
            </button>
          )}

          {/* Item Type: defines what the measurement section below looks like.
              Linear / Area / Volume accumulate entries; Single is qty-only. */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Item Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { mode: 'area' as const, label: 'Area' },
                { mode: 'volume' as const, label: 'Volume' },
                { mode: 'linear' as const, label: 'Linear' },
                { mode: 'single' as const, label: 'Single Item' },
              ]).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setEntryMode(mode)}
                  className={`px-3 py-2 text-sm font-medium rounded-full border transition-colors ${
                    entryMode === mode
                      ? 'bg-[#FF6B35] text-white border-orange-600'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {entryMode === 'single'
                ? 'For bulk items (rolls, sheets, pieces) - quantity only'
                : entryMode === 'area'
                  ? `Area-based items, measured in ${UNITS.area}`
                  : entryMode === 'volume'
                    ? `Volume-based items, measured in ${UNITS.volume}`
                    : `Length-based items, measured in ${UNITS.linear}`}
            </p>
          </div>

          {/* Single Mode Inputs: quantity + optional description (no unit dropdown) */}
          {entryMode === 'single' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  required
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 25kg bags, 3m lengths, box of 100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {/* Linear / Area / Volume entries (all accumulate into `lengths`). */}
          {entryMode !== 'single' && (
            <div className="space-y-3">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {entryMode === 'area' ? 'Add Area Entry' : entryMode === 'volume' ? 'Add Volume Entry' : 'Add Length Entry'}
                </label>

                {/* Calculator for area / volume: L x W (x D). Optional - the
                    user can also type the total directly in the field below. */}
                {(entryMode === 'area' || entryMode === 'volume') && (
                  <div className="mb-3 p-2 rounded-lg border border-slate-200 bg-white">
                    <p className="text-xs text-slate-500 mb-2">Calculator (optional) - or type the total directly below</p>
                    <div className="flex items-center gap-2">
                      <input type="number" value={calcL || ''} onChange={(e) => setCalcL(parseFloat(e.target.value) || 0)} step="0.01" min="0" placeholder={`L (${UNITS.linear})`} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      <span className="text-slate-400">×</span>
                      <input type="number" value={calcW || ''} onChange={(e) => setCalcW(parseFloat(e.target.value) || 0)} step="0.01" min="0" placeholder={`W (${UNITS.linear})`} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      {entryMode === 'volume' && (<>
                        <span className="text-slate-400">×</span>
                        <input type="number" value={calcD || ''} onChange={(e) => setCalcD(parseFloat(e.target.value) || 0)} step="0.01" min="0" placeholder={`D (${UNITS.linear})`} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      </>)}
                    </div>
                    {calcTotal() != null && (
                      <p className="text-xs text-slate-600 mt-2">= <span className="font-medium">{calcTotal()!.toFixed(2)} {entryUnit}</span></p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={newLength || ''}
                      onChange={(e) => setNewLength(parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      placeholder={entryMode === 'area' ? `Area total (${UNITS.area})` : entryMode === 'volume' ? `Volume total (${UNITS.volume})` : 'Length (e.g., 5.55)'}
                      disabled={(entryMode === 'area' || entryMode === 'volume') && calcTotal() != null}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                  <span className="flex items-center text-slate-400 font-medium">×</span>
                  <div className="w-20">
                    <input
                      type="number"
                      value={newMultiplier || ''}
                      onChange={(e) => setNewMultiplier(parseInt(e.target.value) || 1)}
                      min="1"
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Variables Section (Optional) */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setShowVariables(!showVariables)}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors flex items-center justify-between"
                  >
                    <span>{showVariables ? '▼' : '▶'} Advanced</span>
                    {currentVariables.length > 0 && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                        {currentVariables.length}
                      </span>
                    )}
                  </button>
                  
                  {showVariables && (
                    <div className="mt-2 p-3 border border-slate-200 rounded-lg bg-white space-y-2">
                      <p className="text-xs text-slate-600">Add dimension variables (e.g., x, y, z) for custom measurements</p>
                      
                      {/* Add Variable Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value)}
                          placeholder="Name (x, y, z)"
                          maxLength={3}
                          className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        />
                        <span className="flex items-center text-slate-400">=</span>
                        <input
                          type="number"
                          value={newVarValue || ''}
                          onChange={(e) => setNewVarValue(parseFloat(e.target.value) || 0)}
                          step="0.1"
                          min="0"
                          placeholder="Value"
                          className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        />
                        <select
                          value={newVarUnit}
                          onChange={(e) => setNewVarUnit(e.target.value)}
                          className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        >
                          {VAR_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={addVariable}
                          className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-700 text-white hover:bg-slate-800"
                        >
                          Add
                        </button>
                      </div>

                      {/* Variable List */}
                      {currentVariables.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-slate-200">
                          {currentVariables.map((variable, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1.5 text-sm">
                              <span>
                                <span className="font-medium">{variable.name}</span>
                                <span className="text-slate-400 mx-1">=</span>
                                <span>{variable.value}{variable.unit}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removeVariable(idx)}
                                className="text-red-600 hover:text-red-700 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={addLength}
                  className="w-full px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  {entryMode === 'area' ? 'Add Area Entry' : entryMode === 'volume' ? 'Add Volume Entry' : 'Add Length Entry'}
                </button>

                {/* Entry List */}
                {lengths.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600 uppercase">
                      {entryMode === 'area' ? 'Added Areas:' : entryMode === 'volume' ? 'Added Volumes:' : 'Added Lengths:'}
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {lengths.map((entry, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">
                              <span className="font-medium">{entry.length}{entryUnit}</span>
                              <span className="text-slate-400 mx-2">×</span>
                              <span className="text-slate-600">{entry.multiplier}</span>
                              {entry.calcLength != null && entry.calcWidth != null && (
                                <span className="text-xs text-slate-400 italic ml-2">
                                  ({entry.calcLength}×{entry.calcWidth}{entry.calcDepth != null ? `×${entry.calcDepth}` : ''})
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLength(idx)}
                              className="text-red-600 hover:text-red-700 text-xs font-medium"
                            >
                              Remove
                            </button>
                          </div>
                          {entry.variables && entry.variables.length > 0 && (
                            <div className="text-xs text-slate-600 pl-2 border-l-2 border-slate-200">
                              {entry.variables.map((v, vIdx) => (
                                <span key={vIdx} className="mr-2">
                                  <span className="font-medium">{v.name}</span>=<span>{v.value}{v.unit}</span>
                                  {vIdx < entry.variables!.length - 1 && <span className="text-slate-400">, </span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Single-item mode already exposes `notes` as its Description field
              above, so the general Notes textarea is hidden there to avoid two
              inputs bound to the same state. */}
          {entryMode !== 'single' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or specifications..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setShowAngleCalc(true)}
            className="px-6 py-2.5 text-sm font-medium rounded-full border-2 border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 transition-colors"
          >
            Angle Calc
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors shadow-sm"
          >
            {existingLine ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>

      {/* Catalog search - reuses the same modal as the blank-quote builder.
          On pick it fills the Component Name (and appends the quantity text if
          the catalog has one). It does not touch price; order lines price
          separately. */}
      {showCatalogSearch && (
        <CatalogSearchModal
          workspaceSlug={workspaceSlug}
          onAdd={(text, _amount, _showPrice, quantity) => {
            const composed = quantity ? `${text} - ${quantity}` : text;
            setComponentName(composed);
            setShowCatalogSearch(false);
          }}
          onClose={() => setShowCatalogSearch(false)}
        />
      )}

      {/* Angle Calculator — floating draggable widget so the user can
          calculate an angle, copy it, and paste into any input without
          closing the calculator. */}
      <AngleCalculatorWidget
        isOpen={showAngleCalc}
        onClose={() => setShowAngleCalc(false)}
        onApply={handleAngleApply}
        currentAngle={0}
      />

      {/* Clipboard confirmation toast */}
      {angleCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full shadow-lg pointer-events-none">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Angle copied to clipboard!
        </div>
      )}
    </div>
  );
}
