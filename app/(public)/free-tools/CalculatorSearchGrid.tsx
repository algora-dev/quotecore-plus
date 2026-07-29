'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CALCULATORS, CALCULATOR_COUNT } from './tools-data';

export default function CalculatorSearchGrid() {
  const [view, setView] = useState<'core' | 'all'>('core');
  const [searchQuery, setSearchQuery] = useState('');

  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.toLowerCase().trim();
  const coreCalcs = CALCULATORS.filter((c) => c.isCore);

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return CALCULATORS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q)),
    );
  }, [q, isSearching]);

  const visibleCalcs = isSearching ? searchResults : view === 'core' ? coreCalcs : CALCULATORS;

  return (
    <section id="all-calculators" className="scroll-mt-24 bg-slate-50 border-t border-slate-100">
      <div className="mx-auto max-w-5xl px-2 md:px-6 py-10 md:py-16">
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg md:text-2xl font-semibold text-slate-900">All Calculators</h2>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            {isSearching
              ? `${searchResults.length} calculator${searchResults.length !== 1 ? 's' : ''} found`
              : view === 'core'
              ? '5 core trade calculators. Switch to All to see every calculator, or search.'
              : `${CALCULATOR_COUNT} free calculators across 4 industries. Search by name or keyword.`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" inputMode="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search calculators..." className="w-full rounded-lg md:rounded-full border border-slate-300 pl-10 pr-10 py-2.5 text-sm focus:border-orange-500 focus:outline-none bg-white" />
              {isSearching && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
          <select value={view} onChange={(e) => setView(e.target.value as 'core' | 'all')} className="rounded-lg md:rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-orange-500 focus:outline-none">
            <option value="core">Core Calculators (5)</option>
            <option value="all">All Calculators ({CALCULATOR_COUNT})</option>
          </select>
        </div>
        {visibleCalcs.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCalcs.map((calc) => (
              <Link key={calc.slug} href={`/${calc.slug}`} prefetch={false} className={`block bg-white border rounded-xl hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group ${calc.isCore && view === 'core' && !isSearching ? 'p-5 border-2' : 'p-4 border'}`}>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-900 group-hover:text-[#BD4A1A]">{calc.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{calc.industry}</div>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-slate-500 leading-relaxed line-clamp-2">{calc.description}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-dashed border border-slate-200 px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No calculators found. Try a different search term.</p>
          </div>
        )}
      </div>
    </section>
  );
}
