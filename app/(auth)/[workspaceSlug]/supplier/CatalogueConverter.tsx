'use client';

import { useState } from 'react';
import type { UserCollection } from '../supplier-directory/actions';

interface CatalogSummary {
  id: string;
  name: string;
  row_count: number;
  source_catalog_id: string | null;
}

type Step = 'select-catalog' | 'map-columns' | 'select-rows' | 'converting' | 'success' | 'error';

const FIELD_OPTIONS = [
  { value: 'sku', label: 'SKU / Product Code' },
  { value: 'name', label: 'Item Name (max 60 chars)' },
  { value: 'price', label: 'Price *' },
  { value: 'notes', label: 'Description (full text)' },
];

export function CatalogueConverter({
  workspaceSlug,
  collections,
  catalogs,
}: {
  workspaceSlug: string;
  collections: UserCollection[];
  catalogs: CatalogSummary[];
}) {
  const [step, setStep] = useState<Step>('select-catalog');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string[]>>({});
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [targetCollection, setTargetCollection] = useState<string>(
    collections.find(c => c.is_bootstrap)?.id ?? collections[0]?.id ?? ''
  );
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [loadingRows, setLoadingRows] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  async function handleCatalogSelect() {
    if (!selectedCatalogId) return;
    setLoadingRows(true);
    setError(null);

    try {
      const res = await fetch('/api/supplier-catalogue-rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId: selectedCatalogId, limit: 500 }),
      });
      const data = await res.json();

      if (data.ok) {
        setHeaders(data.headers);
        setAllRows(data.rows);
        // Auto-map columns by matching header names
        const autoMap: Record<string, string[]> = {};
        for (const h of data.headers as string[]) {
          const lower = h.toLowerCase().trim();
          const fields: string[] = [];
          if (lower === 'sku' || lower === 'code' || lower === 'product code') fields.push('sku');
          if (lower === 'name' || lower === 'product' || lower === 'product name' || lower === 'description') fields.push('name');
          if (lower === 'price' || lower === 'cost' || lower === 'rate') fields.push('price');
          if (lower === 'notes' || lower === 'note' || lower === 'description') {
            fields.push('notes');
            // If description and no name mapped, also map as name
            if (!fields.includes('name') && !data.headers.some((rh: string) => {
              const rl = rh.toLowerCase().trim();
              return rl === 'name' || rl === 'product' || rl === 'product name' || rl === 'item';
            })) {
              fields.push('name');
            }
          }
          autoMap[h] = fields;
        }
        setColumnMapping(autoMap);
        setStep('map-columns');
      } else {
        setError(data.error || 'Failed to load catalogue rows.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoadingRows(false);
    }
  }

  function handleProceedToRowSelect() {
    // Verify required fields are mapped
    const allMappedFields = Object.values(columnMapping).flat();
    const hasName = allMappedFields.includes('name');
    const hasPrice = allMappedFields.includes('price');
    if (!hasName || !hasPrice) {
      setError('Please map at least Item Name and Price columns.');
      return;
    }
    setError(null);
    // Default: select all rows
    setSelectedRowIndices(new Set(allRows.map((_, i) => i)));
    setStep('select-rows');
  }

  function toggleRow(idx: number) {
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    if (selectedRowIndices.size === allRows.length) {
      setSelectedRowIndices(new Set());
    } else {
      setSelectedRowIndices(new Set(allRows.map((_, i) => i)));
    }
  }

  async function handleConvert() {
    const rows = allRows.filter((_, i) => selectedRowIndices.has(i));
    if (rows.length === 0) {
      setError('Select at least one row to convert.');
      return;
    }
    if (!targetCollection) {
      setError('Select a target library.');
      return;
    }

    setStep('converting');
    setError(null);

    try {
      const res = await fetch('/api/supplier-catalogue-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCollectionId: targetCollection,
          selectedRows: rows,
          columnMapping,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setCreatedCount(data.created);
        setStep('success');
      } else {
        setError(data.errors?.[0] ?? 'Conversion failed.');
        setStep('select-rows');
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('select-rows');
    }
  }

  function handleReset() {
    setStep('select-catalog');
    setSelectedCatalogId('');
    setHeaders([]);
    setAllRows([]);
    setColumnMapping({});
    setSelectedRowIndices(new Set());
    setError(null);
    setCreatedCount(0);
    setSearchFilter('');
  }

  const filteredRows = allRows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => {
      if (!searchFilter) return true;
      return Object.values(row).some(v => v.toLowerCase().includes(searchFilter.toLowerCase()));
    });

  // Get the mapped header for a field
  function getHeaderForField(field: string): string | undefined {
    for (const [header, fields] of Object.entries(columnMapping)) {
      if (Array.isArray(fields) && fields.includes(field)) return header;
    }
    return undefined;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Catalogue Converter</h3>
          <p className="text-xs text-slate-400 mt-0.5">Convert catalogue rows into components</p>
        </div>
        {step !== 'select-catalog' && step !== 'success' && (
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
            Start over
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 mb-3">{error}</div>
      )}

      {/* Step 1: Select catalogue */}
      {step === 'select-catalog' && (
        <div className="space-y-3">
          {catalogs.length === 0 ? (
            <p className="text-sm text-slate-400">No catalogues available. Upload a CSV catalogue first.</p>
          ) : (
            <>
              <label className="text-xs font-medium text-slate-600">Select a catalogue to convert</label>
              <select
                value={selectedCatalogId}
                onChange={e => setSelectedCatalogId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              >
                <option value="">Choose a catalogue...</option>
                {catalogs.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.row_count} rows){cat.source_catalog_id ? ' - Supplier' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCatalogSelect}
                disabled={!selectedCatalogId || loadingRows}
                className="cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingRows ? 'Loading...' : 'Load Catalogue'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 'map-columns' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Map your catalogue columns to component fields. Price is required. A single column can map to multiple fields.</p>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Catalogue Column</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Maps To</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Sample Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {headers.map(h => (
                  <tr key={h}>
                    <td className="px-3 py-2 font-mono text-slate-700">{h}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 flex-wrap">
                        {FIELD_OPTIONS.map(opt => {
                          const checked = (columnMapping[h] ?? []).includes(opt.value);
                          return (
                            <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setColumnMapping(prev => {
                                    const current = prev[h] ?? [];
                                    if (current.includes(opt.value)) {
                                      return { ...prev, [h]: current.filter(v => v !== opt.value) };
                                    } else {
                                      return { ...prev, [h]: [...current, opt.value] };
                                    }
                                  });
                                }}
                                className="cursor-pointer"
                              />
                              <span className="text-slate-600">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-400 truncate max-w-[200px]">{allRows[0]?.[h] ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleProceedToRowSelect}
            className="cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Next: Select Rows
          </button>
        </div>
      )}

      {/* Step 3: Select rows */}
      {step === 'select-rows' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filter rows..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {selectedRowIndices.size} / {allRows.length} selected
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRowIndices.size === allRows.length && allRows.length > 0}
                      onChange={toggleAll}
                      className="cursor-pointer"
                    />
                  </th>
                  {headers.map(h => (
                    <th key={h} className="px-2 py-2 text-left font-medium text-slate-600 whitespace-nowrap">
                      {h}
                      {(columnMapping[h] ?? []).length > 0 && (
                        <span className="ml-1 text-[10px] text-orange-500">({columnMapping[h].join(', ')})</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRows.map(({ row, i }) => (
                  <tr key={i} className={`hover:bg-orange-50/30 ${selectedRowIndices.has(i) ? 'bg-orange-50/20' : ''}`}>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedRowIndices.has(i)}
                        onChange={() => toggleRow(i)}
                        className="cursor-pointer"
                      />
                    </td>
                    {headers.map(h => (
                      <td key={h} className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{row[h] ?? '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Import to library</label>
              <select
                value={targetCollection}
                onChange={e => setTargetCollection(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              >
                {collections.map(col => (
                  <option key={col.id} value={col.id}>
                    {col.name} ({col.component_count} components){col.is_bootstrap ? ' - Default' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleConvert}
                disabled={selectedRowIndices.size === 0 || !targetCollection}
                className="cursor-pointer rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e55a2b] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create {selectedRowIndices.size} Component{selectedRowIndices.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Converting */}
      {step === 'converting' && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-3" />
          <p className="text-sm text-slate-500">Creating components...</p>
        </div>
      )}

      {/* Success */}
      {step === 'success' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-emerald-800">
              Created {createdCount} component{createdCount !== 1 ? 's' : ''} from catalogue.
            </span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 rounded-full border border-emerald-300 px-3 py-1 cursor-pointer"
          >
            Convert More
          </button>
        </div>
      )}
    </div>
  );
}
