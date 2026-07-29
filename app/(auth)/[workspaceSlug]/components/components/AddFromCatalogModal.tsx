'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  listUserCatalogs,
  searchPublicCatalogs,
  fetchCatalogRows,
  convertCatalogRowsToComponents,
  type UserCatalogSummary,
  type PublicCatalogSummary,
} from '../catalog-actions';
import type { ComponentLibraryRow } from '@/app/lib/types';

type ModalStep = 'select-catalog' | 'view-rows' | 'destination' | 'creating' | 'success' | 'error';
type CatalogTab = 'my-catalogs' | 'supplier-catalogs';

const MAX_ROWS = 20;
const NAME_CHAR_LIMIT = 60;

// Field-first mapping: each component field gets a dropdown of catalog columns.
// Only `name` is required. The columnMapping state stays Record<string, string[]>
// (header -> fields[]) for backend compatibility.
const MAPPABLE_FIELDS = [
  { value: 'name', label: 'Component Name', required: true, placeholder: 'Select a column...' },
  { value: 'sku', label: 'SKU / Product Code', required: false, placeholder: 'Select a column...' },
  { value: 'price', label: 'Price', required: false, placeholder: 'Select a column...' },
  { value: 'notes', label: 'Description / Notes', required: false, placeholder: 'Select a column...' },
] as const;

interface CatalogCollection {
  id: string;
  name: string;
  is_bootstrap: boolean;
  component_count?: number;
}

