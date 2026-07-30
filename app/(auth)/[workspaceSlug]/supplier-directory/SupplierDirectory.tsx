'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DirectorySupplier, DirectoryLibrary } from './actions';
import type { DirectoryCatalog } from './actions';

const ROOFING_TYPES = ['All Roofing', 'Metal Roofing', 'Tile Roofing', 'Flat Roofing', 'Shingle Roofing', 'Membrane', 'EPDM/TPO', 'Slate'];

type Tab = 'libraries' | 'catalogues';

export function SupplierDirectory({
  workspaceSlug,
  suppliers,
  libraries,
  catalogs,
  brands,
  categories,
  initialQuery,
  initialType,
  initialLocation,
}: {
  workspaceSlug: string;
  suppliers: DirectorySupplier[];
  libraries: DirectoryLibrary[];
  catalogs: DirectoryCatalog[];
  brands: string[];
  categories: string[];
  initialQuery: string;
  initialType: string;
  initialLocation: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [selectedType, setSelectedType] = useState(initialType || 'All Roofing');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('libraries');
  const [savingCatalogId, setSavingCatalogId] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  function applyFilters() {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (selectedType && selectedType !== 'All Roofing') params.set('type', selectedType);
    if (location.trim()) params.set('location', location.trim());
    router.push(`/${workspaceSlug}/supplier-directory?${params.toString()}`);
  }

  function clearFilters() {
    setQuery('');
    setLocation('');
    setSelectedType('All Roofing');
    router.push(`/${workspaceSlug}/supplier-directory`);
  }

  const hasFilters = query.trim() || location.trim() || (selectedType && selectedType !== 'All Roofing');

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

  // Group catalogues by supplier
  const catalogsBySupplier = useMemo(() => {
    const map = new Map<string, { supplier: DirectorySupplier; catalogs: DirectoryCatalog[] }>();
    for (const sup of suppliers) {
      const supCats = catalogs.filter(c => c.supplier_slug === sup.slug);
      if (supCats.length > 0) {
        map.set(sup.slug, { supplier: sup, catalogs: supCats });
      }
    }
    // Also include suppliers that have catalogs but might not be in the suppliers list
    for (const cat of catalogs) {
      if (!map.has(cat.supplier_slug)) {
        const sup = suppliers.find(s => s.slug === cat.supplier_slug);
        if (sup) {
          map.set(cat.supplier_slug, { supplier: sup, catalogs: [cat] });
        }
      }
    }
    return [...map.values()];
  }, [suppliers, catalogs]);

  async function handleSaveCatalog(catalogId: string) {
    setSavingCatalogId(catalogId);
    try {
      const res = await fetch('/api/supplier-directory/save-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId }),
      });
      const data = await res.json();
      setSaveResult(prev => ({
        ...prev,
        [catalogId]: data.ok
          ? { ok: true, message: 'Added to your catalogs' }
          : { ok: false, message: data.message || 'Failed' },
      }));
    } catch {
      setSaveResult(prev => ({
        ...prev,
        [catalogId]: { ok: false, message: 'Network error' },
      }));
    }
    setSavingCatalogId(null);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-4">
          <Link href={`/${workspaceSlug}/components`} className="hover:text-slate-700">Components</Link>
          <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-900">Supplier Directory</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Supplier Directory</h1>
            <p className="text-sm text-slate-400 mt-0.5">Find and import supplier component libraries and catalogues</p>
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
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text" value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
                placeholder="Search by name, keyword, brand, product..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
              <button onClick={applyFilters}
                className="cursor-pointer rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition whitespace-nowrap">
                Search
              </button>
              {hasFilters && (
                <button onClick={clearFilters}
                  className="cursor-pointer rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 whitespace-nowrap">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
                placeholder="Location (e.g. New Zealand, UK, London...)"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Roofing Type Filter */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {ROOFING_TYPES.map(type => (
              <button key={type} type="button"
                onClick={() => {
                  setSelectedType(type);
                  const params = new URLSearchParams();
                  if (query.trim()) params.set('q', query.trim());
                  if (location.trim()) params.set('location', location.trim());
                  if (type !== 'All Roofing') params.set('type', type);
                  router.push(`/${workspaceSlug}/supplier-directory${params.toString() ? `?${params}` : ''}`);
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

          {!hasFilters && (
            <p className="text-xs text-slate-400 mt-2">Click Search to browse all published content, or filter by keyword, location, or roofing type.</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setActiveTab('libraries')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'libraries' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            Component Libraries ({libraries.length})
          </button>
          <button onClick={() => setActiveTab('catalogues')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'catalogues' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            Catalogues ({catalogs.length})
          </button>
        </div>

        {/* Libraries Tab */}
        {activeTab === 'libraries' && (
          libraries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-slate-400">
                {hasFilters ? 'No libraries match your search. Try clearing filters.' : 'No supplier libraries published yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                {librariesBySupplier.length} supplier{librariesBySupplier.length !== 1 ? 's' : ''}, {libraries.length} librar{libraries.length !== 1 ? 'ies' : 'y'}
              </p>
              {librariesBySupplier.map(({ supplier, libraries: supLibs }) => (
                <SupplierAccordion
                  key={supplier.slug}
                  supplier={supplier}
                  expanded={expandedSupplier === supplier.slug}
                  onToggle={() => setExpandedSupplier(expandedSupplier === supplier.slug ? null : supplier.slug)}
                >
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
                          {lib.public_description && <p className="text-xs text-slate-500 mt-0.5">{lib.public_description}</p>}
                          {lib.brands && lib.brands.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">{lib.brands.map(b => <span key={b} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{b}</span>)}</div>
                          )}
                          {lib.published_at && <p className="text-xs text-slate-400 mt-1">Published: {new Date(lib.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                        </div>
                        <Link href={`/${workspaceSlug}/supplier-directory/library/${lib.id}`}
                          className="shrink-0 cursor-pointer rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition">
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </SupplierAccordion>
              ))}
            </div>
          )
        )}

        {/* Catalogues Tab */}
        {activeTab === 'catalogues' && (
          catalogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-slate-400">
                {hasFilters ? 'No catalogues match your search. Try clearing filters.' : 'No supplier catalogues published yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                {catalogsBySupplier.length} supplier{catalogsBySupplier.length !== 1 ? 's' : ''}, {catalogs.length} catalogue{catalogs.length !== 1 ? 's' : ''}
              </p>
              {catalogsBySupplier.map(({ supplier, catalogs: supCats }) => (
                <SupplierAccordion
                  key={supplier.slug}
                  supplier={supplier}
                  expanded={expandedSupplier === supplier.slug}
                  onToggle={() => setExpandedSupplier(expandedSupplier === supplier.slug ? null : supplier.slug)}
                >
                  {supCats.map(cat => (
                    <div key={cat.id} className="px-4 py-3 hover:bg-orange-50/30 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-900">{cat.public_title || cat.name}</span>
                            <span className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs">
                              {cat.row_count} row{cat.row_count !== 1 ? 's' : ''}
                            </span>
                            {cat.published_version > 0 && <span className="text-xs text-slate-400">v{cat.published_version}</span>}
                          </div>
                          {cat.public_description && <p className="text-xs text-slate-500 mt-0.5">{cat.public_description}</p>}
                          {cat.brands && cat.brands.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">{cat.brands.map(b => <span key={b} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{b}</span>)}</div>
                          )}
                          {cat.roofing_types && cat.roofing_types.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">{cat.roofing_types.map(rt => <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rt}</span>)}</div>
                          )}
                          {cat.published_at && <p className="text-xs text-slate-400 mt-1">Published: {new Date(cat.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 items-end shrink-0">
                          <button
                            onClick={() => handleSaveCatalog(cat.id)}
                            disabled={savingCatalogId === cat.id}
                            className="cursor-pointer rounded-full bg-[#FF6B35] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e55a2b] transition disabled:opacity-50"
                          >
                            {savingCatalogId === cat.id ? 'Adding...' : 'Add Catalogue'}
                          </button>
                          {saveResult[cat.id] && (
                            <span className={`text-xs ${saveResult[cat.id].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                              {saveResult[cat.id].message}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </SupplierAccordion>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supplier Accordion Component
// ---------------------------------------------------------------------------

function SupplierAccordion({
  supplier,
  expanded,
  onToggle,
  children,
}: {
  supplier: DirectorySupplier;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button onClick={onToggle}
        className="cursor-pointer w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50/40 transition">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900">{supplier.supplier_name}</span>
            </div>
            {supplier.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{supplier.description}</p>}
            {supplier.service_areas.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {supplier.service_areas.map(sa => <span key={sa} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{sa}</span>)}
              </div>
            )}
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
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
                <div className="flex items-center gap-2"><span className="text-slate-400">Phone:</span><span className="text-slate-600">{supplier.phone_number}</span></div>
              )}
              {supplier.website_url && (() => {
                const url = supplier.website_url;
                const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
                return (
                  <div className="flex items-center gap-2"><span className="text-slate-400">Website:</span><a href={href} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline">{url}</a></div>
                );
              })()}
            </div>
          </div>
          <div className="divide-y divide-slate-100">{children}</div>
        </div>
      )}
    </div>
  );
}
