'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { PublicFooter } from '@/app/components/PublicFooter';

interface CalcEntry {
  slug: string;
  name: string;
  industry: string;
  description: string;
  keywords: string[];
  isCore: boolean;
}

const CALCULATORS: CalcEntry[] = [
  // Main trade calculators (core)
  { slug: 'free-roofing-calculator', name: 'Roofing Calculator', industry: 'Roofing', description: 'Roof pitch, rafter and hip/valley lengths, surface area, and roofing material quantities.', keywords: ['pitch', 'rafter', 'hip', 'valley', 'area', 'battens', 'angle'], isCore: true },
  { slug: 'free-construction-calculator', name: 'Construction Calculator', industry: 'Construction', description: 'Floor and wall areas, timber and stud lengths, material quantities, and cutting angles.', keywords: ['area', 'timber', 'stud', 'materials', 'angle', 'wall', 'floor'], isCore: true },
  { slug: 'free-concrete-calculator', name: 'Concrete Calculator', industry: 'Concrete', description: 'Slab and footing volumes with depth presets, formwork areas, falls, and ready-mix pricing.', keywords: ['slab', 'footing', 'volume', 'formwork', 'falls', 'gradient', 'ready-mix'], isCore: true },
  { slug: 'free-landscaping-calculator', name: 'Landscaping Calculator', industry: 'Landscaping', description: 'Garden and lawn areas, turf and topsoil quantities, slopes, gradients, and falls.', keywords: ['garden', 'lawn', 'turf', 'topsoil', 'slope', 'gradient', 'area'], isCore: true },
  { slug: 'free-birds-mouth-calculator', name: "Bird's Mouth Calculator", industry: 'Roofing', description: "Bird's mouth seat cut and plumb cut angles, heel height, and notch depth with 1/3-depth pass/fail check.", keywords: ['birdsmouth', 'seat cut', 'plumb cut', 'rafter', 'stringer', 'stair', 'notch'], isCore: true },

  // Roofing SEO slugs
  { slug: 'free-roof-pitch-calculator', name: 'Roof Pitch Calculator', industry: 'Roofing', description: 'Calculate roof pitch from rise and run.', keywords: ['pitch', 'rise', 'run', 'angle', 'slope'], isCore: false },
  { slug: 'free-roof-pitch-converter', name: 'Roof Pitch Converter', industry: 'Roofing', description: 'Convert between pitch ratio, degrees, and percentage.', keywords: ['pitch', 'convert', 'degrees', 'ratio', 'percentage'], isCore: false },
  { slug: 'free-roof-area-calculator', name: 'Roof Area Calculator', industry: 'Roofing', description: 'Calculate roof surface area from plan dimensions and pitch.', keywords: ['area', 'surface', 'plan', 'pitch', 'square'], isCore: false },
  { slug: 'free-rafter-length-calculator', name: 'Rafter Length Calculator', industry: 'Roofing', description: 'Calculate rafter length from span and pitch.', keywords: ['rafter', 'length', 'span', 'pitch'], isCore: false },
  { slug: 'free-rafter-length-converter', name: 'Rafter Length Converter', industry: 'Roofing', description: 'Convert rafter measurements between metric and imperial.', keywords: ['rafter', 'convert', 'metric', 'imperial'], isCore: false },
  { slug: 'free-hip-valley-calculator', name: 'Hip & Valley Calculator', industry: 'Roofing', description: 'Calculate hip and valley rafter lengths.', keywords: ['hip', 'valley', 'rafter', 'length'], isCore: false },
  { slug: 'free-hip-valley-converter', name: 'Hip & Valley Converter', industry: 'Roofing', description: 'Convert hip and valley measurements between units.', keywords: ['hip', 'valley', 'convert', 'metric', 'imperial'], isCore: false },
  { slug: 'free-roofing-material-calculator', name: 'Roofing Material Calculator', industry: 'Roofing', description: 'Calculate roofing material quantities and costs.', keywords: ['material', 'quantity', 'cost', 'tiles', 'sheets'], isCore: false },
  { slug: 'free-metal-roofing-calculator', name: 'Metal Roofing Calculator', industry: 'Roofing', description: 'Calculate metal roofing sheets and fixings.', keywords: ['metal', 'sheet', 'fixings', 'corrugated'], isCore: false },
  { slug: 'free-shingle-calculator', name: 'Shingle Calculator', industry: 'Roofing', description: 'Calculate shingle quantities for your roof.', keywords: ['shingle', 'quantity', 'bundle'], isCore: false },
  { slug: 'free-roof-tile-calculator', name: 'Roof Tile Calculator', industry: 'Roofing', description: 'Calculate roof tile quantities and waste.', keywords: ['tile', 'quantity', 'waste'], isCore: false },
  { slug: 'free-flat-roof-calculator', name: 'Flat Roof Calculator', industry: 'Roofing', description: 'Calculate flat roof area and materials.', keywords: ['flat', 'area', 'material', 'membrane'], isCore: false },
  { slug: 'free-gable-roof-calculator', name: 'Gable Roof Calculator', industry: 'Roofing', description: 'Calculate gable roof area, rafters and materials.', keywords: ['gable', 'area', 'rafter', 'material'], isCore: false },
  { slug: 'free-hip-roof-calculator', name: 'Hip Roof Calculator', industry: 'Roofing', description: 'Calculate hip roof area, rafters and materials.', keywords: ['hip', 'area', 'rafter', 'material'], isCore: false },
  { slug: 'free-skillion-roof-calculator', name: 'Skillion Roof Calculator', industry: 'Roofing', description: 'Calculate skillion roof area and materials.', keywords: ['skillion', 'shed', 'area', 'material'], isCore: false },
  { slug: 'free-roof-squares-calculator', name: 'Roof Squares Calculator', industry: 'Roofing', description: 'Calculate roof area in roofing squares.', keywords: ['squares', 'area', 'measurement'], isCore: false },
  { slug: 'free-roof-square-metre-calculator', name: 'Roof Square Metre Calculator', industry: 'Roofing', description: 'Calculate roof area in square metres.', keywords: ['square metre', 'm2', 'area'], isCore: false },
  { slug: 'free-roof-square-footage-calculator', name: 'Roof Square Footage Calculator', industry: 'Roofing', description: 'Calculate roof area in square feet.', keywords: ['square foot', 'ft2', 'area'], isCore: false },
  { slug: 'free-roof-sheathing-calculator', name: 'Roof Sheathing Calculator', industry: 'Roofing', description: 'Calculate roof sheathing quantities.', keywords: ['sheathing', 'decking', 'plywood', 'osb'], isCore: false },
  { slug: 'free-roofing-waste-calculator', name: 'Roofing Waste Calculator', industry: 'Roofing', description: 'Calculate roofing waste allowance.', keywords: ['waste', 'allowance', 'offcut'], isCore: false },
  { slug: 'free-roof-sheet-calculator', name: 'Roof Sheet Calculator', industry: 'Roofing', description: 'Calculate corrugated roof sheet quantities.', keywords: ['sheet', 'corrugated', 'quantity'], isCore: false },
  { slug: 'free-guttering-calculator', name: 'Guttering Calculator', industry: 'Roofing', description: 'Calculate gutter lengths and downpipe quantities.', keywords: ['gutter', 'downpipe', 'drainage'], isCore: false },
  { slug: 'free-roof-flashing-calculator', name: 'Roof Flashing Calculator', industry: 'Roofing', description: 'Calculate flashing lengths for roofs.', keywords: ['flashing', 'apron', 'step', 'valley'], isCore: false },
  { slug: 'free-roof-replacement-cost-calculator', name: 'Roof Replacement Cost Calculator', industry: 'Roofing', description: 'Estimate roof replacement costs.', keywords: ['cost', 'replacement', 'price', 'estimate'], isCore: false },
  { slug: 'free-roofing-takeoff-calculator', name: 'Roofing Takeoff Calculator', industry: 'Roofing', description: 'Full roofing takeoff with materials and labour.', keywords: ['takeoff', 'material', 'labour', 'estimate'], isCore: false },
  { slug: 'free-roofing-quote-calculator', name: 'Roofing Quote Calculator', industry: 'Roofing', description: 'Generate a roofing quote from calculations.', keywords: ['quote', 'price', 'estimate'], isCore: false },

  // Concrete SEO slugs
  { slug: 'free-concrete-slab-calculator', name: 'Concrete Slab Calculator', industry: 'Concrete', description: 'Calculate concrete slab volume and area.', keywords: ['slab', 'volume', 'concrete', 'area'], isCore: false },
  { slug: 'free-concrete-bag-calculator', name: 'Concrete Bag Calculator', industry: 'Concrete', description: 'Calculate number of concrete bags needed.', keywords: ['bag', 'premix', 'quantity'], isCore: false },
  { slug: 'free-footing-calculator', name: 'Footing Calculator', industry: 'Concrete', description: 'Calculate concrete footing volumes.', keywords: ['footing', 'foundation', 'volume'], isCore: false },
  { slug: 'free-rebar-calculator', name: 'Rebar Calculator', industry: 'Concrete', description: 'Calculate rebar quantities for slabs and footings.', keywords: ['rebar', 'reinforcement', 'steel', 'grid'], isCore: false },
  { slug: 'free-trench-calculator', name: 'Trench Calculator', industry: 'Concrete', description: 'Calculate trench volume for footings and services.', keywords: ['trench', 'excavation', 'volume', 'footing'], isCore: false },

  // Construction SEO slugs
  { slug: 'free-wall-area-calculator', name: 'Wall Area Calculator', industry: 'Construction', description: 'Calculate wall surface area for materials.', keywords: ['wall', 'area', 'surface', 'paint'], isCore: false },
  { slug: 'free-paint-calculator', name: 'Paint Calculator', industry: 'Construction', description: 'Calculate paint quantities for walls and ceilings.', keywords: ['paint', 'coverage', 'coats', 'litres'], isCore: false },
  { slug: 'free-tile-calculator', name: 'Tile Calculator', industry: 'Construction', description: 'Calculate tile quantities for floors and walls.', keywords: ['tile', 'quantity', 'floor', 'wall'], isCore: false },
  { slug: 'free-flooring-calculator', name: 'Flooring Calculator', industry: 'Construction', description: 'Calculate flooring material quantities.', keywords: ['flooring', 'laminate', 'wood', 'vinyl', 'quantity'], isCore: false },

  // Slope SEO slugs
  { slug: 'free-slope-calculator', name: 'Slope Calculator', industry: 'Construction', description: 'Calculate slope, gradient and fall percentage.', keywords: ['slope', 'gradient', 'fall', 'percentage'], isCore: false },
  { slug: 'free-pipe-slope-calculator', name: 'Pipe Slope Calculator', industry: 'Construction', description: 'Calculate pipe slope and fall for drainage.', keywords: ['pipe', 'slope', 'drainage', 'fall'], isCore: false },
];

