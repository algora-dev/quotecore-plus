'use client';

import { useEffect, useRef, useState } from 'react';
import type { BuilderComponent, MeasurementType, UnitSystem } from './types';
import { makeId, lenLabel, areaLabel } from './types';
import { ComponentEditorModal } from './ComponentEditorModal';
import { TestingPriceListModal } from './TestingPriceListModal';
import {
  guessMapping, parseCsvText, componentsFromRows,
  type ColumnMapping, type ParsedCsv,
} from './csv-import';

const MAX_COMPONENTS = 7;

/** Shared option-card styling for the step-2 entry options (matches the
 * tool landing cards; the external UX agent restyles to the v2 standard). */
const OPTION_CARD = 'group flex w-full items-start gap-4 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition-colors hover:border-orange-400 hover:bg-orange-50/40';
const OPTION_ICON = 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white';
const OPTION_ARROW = (
  <svg className="ml-auto mt-3 h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16m-6-6 6 6-6 6" />
  </svg>
);

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
  const [testingOpen, setTestingOpen] = useState(false);

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
        components.length === 0 ? (
          <div className="grid gap-3">
            <button type="button" onClick={openBuilder} className={OPTION_CARD}>
              <span className={OPTION_ICON}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Create a pricing component</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  Price one thing at a time: material + labour rates, waste and pitch rules for a single
                  item (e.g. longrun roofing per m²).
                </span>
              </span>
              {OPTION_ARROW}
            </button>
            <button type="button" onClick={() => { setError(null); setTestingOpen(true); }} className={OPTION_CARD}>
              <span className={OPTION_ICON}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Use the QuoteCore+ testing price list</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  Six ready-made roofing pricing components with testing rates. See exactly how each is
                  built, change anything, then start from there.
                </span>
              </span>
              {OPTION_ARROW}
            </button>
            <CsvImport
              cardMode
              components={components}
              setComponents={setComponents}
              maxComponents={MAX_COMPONENTS}
              onError={setError}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={openBuilder}
              className="w-full px-3 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-[#FF6B35] hover:bg-orange-50/40 text-sm text-gray-600 hover:text-gray-800 transition-all"
            >
              + Create pricing component ({components.length}/{MAX_COMPONENTS})
            </button>
            <button type="button" onClick={() => { setError(null); setTestingOpen(true); }} className="w-full px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800">
              Use the QuoteCore+ testing price list instead
            </button>
            <CsvImport
              components={components}
              setComponents={setComponents}
              maxComponents={MAX_COMPONENTS}
              onError={setError}
            />
          </div>
        )
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

      {testingOpen && (
        <TestingPriceListModal
          unitSystem={unitSystem}
          hasExisting={components.length > 0}
          onUse={(list) => { setComponents(list); setTestingOpen(false); }}
          onClose={() => setTestingOpen(false)}
        />
      )}
    </div>
  );
}

// ─── CSV import: map-columns -> select-rows, creates PARTIAL components that
// the user then completes via Edit (same modal as manual components) ───

type CsvStep = 'upload' | 'map-columns' | 'select-rows';

function CsvImport({ components, setComponents, maxComponents, onError, cardMode }: {
  components: BuilderComponent[];
  setComponents: (c: BuilderComponent[]) => void;
  maxComponents: number;
  onError: (msg: string | null) => void;
  cardMode?: boolean;
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
    if (cardMode) {
      return (
        <button type="button" onClick={() => setOpen(true)} className={OPTION_CARD}>
          <span className={OPTION_ICON}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5m0 0L7.5 12m4.5-4.5v12.75" />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Import from a CSV price list</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
              Bring your own price list: map columns, pick rows, then edit anything before you continue.
            </span>
          </span>
          {OPTION_ARROW}
        </button>
      );
    }
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

        {/* Data preview - first 3 rows so the user can verify the mapping */}
        {csv && csv.rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {csv.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {csv.rows.slice(0, 3).map((row, r) => (
                  <tr key={r}>
                    {csv.headers.map((_, c) => (
                      <td key={c} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{String(row[c] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100">Preview of first 3 rows of {csv.rows.length}</p>
          </div>
        )}
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
