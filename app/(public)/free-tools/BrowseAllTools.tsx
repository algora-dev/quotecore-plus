'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TOOL_REGISTRY, TOOL_COUNT, normaliseQuery } from './tool-registry';
import { trackEvent } from '@/lib/analytics';

const FILTERS = ['All', 'Roofing', 'Takeoff', 'Calculators', 'Construction', 'Concrete', 'Documents', 'Pricing'] as const;

export default function BrowseAllTools() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [search, setSearch] = useState('');

  const q = normaliseQuery(search);

  const visible = useMemo(() => {
    return TOOL_REGISTRY.filter((t) => {
      if (filter !== 'All' && !t.categories.includes(filter.toLowerCase())) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.shortDescription.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.includes(q)) ||
        t.aliases?.some((a) => a.includes(q))
      );
    }).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [filter, q]);

  return (
    <section id="browse-all-tools" className="scroll-mt-24 bg-slate-50 border-t border-slate-100">
      <div className="mx-auto max-w-5xl px-2 md:px-6 py-10 md:py-16">
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Browse all free tools</h2>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            {TOOL_COUNT} free tools. {visible.length} showing{filter !== 'All' ? ` in ${filter}` : ''}. No signup required for most tools.
          </p>
        </div>

        {/* Search + filters */}
        <div className="mb-5 space-y-3">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value.length > 2) trackEvent('browse_tool_search', {});
            }}
            placeholder="Search tools..."
            aria-label="Search all tools"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#FF6B35] focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  if (f !== 'All') trackEvent('browse_tool_filter', { filter: f });
                }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                  filter === f
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[#FF6B35] hover:text-[#BD4A1A]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Results — all rendered in HTML for crawlability */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {visible.map((tool) => (
            <Link
              key={tool.id}
              href={tool.url}
              prefetch={false}
              onClick={() => trackEvent('browse_tool_click', { tool_id: tool.id })}
              className="block bg-white border rounded-xl p-4 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm text-slate-900 group-hover:text-[#BD4A1A]">{tool.name}</div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {tool.categories[0]}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.shortDescription}</p>
            </Link>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No tools match that search. Try a different word, or clear the filters.</p>
          </div>
        )}
      </div>
    </section>
  );
}
