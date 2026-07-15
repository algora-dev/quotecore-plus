'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export interface CalculatorEntry {
  slug: string;
  name: string;
  description: string;
  category: 'roofing' | 'construction' | 'concrete' | 'landscaping' | 'slope';
  isCore: boolean;
}

export interface FreeToolEntry {
  slug: string;
  name: string;
  description: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  roofing: 'Roofing calculators',
  construction: 'Construction calculators',
  concrete: 'Concrete calculators',
  landscaping: 'Landscaping calculators',
  slope: 'Slope & drainage calculators',
};

const ICONS: Record<string, string> = {
  roofing: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10',
  construction: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-4m-6 0H7m0 0H5m2 0V9h6v12',
  concrete: 'M4 4h16v16H4zM4 12h16M12 4v16',
  landscaping: 'M12 2a9 9 0 00-9 9c0 4 3 7 6 9 1 .5 2 1 3 2 1-1 2-1.5 3-2 3-2 6-5 6-9a9 9 0 00-9-9zM12 6v6',
  birdsmouth: 'M3 21l9-9M21 21l-9-9M9 21h12',
  tool: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
};

function CalcIcon({ category }: { category: string }) {
  return (
    <svg className="w-5 h-5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS[category] ?? ICONS.tool} />
    </svg>
  );
}

export function CalculatorHubClient({
  calculators,
  freeTools,
}: {
  calculators: CalculatorEntry[];
  freeTools: FreeToolEntry[];
}) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'core' | 'all'>('core');

  const isSearching = search.trim().length > 0;
  const q = search.toLowerCase().trim();

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return calculators.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.slug.includes(q) ||
        c.category.includes(q),
    );
  }, [q, isSearching, calculators]);

  const coreCalcs = calculators.filter((c) => c.isCore);

  // Group all calculators by category for "All" view
  const grouped = useMemo(() => {
    const map = new Map<string, CalculatorEntry[]>();
    for (const c of calculators) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return map;
  }, [calculators]);

  // Category order for the "All" view
  const CATEGORY_ORDER: CalculatorEntry['category'][] = ['roofing', 'construction', 'concrete', 'landscaping', 'slope'];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
      {/* Hero */}
      <section className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Trade Calculators</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-xl">
          Free online calculators built for trades - areas, volumes, angles, material quantities,
          waste allowances, and pricing. No signup required, works on mobile and desktop.
        </p>
      </section>

      {/* Search + Filter */}
      <section className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 40+ calculators..."
              className="w-full rounded-full border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#FF6B35] focus:outline-none"
            />
            {isSearching && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as 'core' | 'all')}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-[#FF6B35] focus:outline-none"
          >
            <option value="core">Core Calculators</option>
            <option value="all">All Calculators ({calculators.length})</option>
          </select>
        </div>
      </section>

      {/* Search Results */}
      {isSearching && (
        <section className="mb-8">
          <p className="text-sm text-slate-500 mb-3">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{search}&quot;
          </p>
          {searchResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No calculators found. Try a different search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((calc) => (
                <Link
                  key={calc.slug}
                  href={`/${calc.slug}`}
                  prefetch={false}
                  className="block w-full text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-[#FF6B35] hover:shadow-sm transition-all group"
                >
                  <p className="text-sm font-medium text-slate-900 group-hover:text-[#BD4A1A] transition">
                    {calc.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{calc.description}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Core Calculators (default view) */}
      {!isSearching && view === 'core' && (
        <section className="mb-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {coreCalcs.map((calc) => (
              <Link
                key={calc.slug}
                href={`/${calc.slug}`}
                prefetch={false}
                className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                    <CalcIcon category={calc.category} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{calc.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{calc.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All Calculators - grouped by category */}
      {!isSearching && view === 'all' && (
        <section className="mb-8">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            const coreItems = items.filter((c) => c.isCore);
            const slugItems = items.filter((c) => !c.isCore);
            return (
              <div key={cat} className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900">{CATEGORY_LABELS[cat]}</h2>
                {coreItems.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {coreItems.map((calc) => (
                      <Link
                        key={calc.slug}
                        href={`/${calc.slug}`}
                        prefetch={false}
                        className="block w-full text-left p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
                      >
                        <p className="font-semibold text-slate-900 text-sm">{calc.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{calc.description}</p>
                      </Link>
                    ))}
                  </div>
                )}
                {slugItems.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {slugItems.map((calc) => (
                      <Link
                        key={calc.slug}
                        href={`/${calc.slug}`}
                        prefetch={false}
                        className="block w-full text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-[#FF6B35] hover:shadow-sm transition-all group"
                      >
                        <p className="text-sm font-medium text-slate-900 group-hover:text-[#BD4A1A] transition">
                          {calc.name}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Free document tools (always visible) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900">Free document tools</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {freeTools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/${tool.slug}`}
              prefetch={false}
              className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                  <svg className="w-5 h-5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{tool.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{tool.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Why use these calculators */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900">Why use these calculators?</h2>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Built by trade software, for trades</h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              These calculators use the same measurement and pricing engine as QuoteCore+, the quoting and job
              management platform for trade businesses. Every formula - pitch factors, waste allowances,
              pack-based pricing - is the same maths professionals use to price real jobs.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Free, private, no signup</h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              All calculator math runs in your browser - nothing is uploaded, tracked, or stored on a server.
              The AI document scanner (quote generator) sends your uploaded image or text to our server for
              processing. Use calculators on-site from your phone or at the desk, as often as you like.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