const TOOL_CARDS = [
  {
    title: 'Calculators',
    description: 'Free trade calculators for roofing, construction, concrete, landscaping and more. Calculate areas, volumes, angles, material quantities and pricing.',
    icon: 'calculator',
    href: '#calculators',
  },
  {
    title: 'Quotes',
    description: 'Create a professional quote in minutes. Upload an existing quote for AI to fill the form, or type it manually. Download as PDF - no signup required.',
    icon: 'quote',
    href: '/free-quote-generator',
  },
  {
    title: 'Ordering',
    description: 'Generate purchase orders for your suppliers. Upload, paste, or type - download as PDF with no signup.',
    icon: 'order',
    href: '/free-purchase-order-generator',
  },
  {
    title: 'Invoicing',
    description: 'Create professional invoices with tax calculations. Pre-fill from a quote or start fresh. Download as PDF - no signup required.',
    icon: 'invoice',
    href: '/free-invoice-generator',
  },
];

function ToolIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    calculator: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    ),
    quote: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
    order: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    ),
    invoice: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.25 2.25H6A2.25 2.25 0 003.75 4.5v15A2.25 2.25 0 006 21.75h12A2.25 2.25 0 0020.25 19.5V8.25L14.25 2.25z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.25 2.25v6h6" />
        <text x="12" y="17.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">$</text>
      </>
    ),
  };
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[icon]}
    </svg>
  );
}

