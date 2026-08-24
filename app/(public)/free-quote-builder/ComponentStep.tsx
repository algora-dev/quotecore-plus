'use client';

import { useEffect, useRef, useState } from 'react';
import type { BuilderComponent, MeasurementType, UnitSystem } from './types';
import { makeId, lenLabel, areaLabel } from './types';
import { ComponentEditorModal } from './ComponentEditorModal';
import {
  guessMapping, parseCsvText, componentsFromRows,
  type ColumnMapping, type ParsedCsv,
} from './csv-import';

const MAX_COMPONENTS = 7;

interface ComponentStepProps {
  components: BuilderComponent[];
  setComponents: (c: BuilderComponent[]) => void;
  unitSystem: UnitSystem;
  onBack: () => void;
  onContinue: () => void;
  onSaveToApp: () => void;
  saving: boolean;
  saveError: string | null;
}

/** Step 2 of the wizard - same UX as the Free Roof Takeoff component step:
 * one decision per screen, component cards with Edit / Remove, the app-style
 * Create/Edit component modal, plus a CSV import option (partial rows allowed -
 * they get safe defaults and can be edited after import). */
export default function ComponentStep({ components, setComponents, unitSystem, onBack, onContinue, onSaveToApp, saving, saveError }: ComponentStepProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const full = components.length >= MAX_COMPONENTS;
  const len = lenLabel(unitSystem);
  const areaU = areaLabel(unitSystem);

  function openBuilder() {
    setError(null);
    setEditingId(null);
    setBuilderOpen(true);
  }
  function openEditBuilder(id: string) {
    setError(null);
    setEditingId(id);
    setBuilderOpen(true);
  }
  function handleBuilderSave(c: BuilderComponent, isNew: boolean) {
    setComponents(isNew ? [...components, c] : components.map(x => (x.id === c.id ? c : x)));
    setBuilderOpen(false);
  }

  return (
    <div className="mt-4 space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {components.length > 0 && (
        <div className="space-y-2">
          {components.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-orange-200 hover:bg-orange-50/40">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {c.measurementType === 'lineal' ? `Linear (${len})` : c.measurementType === 'area' ? `Area (${areaU})` : 'Quantity (ea)'}
                  {c.sku ? ` - ${c.sku}` : ''}
                  {c.materialRate > 0 || c.labourRate > 0 ? ` - $${c.materialRate} mat / $${c.labourRate} labour` : ''}
                  {c.wasteType !== 'none' ? ` - waste ${c.wasteType === 'percent' ? c.wasteValue + '%' : c.wasteValue}` : ''}
                  {c.pitchEnabled ? ' - pitch calc' : ''}
                  {c.source === 'csv' ? ' - CSV' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <button onClick={() => openEditBuilder(c.id)} className="text-xs text-slate-500 hover:text-slate-800">Edit</button>
                <button onClick={() => setComponents(components.filter(x => x.id !== c.id))} className="text-xs text-slate-400 hover:text-[#BD4A1A]">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!full ? (
        <div className="space-y-2">
          <button
            onClick={openBuilder}
            className="w-full px-3 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-[#FF6B35] hover:bg-orange-50/40 text-sm text-gray-600 hover:text-gray-800 transition-all"
          >
            + Create component {components.length > 0 ? `(${components.length}/${MAX_COMPONENTS})` : ''}
          </button>
          <CsvImport
            components={components}
            setComponents={setComponents}
            maxComponents={MAX_COMPONENTS}
            onError={setError}
          />
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center">
          {MAX_COMPONENTS} components max - a free account saves unlimited components permanently.
        </p>
      )}

      <div className="pt-2 border-t border-slate-100 space-y-2">
        <button
          onClick={onContinue}
          disabled={components.length === 0}
          className="w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
        >
          Continue to quote builder
        </button>
        {components.length === 0 && <p className="text-xs text-[#BD4A1A] text-center">Build at least one component to continue.</p>}
        <button
          onClick={onSaveToApp}
          disabled={components.length === 0 || saving}
          className="w-full py-2.5 text-sm font-medium text-slate-700 rounded-full border border-slate-300 hover:border-slate-400 disabled:opacity-40"
        >
          {saving ? 'Saving to your account...' : 'Save components to my account instead'}
        </button>
        {saveError && <p className="text-xs text-[#BD4A1A] text-center">{saveError}</p>}
        <button onClick={onBack} className="w-full py-1 text-xs text-slate-400 hover:text-slate-600">Back</button>
      </div>

      {builderOpen && (
        <ComponentEditorModal
          key={editingId ?? 'new'}
          initial={editingId ? components.find(c => c.id === editingId) ?? null : null}
          unitSystem={unitSystem}
          onSave={handleBuilderSave}
          onClose={() => setBuilderOpen(false)}
        />
      )}
    </div>
  );
}

// ─── CSV import: map-columns -> select-rows, creates PARTIAL components that
// the user then completes via Edit (same modal as manual components) ───

type CsvStep = 'upload' | 'map-columns' | 'select-rows';

function CsvImport({ components, setComponents, maxComponents, onError }: {
  components: BuilderComponent[];
  setComponents: (c: BuilderComponent[]) => void;
  maxComponents: number;
  onError: (msg: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setCsvStep] = useState<CsvStep>('upload');
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [measurementType, setMeasurementType] = useState<MeasurementType>('lineal');
  const [searchFilter, setSearchFilter] = useState('');

  function reset() {
    setCsvStep('upload');
    setCsv(null);
    setMapping({});
    setSelected(new Set());
    setSearchFilter('');
    setOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    onError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { onError('CSV too large (max 2 MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsvText(String(reader.result ?? ''));
      if (parsed.rows.length === 0) { onError('No rows found in that file.'); return; }
      setCsv(parsed);
      setMapping(guessMapping(parsed.headers));
      setCsvStep('map-columns');
    };
    reader.readAsText(file);
  }

  function proceedToRowSelect() {
    if (!csv) return;
    if (mapping.name == null) { onError('Please select a column for Component Name.'); return; }
    onError(null);
    setSelected(new Set(csv.rows.map((_, i) => i)));
    setCsvStep('select-rows');
  }

  function convert() {
    if (!csv) return;
    const room = maxComponents - components.length;
    if (room <= 0) { onError(`Free tool limit: ${maxComponents} components.`); return; }
    const created = componentsFromRows(csv, mapping, [...selected], measurementType);
    if (created.length === 0) { onError('Select at least one row to convert.'); return; }
    const add = created.slice(0, room);
    setComponents([...components, ...add]);
    if (created.length > add.length) onError(`Imported ${add.length} of ${created.length} (limit ${maxComponents}).`);
    else onError(null);
    reset();
  }

  if (!open && step === 'upload') {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full px-3 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-[#FF6B35] hover:bg-orange-50/40 text-sm text-gray-600 hover:text-gray-800 transition-all"
      >
        Import from CSV price list
      </button>
    );
  }

  if (step === 'upload') {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-700">Upload your CSV price list</p>
        <p className="mt-1 text-xs text-slate-400">
          Map columns, pick rows - imported components can be edited (add rates, waste, pitch) before you continue.
        </p>
        <label className="mt-4 inline-block cursor-pointer rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:border-slate-400 transition">
          Choose CSV file
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        <button onClick={reset} className="mt-3 block mx-auto text-xs text-slate-400 hover:text-slate-600">Cancel</button>
      </div>
    );
  }

  if (step === 'map-columns') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-sm font-medium text-slate-800">Map your columns</p>
        {csv && (
          <div className="space-y-2">
            {(['name', 'sku', 'materialRate', 'labourRate'] as const).map(f => (
              <div key={f} className="flex items-center gap-2">
                <span className="w-28 text-xs font-medium text-slate-600">
                  {f === 'name' ? 'Name *' : f === 'sku' ? 'SKU' : f === 'materialRate' ? 'Material $' : 'Labour $'}
                </span>
                <select
                  value={mapping[f] ?? ''}
                  onChange={e => setMapping({ ...mapping, [f]: e.target.value === '' ? null : Number(e.target.value) })}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none"
                >
                  <option value="">- None -</option>
                  {csv.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={proceedToRowSelect} className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
            Next: select rows
          </button>
          <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      </div>
    );
  }

  // select-rows
  const filtered = csv
    ? csv.rows.map((row, i) => ({ row, i })).filter(({ row }) => {
        if (!searchFilter) return true;
        const name = String(row[mapping.name ?? 0] ?? '').toLowerCase();
        return name.includes(searchFilter.toLowerCase());
      })
    : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <p className="text-sm font-medium text-slate-800">Select components to import</p>
      <div className="flex items-center gap-2">
        <input
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Search..."
          className="flex-1 rounded-full border border-slate-300 px-4 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
        />
        <span className="text-xs text-slate-400">{selected.size} selected</span>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
        {filtered.map(({ row, i }) => (
          <label key={i} className="flex items-center gap-2 px-3 py-2 hover:bg-orange-50/40 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={e => {
                const next = new Set(selected);
                if (e.target.checked) next.add(i); else next.delete(i);
                setSelected(next);
              }}
              className="w-4 h-4 accent-orange-500"
            />
            <span className="text-sm text-slate-700 truncate">{String(row[mapping.name ?? 0] ?? '')}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="px-3 py-4 text-xs text-slate-400 text-center">No matching rows.</p>}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={convert} disabled={selected.size === 0} className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40">
          Import {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
        <button onClick={() => setCsvStep('map-columns')} className="text-xs text-slate-500 hover:text-slate-700">Back</button>
        <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
      </div>
    </div>
  );
}
