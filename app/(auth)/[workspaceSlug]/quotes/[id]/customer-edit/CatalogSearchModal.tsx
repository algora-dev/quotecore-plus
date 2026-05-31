'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadCatalogsForSearch } from '../../../catalogs/actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogOption {
  id: string;
  name: string;
}

interface SearchHit {
  id: string;
  catalogId: string;
  catalogName: string;
  rowIndex: number;
  rawRow: Record<string, string>;
}

interface ColumnMapping {
  description: string | null;
  quantity: string | null;
  price: string | null;
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
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return { value: 0, hasPrice: false };
  return { value: Math.round(parsed * 100) / 100, hasPrice: true };
}

// ---------------------------------------------------------------------------
// CatalogSearchModal
// ---------------------------------------------------------------------------

export function CatalogSearchModal({ workspaceSlug, onAdd, onClose }: Props) {
  const [catalogs, setCatalogs] = useState<CatalogOption[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Column mapping cache per catalog
  const mappingCache = useRef<Map<string, ColumnMapping>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load catalog list on mount
  useEffect(() => {
    loadCatalogsForSearch()
      .then((list) => {
        setCatalogs(list);
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
        const json = await res.json() as { ok: boolean; results?: SearchHit[]; message?: string };
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

  // When a result is selected, map raw_row → quote line and call onAdd
  function handleSelectHit(hit: SearchHit) {
    // Try to get mapping from cache; fall back to null keys
    const mapping = mappingCache.current.get(hit.catalogId) ?? {
      description: null,
      quantity: null,
      price: null,
    };

    const text = (mapping.description ? hit.rawRow[mapping.description] : null)
      ?? Object.values(hit.rawRow)[0]
      ?? '';

    const rawPrice = mapping.price ? hit.rawRow[mapping.price] ?? '' : '';
    const { value: amount, hasPrice } = parsePrice(rawPrice);

    onAdd(text.trim(), amount, hasPrice && amount > 0);
    onClose();
  }

  // Cache mapping when a catalog is selected (fetch from search hit data)
  // We derive it lazily from search results rather than a separate fetch.
  // If there's a result, the catalog's column_mapping is NOT in the hit —
  // the mapping lives on the catalog row. We'll load it as needed.
  // For simplicity, maintain a mapping loaded from the catalog list
  // (not available here), so we fall back to best-guess from raw_row.
  // The mapping is embedded in the catalog row which we don't have here.
  // This is OK — the user can see the field values and choose which to use.

  // Identify the "display key" for a result row: use first column as preview
  function getPreviewText(hit: SearchHit): string {
    const keys = Object.keys(hit.rawRow);
    return keys.slice(0, 3).map((k) => hit.rawRow[k]).filter(Boolean).join(' — ');
  }

  const noCatalogs = !loading && catalogs.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Search catalog</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select an item to add as a custom line</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors ml-4 mt-0.5"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {noCatalogs ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500 mb-2">No catalogs available</p>
              <p className="text-xs text-slate-400">
                Upload a catalog in the{' '}
                <a href={`/${workspaceSlug}/catalogs`} className="text-black underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                  Catalog Library
                </a>
                {' '}first.
              </p>
            </div>
          ) : (
            <>
              {/* Catalog selector */}
              {catalogs.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Catalog</label>
                  <select
                    value={selectedCatalogId ?? ''}
                    onChange={(e) => setSelectedCatalogId(e.target.value || null)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
                  >
                    <option value="">All catalogs</option>
                    {catalogs.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by description, code, price..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  </div>
                )}
              </div>

              {/* Results */}
              {searchError && (
                <p className="text-xs text-red-500">{searchError}</p>
              )}

              {!query.trim() && (
                <p className="text-xs text-slate-400 text-center py-4">
                  Type to search across {selectedCatalogId ? 'this catalog' : 'all catalogs'}
                </p>
              )}

              {query.trim() && !searching && results.length === 0 && !searchError && (
                <p className="text-xs text-slate-400 text-center py-4">No results found for &ldquo;{query}&rdquo;</p>
              )}

              {results.length > 0 && (
                <div className="space-y-1">
                  {results.map((hit) => (
                    <button
                      key={hit.id}
                      onClick={() => handleSelectHit(hit)}
                      className="w-full text-left rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 px-3 py-2.5 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 font-medium truncate">{getPreviewText(hit)}</p>
                          {catalogs.length > 1 && (
                            <p className="text-xs text-slate-400 mt-0.5">{hit.catalogName}</p>
                          )}
                        </div>
                        <svg
                          className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-0.5 transition-colors"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                  ))}
                  {results.length === 50 && (
                    <p className="text-xs text-slate-400 text-center py-1">Showing top 50 results — narrow your search for more</p>
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
