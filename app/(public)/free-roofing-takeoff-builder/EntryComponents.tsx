'use client';

import { useState } from 'react';
import type { ComponentKind, Entry, RoofComponentDef, CustomComponentDef, PitchType } from './types';
import { COMPONENT_DEFS, computeEntry, makeId } from './calc';

type MeasureMode = 'actual' | 'plan';

function getPitchType(kind: string, customDef?: CustomComponentDef): PitchType {
  if (kind.startsWith('custom-') && customDef) return customDef.pitchType;
  const def = COMPONENT_DEFS[kind];
  return def ? def.pitchType : 'none';
}

function isAreaKind(kind: string, customDef?: CustomComponentDef): boolean {
  if (kind === 'roof_area') return true;
  if (kind.startsWith('custom-') && customDef) return customDef.measurementType === 'area';
  return false;
}

// ─── Entry List Item ─────────────────────────────────

interface EntryListItemProps {
  entry: Entry;
  index: number;
  kind: string;
  customDef?: CustomComponentDef;
  measureMode: MeasureMode;
  lenLabel: string;
  areaLabel: string;
  wastePercent: number;
  getComponentById: (id: string | null) => RoofComponentDef | null;
  onRemove: () => void;
}

export function EntryListItem({ entry, index, kind, customDef, measureMode, lenLabel, areaLabel, wastePercent, getComponentById, onRemove }: EntryListItemProps) {
  const pitchType = getPitchType(kind, customDef);
  const isRoofArea = isAreaKind(kind, customDef);
  const usePitch = measureMode === 'plan' && pitchType !== 'none';
  const unit = isRoofArea ? areaLabel : lenLabel;
  const selectedComp = getComponentById(entry.selectedComponentId);
  const withWasteVal = entry.computedValue * (1 + wastePercent / 100);

  const originalValue = usePitch
    ? (entry.isTotalInput
        ? (entry.actualValue ?? 0) * (entry.quantity ?? 1)
        : isRoofArea
          ? (entry.planWidth ?? 0) * (entry.planLengthVal ?? 0) * (entry.quantity ?? 1)
          : (entry.planLength ?? 0) * (entry.quantity ?? 1))
    : entry.computedValue;

  const inputDesc = entry.isTotalInput
    ? `Total: ${entry.actualValue ?? 0}`
    : isRoofArea
      ? `${entry.planWidth ?? 0} \u00d7 ${entry.planLengthVal ?? 0}`
      : `${entry.planLength ?? entry.actualValue ?? 0}`;

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 px-3 py-2 transition">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-700">{entry.label || `Entry ${index + 1}`}</span>
          {usePitch && <span className="text-[10px] text-slate-400">@ {entry.pitchDegrees}{'\u00b0'}</span>}
          {entry.quantity && entry.quantity > 1 && <span className="text-[10px] text-slate-400">x{entry.quantity}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-slate-400">{inputDesc}</span>
          {usePitch && originalValue > 0 && (
            <>
              <span className="text-[10px] text-slate-300">{'\u2192'}</span>
              <span className="text-[10px] text-slate-500">{entry.computedValue.toFixed(2)} {unit}</span>
            </>
          )}
          {!usePitch && (
            <span className="text-[10px] text-slate-500">{entry.computedValue.toFixed(2)} {unit}</span>
          )}
          {wastePercent > 0 && (
            <span className="text-[10px] text-slate-400">+{wastePercent}% = {withWasteVal.toFixed(2)}</span>
          )}
          {selectedComp && <span className="text-[10px] text-slate-400 truncate">{selectedComp.name}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onRemove} className="text-slate-300 hover:text-red-500 transition p-1" aria-label="Remove entry">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Add Entry Form ──────────────────────────────────

interface AddEntryFormProps {
  kind: string;
  customDef?: CustomComponentDef;
  measureMode: MeasureMode;
  lenLabel: string;
  areaLabel: string;
  availableComponents: RoofComponentDef[];
  componentsLoading: boolean;
  pitchDegrees: number;
  onAdd: (entry: Entry) => void;
}

export function AddEntryForm({ kind, customDef, measureMode, lenLabel, areaLabel, availableComponents, componentsLoading, pitchDegrees, onAdd }: AddEntryFormProps) {
  const pitchType = getPitchType(kind, customDef);
  const isRoofArea = isAreaKind(kind, customDef);
  const usePitch = measureMode === 'plan' && pitchType !== 'none';
  const planPrefix = measureMode === 'plan' ? 'Plan ' : '';

  const [areaMode, setAreaMode] = useState<'dimensions' | 'total'>(isRoofArea ? 'dimensions' : 'total');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [totalVal, setTotalVal] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [label, setLabel] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(availableComponents[0]?.id ?? null);

  const resetForm = () => { setVal1(''); setVal2(''); setTotalVal(''); setQuantity('1'); setLabel(''); };

  const handleAdd = () => {
    let entry: Entry;
    const qty = parseInt(quantity) || 1;

    if (isRoofArea) {
      if (areaMode === 'dimensions') {
        const w = parseFloat(val1);
        const l = parseFloat(val2);
        if (!w || w <= 0 || !l || l <= 0) return;
        entry = {
          id: makeId(), label, inputMode: usePitch ? 'pitch_calculated' : 'actual',
          planWidth: w, planLengthVal: l, pitchDegrees, actualValue: usePitch ? 0 : w * l, computedValue: 0,
          selectedComponentId, quantity: qty, isTotalInput: false,
        };
      } else {
        const t = parseFloat(totalVal);
        if (!t || t <= 0) return;
        entry = {
          id: makeId(), label, inputMode: usePitch ? 'pitch_calculated' : 'actual',
          pitchDegrees, actualValue: t, computedValue: 0,
          selectedComponentId, quantity: qty, isTotalInput: true,
        };
      }
    } else {
      // Linear: single length input
      const l = parseFloat(val1);
      if (!l || l <= 0) return;
      entry = {
        id: makeId(), label, inputMode: usePitch ? 'pitch_calculated' : 'actual',
        planLength: l, pitchDegrees, actualValue: usePitch ? 0 : l, computedValue: 0,
        selectedComponentId, quantity: qty, isTotalInput: false,
      };
    }

    entry.computedValue = computeEntry(entry, kind, pitchType);
    onAdd(entry);
    resetForm();
  };

  const canAdd = isRoofArea
    ? (areaMode === 'dimensions' ? (parseFloat(val1) > 0 && parseFloat(val2) > 0) : parseFloat(totalVal) > 0)
    : parseFloat(val1) > 0;

  const inputCls = "mt-0.5 w-full rounded-lg border border-slate-300 px-2 md:px-3 py-1.5 text-base md:text-sm focus:border-orange-500 focus:outline-none";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 md:p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">Add New Entry</span>
      </div>

      {isRoofArea && (
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 w-fit">
          <button onClick={() => setAreaMode('dimensions')} className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${areaMode === 'dimensions' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Width x Length</button>
          <button onClick={() => setAreaMode('total')} className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${areaMode === 'total' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Total Area</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {isRoofArea && areaMode === 'dimensions' ? (
          <>
            <div>
              <label className="text-xs font-medium text-slate-600">{planPrefix}Width ({lenLabel})</label>
              <input type="number" value={val1} onChange={(e) => setVal1(e.target.value)} min={0} step="any" inputMode="decimal" placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">{planPrefix}Length ({lenLabel})</label>
              <input type="number" value={val2} onChange={(e) => setVal2(e.target.value)} min={0} step="any" inputMode="decimal" placeholder="0" className={inputCls} />
            </div>
          </>
        ) : isRoofArea && areaMode === 'total' ? (
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">{planPrefix}Area ({areaLabel})</label>
            <input type="number" value={totalVal} onChange={(e) => setTotalVal(e.target.value)} min={0} step="any" inputMode="decimal" placeholder="0" className={inputCls} />
          </div>
        ) : (
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">{planPrefix}Length ({lenLabel})</label>
            <input type="number" value={val1} onChange={(e) => setVal1(e.target.value)} min={0} step="any" inputMode="decimal" placeholder="0" className={inputCls} />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-600">Quantity</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={1} step={1} inputMode="decimal" className={inputCls} />
        </div>

        <button onClick={handleAdd} disabled={!canAdd}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition min-h-[44px] self-end ${canAdd ? 'bg-[#FF6B35] text-white hover:bg-[#ff5722]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          <svg className="w-4 h-4 inline -mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          {' '}Add
        </button>
      </div>

      {availableComponents.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-600">Component</label>
          <select value={selectedComponentId || ''} onChange={(e) => setSelectedComponentId(e.target.value || null)}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 md:px-3 py-1.5 text-sm md:text-xs text-slate-700 focus:border-orange-500 focus:outline-none">
            <option value="">- No component (lengths only) -</option>
            {availableComponents.map(comp => (
              <option key={comp.id} value={comp.id}>{comp.name} ({'\u00A3'}{comp.price_per_unit.toFixed(2)}/{comp.unit}){comp.description ? ` - ${comp.description}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional label (e.g. Front gable, Main roof)"
        className="w-full rounded-lg border border-slate-200 px-2 md:px-3 py-1.5 text-sm md:text-xs text-slate-600 focus:border-orange-500 focus:outline-none" />
    </div>
  );
}

// ─── Custom Component Creator Form ───────────────────

interface CustomComponentCreatorProps {
  onCreate: (def: CustomComponentDef) => void;
}

export function CustomComponentCreator({ onCreate }: CustomComponentCreatorProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [measurementType, setMeasurementType] = useState<'linear' | 'area'>('linear');
  const [pitchType, setPitchType] = useState<PitchType>('none');
  const [wastePercent, setWastePercent] = useState('5');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      measurementType,
      pitchType,
      wastePercent: parseFloat(wastePercent) || 0,
    });
    setName('');
    setMeasurementType('linear');
    setPitchType('none');
    setWastePercent('5');
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 hover:border-[#FF6B35] hover:text-[#FF6B35] transition flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        Add Custom Component
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[#FF6B35] bg-orange-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">New Custom Component</span>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apron Flashing, Step Flashing"
          className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 md:px-3 py-2 text-base md:text-sm focus:border-orange-500 focus:outline-none" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Measurement</label>
          <div className="mt-0.5 flex rounded-lg border border-slate-300 overflow-hidden">
            <button onClick={() => setMeasurementType('linear')} className={`flex-1 px-2 py-1.5 text-xs font-medium transition ${measurementType === 'linear' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Linear</button>
            <button onClick={() => setMeasurementType('area')} className={`flex-1 px-2 py-1.5 text-xs font-medium transition ${measurementType === 'area' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Area</button>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Pitch calc</label>
          <select value={pitchType} onChange={(e) => setPitchType(e.target.value as PitchType)}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-orange-500 focus:outline-none">
            <option value="none">None</option>
            <option value="rafter">Rafter pitch</option>
            <option value="hip_valley">Hip/Valley pitch</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Waste %</label>
          <input type="number" value={wastePercent} onChange={(e) => setWastePercent(e.target.value)} min={0} max={100} step={1}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm md:text-xs text-center focus:border-orange-500 focus:outline-none" />
        </div>
      </div>

      <button onClick={handleCreate} disabled={!name.trim()}
        className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition ${name.trim() ? 'bg-[#FF6B35] text-white hover:bg-[#ff5722]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
        Create Component
      </button>
    </div>
  );
}
