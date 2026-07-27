'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DirectorySupplier, DirectoryLibrary } from './actions';

const ROOFING_TYPES = ['All Roofing', 'Metal Roofing', 'Tile Roofing', 'Flat Roofing', 'Shingle Roofing', 'Membrane', 'EPDM/TPO', 'Slate'];

export function SupplierDirectory({
  workspaceSlug,
  suppliers,
  libraries,
  brands,
  categories,
  initialQuery,
  initialType,
}: {
  workspaceSlug: string;
  suppliers: DirectorySupplier[];
  libraries: DirectoryLibrary[];
  brands: string[];
  categories: string[];
  initialQuery: string;
  initialType: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState(initialType || 'All Roofing');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  function applyFilters() {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (selectedType && selectedType !== 'All Roofing') params.set('type', selectedType);
    router.push(`/${workspaceSlug}/supplier-directory?${params.toString()}`);
  }

  function clearFilters() {
    setQuery('');
    setSelectedType('All Roofing');
    router.push(`/${workspaceSlug}/supplier-directory`);
  }

  const hasFilters = query.trim() || (selectedType && selectedType !== 'All Roofing');

  // Group libraries by supplier
  const librariesBySupplier = useMemo(() => {
    const map = new Map<string, { supplier: DirectorySupplier; libraries: DirectoryLibrary[] }>();
    for (const sup of suppliers) {
      const supLibs = libraries.filter(l => l.supplier_slug === sup.slug);
      if (supLibs.length > 0) {
        map.set(sup.slug, { supplier: sup, libraries: supLibs });
      }
    }
    return [...map.values()];
  }, [suppliers, libraries]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Supplier Directory</h1>
            <p className="text-sm text-slate-400 mt-0.5">Find and import supplier component libraries</p>
          </div>
          <Link
            href={`/${workspaceSlug}/components`}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 rounded-full border border-slate-300 px-3 py-1.5"
          >
            My Components
          </Link>
        </div>

        {/* Search Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
              placeholder="Search by name, keyword, brand..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
            <button
              onClick={applyFilters}
              className="cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Search
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="cursor-pointer rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>

          {/* Roofing Type Filter */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {ROOFING_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setSelectedType(type);
                  if (type === 'All Roofing') {
                    const params = new URLSearchParams();
                    if (query.trim()) params.set('q', query.trim());
                    router.push(`/${workspaceSlug}/supplier-directory${params.toString() ? `?${params}` : ''}`);
                  } else {
                    const params = new URLSearchParams();
                    if (query.trim()) params.set('q', query.trim());
                    params.set('type', type);
                    router.push(`/${workspaceSlug}/supplier-directory?${params}`);
                  }
                }}
                className={`cursor-pointer text-xs px-2.5 py-1 rounded-full border transition ${
                  selectedType === type
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-orange-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {libraries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-400">
              {hasFilters
                ? 'No libraries match your search. Try clearing filters.'
                : 'No supplier libraries published yet. Check back soon.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Supplier count */}
            <p className="text-xs text-slate-400">
              {librariesBySupplier.length} supplier{librariesBySupplier.length !== 1 ? 's' : ''}, {libraries.length} librar{libraries.length !== 1 ? 'ies' : 'y'}
            </p>

            {/* Supplier sections */}
            {librariesBySupplier.map(({ supplier, libraries: supLibs }) => (
              <div key={supplier.slug} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Supplier header */}
                <button
                  onClick={() => setExpandedSupplier(expandedSupplier === supplier.slug ? null : supplier.slug)}
                  className="cursor-pointer w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50/40 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{supplier.supplier_name}</span>
                        <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs">
                          {supLibs.length} librar{supLibs.length !== 1 ? 'ies' : 'y'}
                        </span>
                      </div>
                      {supplier.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{supplier.description}</p>
                      )}
                      {supplier.roofing_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {supplier.roofing_types.map(rt => (
                            <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rt}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expandedSupplier === supplier.slug ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded libraries */}
                {expandedSupplier === supplier.slug && (
                  <div className="border-t border-slate-100">
                    {/* Supplier contact info */}
                    <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {supplier.contact_email && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Contact:</span>
                            <a href={`mailto:${supplier.contact_email}`} className="text-[#2563EB] hover:underline">{supplier.contact_email}</a>
                          </div>
                        )}
                        {supplier.phone_number && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Phone:</span>
                            <span className="text-slate-600">{supplier.phone_number}</span>
                          </div>
                        )}
                        {supplier.website_url && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Website:</span>
                            <a href={supplier.website_url} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline">{supplier.website_url}</a>
                          </div>
                        )}
                        {supplier.service_areas && supplier.service_areas.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Areas:</span>
                            <span className="text-slate-600">{supplier.service_areas.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                    {supLibs.map(lib => (
                      <div key={lib.id} className="px-4 py-3 hover:bg-orange-50/30 transition">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-900">{lib.public_title || lib.name}</span>
                              <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs">
                                {lib.component_count} component{lib.component_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {lib.public_description && (
                              <p className="text-xs text-slate-500 mt-0.5">{lib.public_description}</p>
                            )}
                            {lib.brands && lib.brands.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {lib.brands.map(b => (
                                  <span key={b} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{b}</span>
                                ))}
                              </div>
                            )}
                            {lib.published_at && (
                              <p className="text-xs text-slate-400 mt-1">
                                Published: {new Date(lib.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <Link
                            href={`/${workspaceSlug}/supplier-directory/library/${lib.id}`}
                            className="shrink-0 cursor-pointer rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {/* Collapsed preview - show first library name */}
                {expandedSupplier !== supplier.slug && supLibs[0] && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-slate-400">
                      {supLibs[0].public_title || supLibs[0].name}
                      {supLibs.length > 1 && ` + ${supLibs.length - 1} more`}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