export default function FreeToolsPage() {
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

  const visibleCalcs = isSearching
    ? searchResults
    : view === 'core'
      ? coreCalcs
      : CALCULATORS;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <Link href="/free-calculators" className="flex items-center gap-2">
            <img src="/logo.png" alt="QuoteCore+" className="h-8" />
          </Link>
          <Link href="/signup" className="text-xs font-medium text-[#FF6B35] hover:text-orange-600 transition-colors">
            Get full quoting tools
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
        {/* Hero */}
        <section className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Tools</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Free calculators, quote generators, purchase orders and invoices for trades.
            No signup required - just pick a tool and get started.
          </p>
        </section>

        {/* Tool cards */}
        <section className="mb-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOOL_CARDS.map((tool) => {
              const isCalcCard = tool.href.startsWith('#');
              return (
                <Link
                  key={tool.title}
                  href={tool.href}
                  prefetch={false}
                  onClick={isCalcCard ? (e) => { e.preventDefault(); document.getElementById('calculators')?.scrollIntoView({ behavior: 'smooth' }); } : undefined}
                  className="block p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
                >
                  <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors w-fit">
                    <div className="text-[#FF6B35]">
                      <ToolIcon icon={tool.icon} />
                    </div>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900 text-sm">{tool.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{tool.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Calculators section */}
        <section id="calculators">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Calculators</h2>
          <p className="text-sm text-slate-500 mb-4">
            {isSearching
              ? `${searchResults.length} calculator${searchResults.length !== 1 ? 's' : ''} found`
              : view === 'core'
                ? '5 core trade calculators. Switch to All to see every calculator, or search.'
                : `${CALCULATORS.length} free calculators across 4 industries. Search by name or keyword.`}
          </p>

          {/* Search + dropdown */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search calculators by name or keyword..."
                  className="w-full rounded-full border border-slate-300 pl-10 pr-10 py-2.5 text-sm focus:border-orange-500 focus:outline-none bg-white"
                />
                {isSearching && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <select
              value={view}
              onChange={(e) => setView(e.target.value as 'core' | 'all')}
              className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-orange-500 focus:outline-none"
            >
              <option value="core">Core Calculators (5)</option>
              <option value="all">All Calculators ({CALCULATORS.length})</option>
            </select>
          </div>

          {/* Calculator grid */}
          {visibleCalcs.length > 0 ? (
            <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 ${view === 'core' && !isSearching ? 'sm:grid-cols-2' : ''}`}>
              {visibleCalcs.map((calc) => (
                <Link
                  key={calc.slug}
                  href={`/${calc.slug}`}
                  prefetch={false}
                  className={`block bg-white border rounded-xl hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group ${
                    calc.isCore && view === 'core' && !isSearching ? 'p-5 border-2' : 'p-4 border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors flex-shrink-0">
                      <svg className="w-4 h-4 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{calc.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{calc.description}</p>
                      {!calc.isCore && (
                        <span className="inline-block mt-1.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{calc.industry}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border-dashed border-slate-200 border-2 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No calculators found. Try a different search term.</p>
            </div>
          )}
        </section>
      </div>
      <PublicFooter />
    </main>
  );
}
