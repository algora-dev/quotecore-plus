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

export type TaskId = 'all' | 'measure' | 'materials' | 'price' | 'margin' | 'quote' | 'invoice' | 'roofing';

const TASKS: { id: TaskId; label: string; heading: string }[] = [
  { id: 'all', label: 'Browse all', heading: '' },
  { id: 'measure', label: 'Measure something', heading: 'Measure' },
  { id: 'materials', label: 'Work out materials', heading: 'Estimate materials' },
  { id: 'price', label: 'Price a job', heading: 'Price the job' },
  { id: 'margin', label: 'Check profit or margin', heading: 'Check profit or margin' },
  { id: 'quote', label: 'Create a quote', heading: 'Create documents' },
  { id: 'invoice', label: 'Create an invoice', heading: 'Create documents' },
  { id: 'roofing', label: 'Roofing tools', heading: 'Roofing tools' },
];

const slugMatches = (slug: string, patterns: RegExp[]) => patterns.some((p) => p.test(slug));

function taskMatch(task: TaskId, slug: string, category?: string): boolean {
  switch (task) {
    case 'measure':
      return slug === 'free-roof-takeoff' || slugMatches(slug, [/area/, /square/, /pitch/, /rafter/, /angle/, /slope/, /hip-valley/, /birds-mouth/, /takeoff/, /wall-area/]);
    case 'materials':
      return slugMatches(slug, [/material/, /concrete/, /rebar/, /tile/, /paint/, /shingle/, /sheathing/, /waste/, /flooring/, /landscaping/, /trench/, /pipe/, /bag/]);
    case 'price':
      return slugMatches(slug, [/pricing/, /replacement-cost/, /quote-calculator/, /construction-calculator/]);
    case 'margin':
      return slug === 'free-margin-calculator';
    case 'quote':
      return slug === 'free-quote-generator' || slug === 'free-purchase-order-generator';
    case 'invoice':
      return slug === 'free-invoice-generator' || slug === 'free-purchase-order-generator';
    case 'roofing':
      return category === 'roofing' || slugMatches(slug, [/roof/]);
    default:
      return true;
  }
}

const WORKFLOW_STEPS: { title: string; body: string; href: string; linkText: string }[] = [
  {
    title: '1. Measure the job',
    body: 'Upload a plan image, set the scale, and get pitch-calculated roof measurements.',
    href: '/free-roof-takeoff',
    linkText: 'Free roof takeoff',
  },
  {
    title: '2. Calculate materials',
    body: 'Turn roof areas and lengths into material quantities with waste allowances.',
    href: '/free-roofing-material-calculator',
    linkText: 'Material calculator',
  },
  {
    title: '3. Check margin',
    body: 'See selling price and profit from your real costs - per line or on a total.',
    href: '/free-margin-calculator',
    linkText: 'Margin calculator',
  },
  {
    title: '4. Create the quote',
    body: 'Build a professional, printable customer quote from your items and prices.',
    href: '/free-quote-generator',
    linkText: 'Quote generator',
  },
];

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
  const [task, setTask] = useState<TaskId>('all');

  const isSearching = search.trim().length > 0;
  const q = search.toLowerCase().trim();

  // Combined tool list for task filtering (free tools first)
  const allTools = useMemo(
    () => [
      ...freeTools.map((t) => ({ slug: t.slug, name: t.name, description: t.description, category: '' as const, isFreeTool: true })),
      ...calculators.map((c) => ({ slug: c.slug, name: c.name, description: c.description, category: c.category, isFreeTool: false })),
    ],
    [calculators, freeTools],
  );

  const taskResults = useMemo(() => {
    if (task === 'all') return [];
    return allTools.filter((t) => taskMatch(task, t.slug, t.category || undefined));
  }, [task, allTools]);

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

      {/* Task quick-filter */}
      <section className="mb-5">
        <p className="text-sm font-medium text-slate-700">What are you trying to do?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TASKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTask(t.id)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                task === t.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* From measurement to finished quote workflow */}
      {task === 'all' && !isSearching && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900">From measurement to finished quote</h2>
          <p className="mt-1 text-sm text-slate-500">
            These tools work as one chain - free at every step, no signup required.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.title} className="relative rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.body}</p>
                <Link
                  href={step.href}
                  prefetch={false}
                  className="mt-2 inline-block text-xs font-medium text-[#BD4A1A] hover:underline"
                >
                  {step.linkText} &rarr;
                </Link>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <svg
                    className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-300 lg:block"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

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

      {/* Task-filtered results */}
      {!isSearching && task !== 'all' && (
        <section className="mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{TASKS.find((t) => t.id === task)?.heading}</h2>
            <button onClick={() => setTask('all')} className="text-xs font-medium text-slate-500 hover:text-[#BD4A1A]">
              Show everything
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {taskResults.map((tool) => (
              <Link
                key={tool.slug}
                href={`/${tool.slug}`}
                prefetch={false}
                className={`block w-full text-left p-5 bg-white rounded-xl transition-all group ${
                  tool.isFreeTool
                    ? 'border-2 border-slate-200 hover:border-[#FF6B35] hover:shadow-lg'
                    : 'border border-slate-200 hover:border-[#FF6B35] hover:shadow-sm'
                }`}
              >
                <p className={`font-semibold text-slate-900 group-hover:text-[#BD4A1A] transition ${tool.isFreeTool ? 'text-sm' : 'text-sm'}`}>
                  {tool.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{tool.description}</p>
              </Link>
            ))}
            {taskResults.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
                <p className="text-sm text-slate-400">No tools match this task. Try &quot;Browse all&quot;.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Core Calculators (default view) */}
      {!isSearching && task === 'all' && view === 'core' && (
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
      {!isSearching && task === 'all' && view === 'all' && (
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

      {/* Free document tools (always visible when not task-filtered) */}
      {task === 'all' && (
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
      )}

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
