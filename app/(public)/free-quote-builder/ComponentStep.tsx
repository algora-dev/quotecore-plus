'use client';

import { useRef, useState } from 'react';
import type { BuilderComponent, MeasureMode, MeasurementType } from './types';
import { makeId, lenLabel, areaLabel } from './types';
import {
  MAPPABLE_FIELDS, guessMapping, parseCsvText, componentsFromRows,
  type ColumnMapping, type ParsedCsv,
} from './csv-import';

const MAX_COMPONENTS = 7;

interface ComponentStepProps {
  components: BuilderComponent[];
  setComponents: (c: BuilderComponent[]) => void;
  measureMode: MeasureMode;
  unitSystem: 'metric' | 'imperial' | 'squares';
  onBack: () => void;
  onContinue: () => void;
  onSaveToApp: () => void;
}

export default function ComponentStep({ components, setComponents, measureMode, unitSystem, onBack, onContinue, onSaveToApp }: ComponentStepProps) {
  const [tab, setTab] = useState<'manual' | 'csv'>('manual');
  const [name, setName] = useState('');
  const [measurementType, setMeasurementType] = useState<MeasurementType>('lineal');
  const [materialRate, setMaterialRate] = useState('');
  const [labourRate, setLabourRate] = useState('');
  const [wastePercent, setWastePercent] = useState('');
  const [pitchEnabled, setPitchEnabled] = useState(false);
  const [pitchType, setPitchType] = useState<'rafter' | 'valley_hip'>('rafter');
  const [packSize, setPackSize] = useState('');
  const [packPrice, setPackPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  // CSV state
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [csvMeasurementType, setCsvMeasurementType] = useState<MeasurementType>('lineal');

  const full = components.length >= MAX_COMPONENTS;
  const len = lenLabel(unitSystem);
  const areaU = areaLabel(unitSystem);
  const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
    lineal: `Length (${len})`,
    area: `Area (${areaU})`,
    quantity: 'Quantity (pcs)',
  };

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
      pitchEnabled,
      pitchType: pitchEnabled ? pitchType : 'none',
      source: 'manual',
    }]);
    setName(''); setMaterialRate(''); setLabourRate(''); setWastePercent(''); setPackSize(''); setPackPrice(''); setPitchEnabled(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { setError('CSV too large (max 2 MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsvText(String(reader.result ?? ''));
      if (parsed.rows.length === 0) { setError('No rows found in that file.'); setCsv(null); return; }
      setCsv(parsed);
      setMapping(guessMapping(parsed.headers));
      setSelected(new Set(parsed.rows.map((_, i) => i)));
    };
    reader.readAsText(file);
  }

  function importSelected() {
    setError(null);
    if (!csv) return;
    if (mapping.name == null) { setError('Map the "Component name" column first.'); return; }
    const created = componentsFromRows(csv, mapping, [...selected], csvMeasurementType);
    if (created.length === 0) { setError('No components created - check your selection and mapping.'); return; }
    const room = MAX_COMPONENTS - components.length;
    if (room <= 0) { setError(`Free tool limit: ${MAX_COMPONENTS} components.`); return; }
    const add = created.slice(0, room);
    setComponents([...components, ...add]);
    setCsv(null);
    if (fileRef.current) fileRef.current.value = '';
    if (created.length > add.length) setError(`Imported ${add.length} of ${created.length} (limit ${MAX_COMPONENTS}).`);
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base md:text-lg font-bold text-slate-900">Build your components</h2>
        <p className="mt-0.5 text-xs md:text-sm text-slate-400">
          Add up to {MAX_COMPONENTS} components one at a time, or import them from a CSV catalog. These are your smart components - they carry pricing, labour, waste and pitch logic.
          {measureMode === 'plan' && ' Plan measurements are active: enable pitch per component and it gets applied automatically in step 3.'}
        </p>
        <div className="mt-3 flex gap-2">
          {([['manual', 'Add manually'], ['csv', 'Import CSV']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${tab === k ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'manual' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="comp-name">Component name</label>
              <input id="comp-name" className={`${inputCls} mt-1`} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Colorsteel roofing" maxLength={120} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="comp-type">Measured by</label>
              <select id="comp-type" className={`${inputCls} mt-1`} value={measurementType} onChange={e => setMeasurementType(e.target.value as MeasurementType)}>
                {(Object.keys(MEASUREMENT_LABELS) as MeasurementType[]).map(k => <option key={k} value={k}>{MEASUREMENT_LABELS[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="comp-mat">Material price / unit</label>
              <input id="comp-mat" type="number" min="0" step="0.01" className={`${inputCls} mt-1`} value={materialRate} onChange={e => setMaterialRate(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="comp-lab">Labour rate / unit</label>
              <input id="comp-lab" type="number" min="0" step="0.01" className={`${inputCls} mt-1`} value={labourRate} onChange={e => setLabourRate(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="comp-waste">Waste %</label>
              <input id="comp-waste" type="number" min="0" max="100" step="1" className={`${inputCls} mt-1`} value={wastePercent} onChange={e => setWastePercent(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600" htmlFor="comp-pack">Pack size / pack price (optional)</label>
              <div className="mt-1 flex gap-2">
                <input id="comp-pack" type="number" min="0" step="0.01" className={inputCls} value={packSize} onChange={e => setPackSize(e.target.value)} placeholder="Size" />
                <input type="number" min="0" step="0.01" className={inputCls} value={packPrice} onChange={e => setPackPrice(e.target.value)} placeholder="Price" aria-label="Pack price" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input type="checkbox" checked={pitchEnabled} onChange={e => setPitchEnabled(e.target.checked)} className="rounded border-slate-300 text-orange-500 focus:ring-0" />
              Apply pitch factor
            </label>
            {pitchEnabled && (
              <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none" value={pitchType} onChange={e => setPitchType(e.target.value as 'rafter' | 'valley_hip')} aria-label="Pitch type">
                <option value="rafter">Rafter pitch</option>
                <option value="valley_hip">Hip / valley pitch</option>
              </select>
            )}
          </div>
          <div className="flex justify-end">
            <button onClick={addManual} disabled={full} className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">
              Add component ({components.length}/{MAX_COMPONENTS})
            </button>
          </div>
        </div>
      )}

      {tab === 'csv' && !csv && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-600">Upload a CSV export of your price list or catalog.</p>
          <p className="mt-1 text-xs text-slate-400">You will map your columns (name, price, labour, waste, packs) and pick the rows to import.</p>
          <label className="mt-4 inline-flex cursor-pointer items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Choose CSV file
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
        </div>
      )}

      {tab === 'csv' && csv && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">1. Map your columns</h3>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              {MAPPABLE_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-slate-600">{f.label}{f.required ? ' *' : ''}</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none"
                    value={mapping[f.key] ?? ''}
                    onChange={e => {
                      const v = e.target.value === '' ? undefined : Number(e.target.value);
                      setMapping(m => ({ ...m, [f.key]: v } as ColumnMapping));
                    }}>
                    <option value="">Not mapped</option>
                    {csv.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">2. How are these measured?</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(MEASUREMENT_LABELS) as MeasurementType[]).map(k => (
                <button key={k} onClick={() => setCsvMeasurementType(k)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${csvMeasurementType === k ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
                  {MEASUREMENT_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">3. Pick rows ({selected.size} selected)</h3>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(csv.rows.map((_, i) => i)))} className="text-xs font-medium text-[#BD4A1A] hover:underline">Select all</button>
                <button onClick={() => setSelected(new Set())} className="text-xs font-medium text-slate-400 hover:underline">Clear</button>
              </div>
            </div>
            <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-2 py-2 w-8"></th>
                    {csv.headers.map((h, i) => <th key={i} className="px-2 py-2 text-left font-medium text-slate-500">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {csv.rows.slice(0, 200).map((row, ri) => (
                    <tr key={ri} className={`border-t border-slate-100 hover:bg-orange-50/40 ${selected.has(ri) ? 'bg-orange-50/40' : 'bg-white'}`}>
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={selected.has(ri)} onChange={e => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(ri); else next.delete(ri);
                          setSelected(next);
                        }} className="rounded border-slate-300 text-orange-500 focus:ring-0" aria-label={`Select row ${ri + 1}`} />
                      </td>
                      {row.map((c, ci) => <td key={ci} className="px-2 py-1.5 text-slate-600 max-w-40 truncate">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csv.rows.length > 200 && <p className="mt-1 text-xs text-slate-400">Showing first 200 of {csv.rows.length} rows.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setCsv(null); if (fileRef.current) fileRef.current.value = ''; }} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400">Cancel</button>
            <button onClick={importSelected} className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Import selected ({selected.size})</button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

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
                  <span>{c.measurementType === 'lineal' ? `Length (${len})` : c.measurementType === 'area' ? `Area (${areaU})` : 'Quantity (pcs)'}</span>
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