export function AddFromCatalogModal({
  workspaceSlug,
  collections,
  onClose,
  onCreated,
}: {
  workspaceSlug: string;
  collections: CatalogCollection[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<ModalStep>('select-catalog');
  const [tab, setTab] = useState<CatalogTab>('my-catalogs');

  // Catalog lists
  const [myCatalogs, setMyCatalogs] = useState<UserCatalogSummary[]>([]);
  const [publicCatalogs, setPublicCatalogs] = useState<PublicCatalogSummary[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected catalog rows
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowSearchFilter, setRowSearchFilter] = useState('');

  // Column mapping - stored as Record<string, string[]> (header -> fields[]) for backend compat,
  // but the UI is field-first: user picks a column for each field via dropdown.
  const [columnMapping, setColumnMapping] = useState<Record<string, string[]>>({});
  // fieldToHeader: which catalog column is assigned to each field (field -> header | '')
  const [fieldToHeader, setFieldToHeader] = useState<Record<string, string>>({});

  // Row selection
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());

  // Incremental rendering for large catalogs
  const VISIBLE_INCREMENT = 500;
  const SEARCH_RENDER_LIMIT = 500;
  const [visibleCount, setVisibleCount] = useState(VISIBLE_INCREMENT);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  // Destination
  const [destMode, setDestMode] = useState<'existing' | 'new'>('existing');
  const [existingCollectionId, setExistingCollectionId] = useState(
    collections.find(c => c.is_bootstrap)?.id ?? collections[0]?.id ?? ''
  );
  const [newLibraryName, setNewLibraryName] = useState('');

  // Result
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  // ── Load catalogs on mount ──────────────────────────────────────────
  const loadMyCatalogs = useCallback(async () => {
    setLoadingCatalogs(true);
    try {
      const result = await listUserCatalogs();
      setMyCatalogs(result);
    } catch {
      setError('Failed to load your catalogs.');
    } finally {
      setLoadingCatalogs(false);
    }
  }, []);

  const loadPublicCatalogs = useCallback(async (q?: string) => {
    setLoadingCatalogs(true);
    try {
      const result = await searchPublicCatalogs({ query: q });
      setPublicCatalogs(result);
    } catch {
      setError('Failed to load supplier catalogs.');
    } finally {
      setLoadingCatalogs(false);
    }
  }, []);

  // Load my catalogs on first render
  useMemo(() => {
    void loadMyCatalogs();
  }, [loadMyCatalogs]);

  // ── Catalog selection ───────────────────────────────────────────────
  async function handleCatalogClick(catalogId: string, catalogHeaders: string[]) {
    setLoadingRows(true);
    setError(null);
    setStep('view-rows');

    try {
      const result = await fetchCatalogRows(catalogId);
      if (result.ok && result.headers && result.rows) {
        setHeaders(result.headers);
        setAllRows(result.rows);
        // Auto-map: build fieldToHeader by matching header names to known field patterns
        const autoFieldMap: Record<string, string> = {};
        for (const h of result.headers) {
          const lower = h.toLowerCase().trim();
          if (!autoFieldMap.sku && (lower === 'sku' || lower === 'code' || lower === 'product code' || lower === 'item code')) {
            autoFieldMap.sku = h;
          }
          if (!autoFieldMap.name && (lower === 'name' || lower === 'product' || lower === 'product name' || lower === 'item name' || lower === 'item' || lower === 'description')) {
            autoFieldMap.name = h;
          }
          if (!autoFieldMap.price && (lower === 'price' || lower === 'cost' || lower === 'rate' || lower === 'unit price' || lower === 'buy price')) {
            autoFieldMap.price = h;
          }
          if (!autoFieldMap.notes && (lower === 'notes' || lower === 'note' || lower === 'description' || lower === 'desc')) {
            autoFieldMap.notes = h;
          }
        }
        setFieldToHeader(autoFieldMap);
        // Sync columnMapping for backend compat
        const autoColMap: Record<string, string[]> = {};
        for (const h of result.headers) autoColMap[h] = [];
        for (const [field, header] of Object.entries(autoFieldMap)) {
          if (header && autoColMap[header]) autoColMap[header].push(field);
        }
        setColumnMapping(autoColMap);
        // Default: select first MAX_ROWS rows
        setSelectedRowIndices(new Set(result.rows.slice(0, MAX_ROWS).map((_, i) => i)));
      } else {
        setError(result.error ?? 'Failed to load catalog rows.');
        setStep('select-catalog');
      }
    } catch {
      setError('Network error loading catalog.');
      setStep('select-catalog');
    } finally {
      setLoadingRows(false);
    }
  }

  // ── Field mapping change handler ───────────────────────────────────
  function handleFieldMappingChange(field: string, header: string) {
    setFieldToHeader(prev => {
      const next = { ...prev };
      if (header) {
        next[field] = header;
      } else {
        delete next[field];
      }
      // Sync columnMapping (header -> fields[]) for backend
      setColumnMapping(() => {
        const colMap: Record<string, string[]> = {};
        for (const h of headers) colMap[h] = [];
        for (const [f, hdr] of Object.entries(next)) {
          if (hdr && colMap[hdr]) colMap[hdr].push(f);
        }
        return colMap;
      });
      return next;
    });
  }

  // ── Row selection ───────────────────────────────────────────────────
  function toggleRow(idx: number) {
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        if (next.size >= MAX_ROWS) return next; // Cap at MAX_ROWS
        next.add(idx);
      }
      return next;
    });
  }

  function toggleAllFiltered(filteredIndices: number[]) {
    const allFilteredSelected = filteredIndices.every(i => selectedRowIndices.has(i));
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        // Deselect all filtered
        for (const i of filteredIndices) next.delete(i);
      } else {
        // Select all filtered up to MAX_ROWS total
        for (const i of filteredIndices) {
          if (next.size >= MAX_ROWS) break;
          next.add(i);
        }
      }
      return next;
    });
  }

  // ── Destination + Create ────────────────────────────────────────────
  async function handleCreate() {
    const rows = allRows.filter((_, i) => selectedRowIndices.has(i));
    if (rows.length === 0) {
      setError('Select at least one row.');
      return;
    }

    const allMappedFields = Object.values(columnMapping).flat();
    const hasName = allMappedFields.includes('name');
    if (!hasName) {
      setError('Please select a column for Component Name.');
      return;
    }

    if (destMode === 'new' && !newLibraryName.trim()) {
      setError('Enter a name for the new library.');
      return;
    }

    if (destMode === 'existing' && !existingCollectionId) {
      setError('Select a target library.');
      return;
    }

    setStep('creating');
    setError(null);

    try {
      const result = await convertCatalogRowsToComponents({
        targetCollectionId: destMode === 'existing' ? existingCollectionId : '',
        newLibraryName: destMode === 'new' ? newLibraryName.trim() : undefined,
        selectedRows: rows,
        columnMapping,
      });

      if (result.ok) {
        setCreatedCount(result.created ?? 0);
        setStep('success');
        onCreated();
      } else {
        setError(result.errors?.[0] ?? 'Conversion failed.');
        setStep('destination');
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('destination');
    }
  }

  function handleReset() {
    setStep('select-catalog');
    setHeaders([]);
    setAllRows([]);
    setColumnMapping({});
    setFieldToHeader({});
    setSelectedRowIndices(new Set());
    setError(null);
    setCreatedCount(0);
    setRowSearchFilter('');
    setNewLibraryName('');
    setDestMode('existing');
    setVisibleCount(VISIBLE_INCREMENT);
  }

  // Filtered rows for display
  const filteredRowData = useMemo(() => {
    return allRows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => {
        if (!rowSearchFilter) return true;
        return Object.values(row).some(v => v?.toLowerCase().includes(rowSearchFilter.toLowerCase()));
      });
  }, [allRows, rowSearchFilter]);

  // Only render visible rows for performance with large catalogs
  // When searching, show up to SEARCH_RENDER_LIMIT since filtered results are smaller
  const effectiveLimit = rowSearchFilter ? SEARCH_RENDER_LIMIT : visibleCount;
  const visibleRowData = filteredRowData.slice(0, effectiveLimit);
  const filteredIndices = filteredRowData.map(d => d.i);

  // Set of headers that are currently mapped to a field (for column highlighting)
  const mappedHeaders = useMemo(() => {
    const s = new Set<string>();
    for (const v of Object.values(fieldToHeader)) { if (v) s.add(v); }
    return s;
  }, [fieldToHeader]);

  // Reset visible count when filter or rows change
  useEffect(() => {
    setVisibleCount(VISIBLE_INCREMENT);
  }, [rowSearchFilter, allRows]);

  // Auto-load more rows when sentinel is visible (infinite scroll)
  // Guard with loadingMoreRef to prevent rapid-fire cascades
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMoreRef.current) {
          loadingMoreRef.current = true;
          setVisibleCount(c => c + VISIBLE_INCREMENT);
          // Allow next batch after a short delay for DOM to settle
          setTimeout(() => { loadingMoreRef.current = false; }, 150);
        }
      },
      { rootMargin: '0px', threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, rowSearchFilter, filteredRowData.length]);
  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Add from Catalog</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-auto flex-1">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 mb-4">
              {error}
            </div>
          )}

          {/* Step: Select Catalog */}
          {step === 'select-catalog' && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setTab('my-catalogs'); void loadMyCatalogs(); }}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full border transition ${
                    tab === 'my-catalogs'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  My Catalogs
                </button>
                <button
                  onClick={() => { setTab('supplier-catalogs'); void loadPublicCatalogs(searchQuery); }}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full border transition ${
                    tab === 'supplier-catalogs'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Supplier Catalogs
                </button>
              </div>

              {/* Search (supplier catalogs only) */}
              {tab === 'supplier-catalogs' && (
                <div className="relative">
                  <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void loadPublicCatalogs(searchQuery); }}
                    placeholder="Search by keyword, brand, location, roofing type..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Catalog list */}
              {loadingCatalogs ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
                  <p className="text-sm text-slate-500 mt-2">Loading catalogs...</p>
                </div>
              ) : tab === 'my-catalogs' ? (
                myCatalogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                    <p className="text-sm text-slate-500">No catalogs uploaded yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Upload a CSV catalog from the Supplier Dashboard to use this feature.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myCatalogs.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleCatalogClick(cat.id, cat.headers)}
                        className="block w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{cat.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {cat.row_count} rows {cat.original_filename ? `- ${cat.original_filename}` : ''}
                            </p>
                          </div>
                          <svg className="w-4 h-4 text-slate-300 group-hover:text-orange-400 transition flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                publicCatalogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                    <p className="text-sm text-slate-500">No supplier catalogs found.</p>
                    <p className="text-xs text-slate-400 mt-1">Try a different search or check back later.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {publicCatalogs.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleCatalogClick(cat.id, cat.headers)}
                        className="block w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {cat.public_title || cat.name}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {cat.supplier_name} - {cat.row_count} rows
                              {cat.brands && cat.brands.length > 0 && ` - ${cat.brands.join(', ')}`}
                            </p>
                            {cat.public_description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cat.public_description}</p>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-slate-300 group-hover:text-orange-400 transition flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* Step: View Rows */}
          {step === 'view-rows' && (
            <div className="space-y-4">
              {loadingRows ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
                  <p className="text-sm text-slate-500 mt-2">Loading catalog rows...</p>
                </div>
              ) : (
                <>
                  {/* Column mapping - field first, dropdown per field */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                      <p className="text-xs font-medium text-slate-600">Map your catalog columns to component fields</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Only Component Name is required. We auto-detected matches where possible.</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {MAPPABLE_FIELDS.map(field => {
                        const selectedHeader = fieldToHeader[field.value] ?? '';
                        const isNameUnset = field.required && !selectedHeader;
                        return (
                          <div key={field.value} className="flex items-center justify-between px-4 py-2.5 gap-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-medium text-slate-700">{field.label}</span>
                              {field.required && <span className="text-red-500 text-xs">*</span>}
                              {isNameUnset && (
                                <span className="text-[10px] text-orange-500 font-medium">required</span>
                              )}
                            </div>
                            <select
                              value={selectedHeader}
                              onChange={e => handleFieldMappingChange(field.value, e.target.value)}
                              className={`text-xs rounded-lg border px-2 py-1.5 focus:border-orange-500 focus:outline-none min-w-[140px] ${
                                isNameUnset
                                  ? 'border-orange-300 ring-1 ring-orange-200'
                                  : 'border-slate-300'
                              }`}
                            >
                              <option value="">{field.placeholder}</option>
                              {headers.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Search + selection counter */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={rowSearchFilter}
                        onChange={e => setRowSearchFilter(e.target.value)}
                        placeholder="Filter rows..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {selectedRowIndices.size}/{MAX_ROWS} selected
                      {selectedRowIndices.size >= MAX_ROWS && <span className="text-orange-500 ml-1">(max reached)</span>}
                      <span className="text-slate-300 ml-2">- {allRows.length.toLocaleString()} rows loaded</span>
                      {rowSearchFilter && filteredRowData.length > SEARCH_RENDER_LIMIT && (
                        <span className="text-orange-400 ml-1">(showing first {SEARCH_RENDER_LIMIT} matches)</span>
                      )}
                    </span>
                  </div>

                  {/* Rows table */}
                  <div className="rounded-lg border border-slate-200 overflow-auto max-h-[40vh]">
                    <table className="text-xs min-w-max">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-slate-200">
                          <th className="px-2 py-2 text-left w-8">
                            <input
                              type="checkbox"
                              checked={filteredIndices.length > 0 && filteredIndices.every(i => selectedRowIndices.has(i))}
                              onChange={() => toggleAllFiltered(filteredIndices)}
                              className="cursor-pointer"
                            />
                          </th>
                          {headers.map(h => {
                            const isMapped = mappedHeaders.has(h);
                            return (
                            <th key={h} className={`px-2 py-2 text-left font-medium whitespace-nowrap ${isMapped ? 'bg-orange-50/60 text-slate-900' : 'text-slate-600'}`}>
                              {h}
                              {(columnMapping[h] ?? []).length > 0 && (
                                <span className="ml-1 text-xs text-orange-500 font-semibold">({columnMapping[h].join(', ')})</span>
                              )}
                            </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {visibleRowData.map(({ row, i }) => (
                          <tr
                            key={i}
                            className={`hover:bg-orange-50/30 cursor-pointer ${selectedRowIndices.has(i) ? 'bg-orange-50/20' : ''}`}
                            onClick={() => toggleRow(i)}
                          >
                            <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedRowIndices.has(i)}
                                onChange={() => toggleRow(i)}
                                className="cursor-pointer"
                              />
                            </td>
                            {headers.map(h => (
                              <td key={h} className={`px-2 py-1.5 whitespace-nowrap ${mappedHeaders.has(h) ? 'bg-orange-50/50 text-slate-700' : 'text-slate-600'}`}>
                                {row[h] ?? '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Auto-load more on scroll + status */}
                  {!rowSearchFilter && visibleCount < filteredRowData.length ? (
                    <div
                      ref={sentinelRef}
                      className="text-center py-2"
                    >
                      <span className="text-xs text-slate-400">Loading more rows... ({(filteredRowData.length - visibleCount).toLocaleString()} remaining)</span>
                    </div>
                  ) : !rowSearchFilter && visibleCount >= filteredRowData.length && filteredRowData.length > VISIBLE_INCREMENT ? (
                    <div className="text-center py-1">
                      <span className="text-xs text-slate-300">Showing all {filteredRowData.length.toLocaleString()} rows</span>
                    </div>
                  ) : null}

                  {/* Action bar */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        const allMappedFields = Object.values(columnMapping).flat();
                        const hasName = allMappedFields.includes('name');
                        if (!hasName) {
                          setError('Please select a column for Component Name.');
                          return;
                        }
                        if (selectedRowIndices.size === 0) {
                          setError('Select at least one row.');
                          return;
                        }
                        setError(null);
                        setStep('destination');
                      }}
                      disabled={selectedRowIndices.size === 0}
                      className="px-5 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next: Choose Library ({selectedRowIndices.size} selected)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step: Destination */}
          {step === 'destination' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Choose destination library</h3>

                {/* Existing vs New */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setDestMode('existing')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full border transition ${
                      destMode === 'existing'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Existing Library
                  </button>
                  <button
                    onClick={() => setDestMode('new')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full border transition ${
                      destMode === 'new'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Create New Library
                  </button>
                </div>

                {destMode === 'existing' ? (
                  <select
                    value={existingCollectionId}
                    onChange={e => setExistingCollectionId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  >
                    {collections.map(col => (
                      <option key={col.id} value={col.id}>
                        {col.name}{col.is_bootstrap ? ' (Default)' : ''}{col.component_count != null ? ` - ${col.component_count} components` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newLibraryName}
                    onChange={e => setNewLibraryName(e.target.value)}
                    placeholder="New library name..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Summary</p>
                <p className="text-sm text-slate-700">
                  Creating <span className="font-semibold">{selectedRowIndices.size}</span> component{selectedRowIndices.size !== 1 ? 's' : ''} from catalog rows.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Each row becomes a new component with mapped fields auto-populated.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep('view-rows')}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  className="px-5 py-2 text-sm font-semibold rounded-full bg-[#FF6B35] text-white hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition cursor-pointer"
                >
                  Create {selectedRowIndices.size} Component{selectedRowIndices.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Step: Creating */}
          {step === 'creating' && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-3" />
              <p className="text-sm text-slate-500">Creating components...</p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                Created {createdCount} component{createdCount !== 1 ? 's' : ''} successfully.
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-6">
                They are now in your library and ready to use in quotes.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                >
                  Convert More
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
