'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadCatalogsForSearch } from '../../../catalogs/actions';
import type { CatalogSearchMeta } from '../../../catalogs/actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchHit {
  id: string;
  catalogId: string;
  catalogName: string;
  rowIndex: number;
  rawRow: Record<string, string>;
}

interface ColumnMapping {
  description: string | null; // "Item / Description"  — primary text
  quantity: string | null;    // "Description / Quantity" — secondary text
  price: string | null;       // "Price" — amount
}

interface Props {
  workspaceSlug: string;
  onAdd: (text: string, amount: number, showPrice: boolean) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePrice(raw: string): { value: number; hasPrice: boolean } {
  if (raw == null) return { value: 0, hasPrice: false };
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return { value: 0, hasPrice: false };
  return { value: Math.round(parsed * 100) / 100, hasPrice: true };
}

/** Build the quote-line text from a hit using the catalog's column mapping. */
function composeLineText(hit: SearchHit, mapping: ColumnMapping): string {
  const parts: string[] = [];
  const descVal = mapping.description ? hit.rawRow[mapping.description] : null;
  const qtyVal = mapping.quantity ? hit.rawRow[mapping.quantity] : null;

  if (descVal && descVal.trim()) parts.push(descVal.trim());
  if (qtyVal && qtyVal.trim()) parts.push(qtyVal.trim());

  // Fallback: if nothing mapped resolved, use the first non-empty raw value
  if (parts.length === 0) {
    const firstVal = Object.values(hit.rawRow).find((v) => v && String(v).trim());
    if (firstVal) parts.push(String(firstVal).trim());
  }

  return parts.join(' — ');
}

// ---------------------------------------------------------------------------
// CatalogSearchModal
// ---------------------------------------------------------------------------

export function CatalogSearchModal({ workspaceSlug, onAdd, onClose }: Props) {
  const [catalogs, setCatalogs] = useState<CatalogSearchMeta[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Lookup: catalogId -> column_mapping (populated from loadCatalogsForSearch)
  const mappingByCatalog = useRef<Map<string, ColumnMapping>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load catalog list + mappings on mount
  useEffect(() => {
    loadCatalogsForSearch()
      .then((list) => {
        setCatalogs(list);
        for (const c of list) {
          const m = (c.column_mapping ?? {}) as Record<string, string | null>;
          mappingByCatalog.current.set(c.id, {
            description: m.description ?? null,
            quantity: m.quantity ?? null,
            price: m.price ?? null,
          });
        }
        setLoading(false);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      })
      .catch(() => setLoading(false));
  }, []);

  // Debounced search
  const runSearch = useCallback(
    async (q: string, catalogId: string | null) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/${workspaceSlug}/catalogs/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, catalogId, limit: 50 }),
        });
        const json = (await res.json()) as { ok: boolean; results?: SearchHit[]; message?: string };
        if (!json.ok) throw new Error(json.message ?? 'Search failed');
        setResults(json.results ?? []);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [workspaceSlug],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query, selectedCatalogId);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedCatalogId, runSearch]);

  function getMapping(catalogId: string): ColumnMapping {
    return mappingByCatalog.current.get(catalogId) ?? { description: null, quantity: null, price: null };
  }

  function handleSelectHit(hit: SearchHit) {
    const mapping = getMapping(hit.catalogId);
    const text = composeLineText(hit, mapping);
    const rawPrice = mapping.price ? hit.rawRow[mapping.price] ?? '' : '';
    const { value: amount, hasPrice } = parsePrice(rawPrice);
    onAdd(text, amount, hasPrice && amount > 0);
    onClose();
  }

  /** Result preview lines using the mapped columns (falls back to first values). */
  function getResultPreview(hit: SearchHit): { primary: string; secondary: string | null; price: string | null } {
    const mapping = getMapping(hit.catalogId);
    const descVal = mapping.description ? hit.rawRow[mapping.description] : null;
    const qtyVal = mapping.quantity ? hit.rawRow[mapping.quantity] : null;
    const priceVal = mapping.price ? hit.rawRow[mapping.price] : null;

    let primary = descVal && descVal.trim() ? descVal.trim() : '';
    if (!primary) {
      const firstVal = Object.values(hit.rawRow).find((v) => v && String(v).trim());
      primary = firstVal ? String(firstVal).trim() : '(no description)';
    }
    return {
      primary,
      secondary: qtyVal && qtyVal.trim() ? qtyVal.trim() : null,
      price: priceVal && priceVal.trim() ? priceVal.trim() : null,
    };
  }

  const noCatalogs = !loading && catalogs.length === 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Search Catalog</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {noCatalogs ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-500 mb-1">No catalogs available</p>
              <p className="text-xs text-slate-400">
                Upload a catalog in the{' '}
                <a
                  href={`/${workspaceSlug}/catalogs`}
                  className="text-orange-600 font-medium hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Catalog Library
                </a>{' '}
                first.
              </p>
            </div>
          ) : (
            <>
              {/* Catalog selector */}
              {catalogs.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Catalog</label>
                  <select
                    value={selectedCatalogId ?? ''}
                    onChange={(e) => setSelectedCatalogId(e.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white"
                  >
                    <option value="">All catalogs</option>
                    {catalogs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by description, code, price..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
                  </div>
                )}
                {query && !searching && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Results */}
              {searchError && <p className="text-xs text-red-500">{searchError}</p>}

              {!query.trim() && (
                <p className="text-xs text-slate-400 text-center py-6">
                  Type to search across {selectedCatalogId ? 'this catalog' : 'all catalogs'}.
                </p>
              )}

              {query.trim() && !searching && results.length === 0 && !searchError && (
                <p className="text-xs text-slate-400 text-center py-6">
                  No results found for &ldquo;{query}&rdquo;.
                </p>
              )}

              {results.length > 0 && (
                <div className="grid gap-1">
                  {results.map((hit) => {
                    const preview = getResultPreview(hit);
                    return (
                      <button
                        key={hit.id}
                        onClick={() => handleSelectHit(hit)}
                        title="Click to add this item as a quote line"
                        className="w-full text-left grid grid-cols-[1fr_auto] gap-3 items-center rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{preview.primary}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {preview.secondary && (
                              <span className="text-xs text-slate-500 truncate">{preview.secondary}</span>
                            )}
                            {catalogs.length > 1 && (
                              <span className="text-xs text-slate-400 truncate">· {hit.catalogName}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {preview.price && (
                            <span className="text-sm font-semibold text-slate-700">{preview.price}</span>
                          )}
                          <svg
                            className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                  {results.length === 50 && (
                    <p className="text-xs text-slate-400 text-center py-2">
                      Showing top 50 results — narrow your search for more.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
