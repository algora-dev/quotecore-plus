'use client';

import { useEffect, useRef, useState } from 'react';
import type { BuilderComponent, MeasurementType, UnitSystem } from './types';
import { makeId, lenLabel, areaLabel } from './types';
import {
  guessMapping, parseCsvText, componentsFromRows,
  type ColumnMapping, type ParsedCsv,
} from './csv-import';
import { MAPPABLE_FIELDS } from './csv-import';

const MAX_COMPONENTS = 7;

interface ComponentStepProps {
  components: BuilderComponent[];
  setComponents: (c: BuilderComponent[]) => void;
  unitSystem: UnitSystem;
  onBack: () => void;
  onContinue: () => void;
  onSaveToApp: () => void;
}

export default function ComponentStep({ components, setComponents, unitSystem, onBack, onContinue, onSaveToApp }: ComponentStepProps) {
  const [tab, setTab] = useState<'manual' | 'csv'>('manual');
  const [name, setName] = useState('');
  const [measurementType, setMeasurementType] = useState<MeasurementType>('lineal');
  const [materialRate, setMaterialRate] = useState('');
  const [labourRate, setLabourRate] = useState('');
  const [wastePercent, setWastePercent] = useState('5');
  const [pitchType, setPitchType] = useState<'none' | 'rafter' | 'valley_hip'>('none');
  const [packSize, setPackSize] = useState('');
  const [packPrice, setPackPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const full = components.length >= MAX_COMPONENTS;
  const len = lenLabel(unitSystem);
  const areaU = areaLabel(unitSystem);

  function addManual() {
    setError(null);
    if (!name.trim()) { setError('Give your component a name.'); return; }
    if (full) { setError(`Free tool limit: ${MAX_COMPONENTS} components.`); return; }
    const ps = parseFloat(packSize) || 0;
    const pp = parseFloat(packPrice) || 0;
    const isPack = ps > 0 && pp > 0;
    setComponents([...components, {
      id: makeId('comp'),
      name: name.trim().slice(0, 120),
      measurementType,
      materialRate: parseFloat(materialRate) || 0,
      labourRate: parseFloat(labourRate) || 0,
      pricingStrategy: isPack ? (measurementType === 'area' ? 'per_pack_area' : 'per_pack_length') : 'per_unit',
      packPrice: isPack ? pp : null,
      packSize: isPack ? ps : null,
      wasteType: (parseFloat(wastePercent) || 0) > 0 ? 'percent' : 'none',
      wasteValue: parseFloat(wastePercent) || 0,
      pitchEnabled: pitchType !== 'none' && measurementType !== 'quantity',
      pitchType: pitchType === 'none' ? 'none' : pitchType,
      source: 'manual',
    }]);
    setName(''); setMaterialRate(''); setLabourRate(''); setPackSize(''); setPackPrice('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base md:text-lg font-bold text-slate-900">Step 2: Build your components</h2>
        <p className="mt-0.5 text-xs md:text-sm text-slate-400">
          Add up to {MAX_COMPONENTS} smart components with pricing, labour, waste and pitch logic - one at a time, or import from a CSV catalog.
        </p>
        <div className="mt-3 flex gap-2">
          {([['manual', 'Add manually'], ['csv', 'Import CSV catalog']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${tab === k ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {tab === 'manual' && (
        <div className="rounded-xl border-2 border-[#FF6B35] bg-orange-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">New Component</span>
          </div>
          <div>
            <label htmlFor="comp-name" className="text-xs font-medium text-slate-600">Name</label>
            <input id="comp-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Apron Flashing, Colorsteel Roofing"
              className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Measurement</label>
              <div className="mt-0.5 flex rounded-lg border border-slate-300 overflow-hidden">
                <button onClick={() => setMeasurementType('lineal')} className={`flex-1 px-2 py-1.5 text-xs font-medium transition ${measurementType === 'lineal' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Linear</button>
                <button onClick={() => setMeasurementType('area')} className={`flex-1 px-2 py-1.5 text-xs font-medium transition ${measurementType === 'area' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Area</button>
                <button onClick={() => setMeasurementType('quantity')} className={`flex-1 px-2 py-1.5 text-xs font-medium transition ${measurementType === 'quantity' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Fixed</button>
              </div>
            </div>
            <div>
              <label htmlFor="comp-pitch" className="text-xs font-medium text-slate-600">Pitch calc</label>
              <select id="comp-pitch" value={measurementType === 'quantity' ? 'none' : pitchType} onChange={e => setPitchType(e.target.value as 'none' | 'rafter' | 'valley_hip')} disabled={measurementType === 'quantity'}
                className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400">
                <option value="none">None</option>
                <option value="rafter">Rafter pitch</option>
                <option value="valley_hip">Hip/Valley pitch</option>
              </select>
            </div>
            <div>
              <label htmlFor="comp-waste" className="text-xs font-medium text-slate-600">Waste %</label>
              <input id="comp-waste" type="number" value={measurementType === 'quantity' ? '0' : wastePercent} onChange={e => setWastePercent(e.target.value)} min={0} max={100} step={1} disabled={measurementType === 'quantity'}
                className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:border-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label htmlFor="comp-mat" className="text-xs font-medium text-slate-600">Material $/unit</label>
              <input id="comp-mat" type="number" min="0" step="0.01" value={materialRate} onChange={e => setMaterialRate(e.target.value)} placeholder="0.00"
                className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="comp-lab" className="text-xs font-medium text-slate-600">Labour $/unit</label>
              <input id="comp-lab" type="number" min="0" step="0.01" value={labourRate} onChange={e => setLabourRate(e.target.value)} placeholder="0.00"
                className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="comp-pack-size" className="text-xs font-medium text-slate-600">Pack size (opt.)</label>
              <input id="comp-pack-size" type="number" min="0" step="0.01" value={packSize} onChange={e => setPackSize(e.target.value)} placeholder="0"
                className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="comp-pack-price" className="text-xs font-medium text-slate-600">Pack price (opt.)</label>
              <input id="comp-pack-price" type="number" min="0" step="0.01" value={packPrice} onChange={e => setPackPrice(e.target.value)} placeholder="0.00"
                className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
            </div>
          </div>
          {measurementType === 'quantity' && <p className="text-xs text-slate-400">Fixed components are priced per piece. Enter the quantity when adding entries.</p>}
          <button onClick={addManual} disabled={!name.trim() || full}
            className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition ${name.trim() && !full ? 'bg-[#FF6B35] text-white hover:bg-[#A03E15]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
            Create Component ({components.length}/{MAX_COMPONENTS})
          </button>
        </div>
      )}

      {tab === 'csv' && (
        <CsvImport
          components={components}
          setComponents={setComponents}
          maxComponents={MAX_COMPONENTS}
          onError={setError}
        />
      )}

      {components.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Your components ({components.length}/{MAX_COMPONENTS})</h3>
          {components.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:bg-orange-50/40 hover:border-orange-200">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">{c.name}</span>
                  {c.source === 'csv' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">CSV</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-400">
                  <span>{c.measurementType === 'lineal' ? `Linear (${len})` : c.measurementType === 'area' ? `Area (${areaU})` : 'Fixed (pcs)'}</span>
                  {c.materialRate > 0 && <span>${c.materialRate.toFixed(2)} mat</span>}
                  {c.labourRate > 0 && <span>${c.labourRate.toFixed(2)} labour</span>}
                  {c.wasteValue > 0 && <span>+{c.wasteValue}% waste</span>}
                  {c.packSize && c.packPrice && <span>pack {c.packSize} / ${c.packPrice.toFixed(2)}</span>}
                  {c.pitchEnabled && <span>pitch: {c.pitchType === 'rafter' ? 'rafter' : 'hip/valley'}</span>}
                </div>
              </div>
              <button onClick={() => setComponents(components.filter(x => x.id !== c.id))} className="p-1 text-slate-300 hover:text-red-500 transition" aria-label={`Remove ${c.name}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {components.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button onClick={onBack} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-400">Back</button>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onSaveToApp} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-400">
              Save components to my account
            </button>
            <button onClick={onContinue} className="rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#A03E15]">
              Continue to quote builder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CSV import: same map-columns → select-rows flow as the in-app Catalogue Converter ───

type CsvStep = 'upload' | 'map-columns' | 'select-rows';

function CsvImport({ components, setComponents, maxComponents, onError }: {
  components: BuilderComponent[];
  setComponents: (c: BuilderComponent[]) => void;
  maxComponents: number;
  onError: (msg: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
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
    reset();
  }

  if (step === 'upload') {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-slate-600">Upload a CSV export of your price list or catalog.</p>
        <p className="mt-1 text-xs text-slate-400">You will map your columns to component fields, then select the rows to convert - just like the QuoteCore+ catalog converter.</p>
        <label className="mt-4 inline-flex cursor-pointer items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
          Choose CSV file
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
      </div>
    );
  }

  if (!csv) return null;

  // Step: map columns (field-first, exactly like the in-app converter)
  if (step === 'map-columns') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Map your catalog columns</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Only Component Name is required. We auto-detected matches where possible.</p>
          </div>
          <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">Start over</button>
        </div>
        <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {MAPPABLE_FIELDS.map(field => {
            const selectedHeader = mapping[field.key] != null ? csv.headers[mapping[field.key]!] : '';
            const isNameUnset = field.required && !selectedHeader;
            return (
              <div key={field.key} className="flex items-center justify-between px-4 py-2.5 gap-3 bg-slate-50/50 border-b border-slate-200 last:border-b-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-slate-700">{field.label}</span>
                  {field.required && <span className="text-red-500 text-xs">*</span>}
                  {isNameUnset && <span className="text-[10px] text-orange-500 font-medium">required</span>}
                </div>
                <select
                  value={selectedHeader}
                  onChange={e => {
                    const idx = e.target.value === '' ? undefined : csv.headers.indexOf(e.target.value);
                    setMapping(m => ({ ...m, [field.key]: idx } as ColumnMapping));
                  }}
                  className={`text-xs rounded-lg border px-2 py-1.5 focus:border-orange-500 focus:outline-none min-w-[140px] ${isNameUnset ? 'border-orange-300 ring-1 ring-orange-200' : 'border-slate-300'}`}>
                  <option value="">Select a column...</option>
                  {csv.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            );
          })}
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">How are these components measured?</label>
          <div className="mt-1 flex rounded-lg border border-slate-300 overflow-hidden w-fit">
            <button onClick={() => setMeasurementType('lineal')} className={`px-3 py-1.5 text-xs font-medium transition ${measurementType === 'lineal' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Linear</button>
            <button onClick={() => setMeasurementType('area')} className={`px-3 py-1.5 text-xs font-medium transition ${measurementType === 'area' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Area</button>
            <button onClick={() => setMeasurementType('quantity')} className={`px-3 py-1.5 text-xs font-medium transition ${measurementType === 'quantity' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Fixed</button>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={proceedToRowSelect} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
            Continue to row selection
          </button>
        </div>
      </div>
    );
  }

  // Step: select rows (search + select all, like the in-app converter)
  const filtered = csv.rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => !searchFilter || row.some(v => v.toLowerCase().includes(searchFilter.toLowerCase())));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Select rows to convert</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{selected.size} of {csv.rows.length} rows selected{selected.size > 0 ? ` (limit ${maxComponents - components.length} for this tool)` : ''}</p>
        </div>
        <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">Start over</button>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Search rows..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          aria-label="Search rows" />
        <button onClick={() => setSelected(selected.size === csv.rows.length ? new Set() : new Set(csv.rows.map((_, i) => i)))} className="flex-shrink-0 rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-400">
          {selected.size === csv.rows.length ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th className="px-2 py-2 w-8"></th>
              {csv.headers.map((h, i) => <th key={i} className="px-2 py-2 text-left font-medium text-slate-500">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(({ row, i }) => (
              <tr key={i} className={`border-t border-slate-100 hover:bg-orange-50/40 ${selected.has(i) ? 'bg-orange-50/40' : 'bg-white'}`}>
                <td className="px-2 py-1.5">
                  <input type="checkbox" checked={selected.has(i)} onChange={e => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(i); else next.delete(i);
                    setSelected(next);
                  }} className="rounded border-slate-300 text-orange-500 focus:ring-0" aria-label={`Select row ${i + 1}`} />
                </td>
                {row.map((c, ci) => <td key={ci} className="px-2 py-1.5 text-slate-600 max-w-40 truncate">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 200 && <p className="text-xs text-slate-400">Showing first 200 matches of {filtered.length}.</p>}
      <div className="flex justify-end gap-2">
        <button onClick={() => setCsvStep('map-columns')} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400">Back</button>
        <button onClick={convert} disabled={selected.size === 0} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40">
          Convert {selected.size} row{selected.size === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}
