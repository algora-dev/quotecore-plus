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
}

const CALCULATORS: CalcEntry[] = [
  // Main trade calculators
  { slug: 'free-roofing-calculator', name: 'Roofing Calculator', industry: 'Roofing', description: 'Roof pitch, rafter and hip/valley lengths, surface area, and roofing material quantities.', keywords: ['pitch', 'rafter', 'hip', 'valley', 'area', 'battens', 'angle'] },
  { slug: 'free-construction-calculator', name: 'Construction Calculator', industry: 'Construction', description: 'Floor and wall areas, timber and stud lengths, material quantities, and cutting angles.', keywords: ['area', 'timber', 'stud', 'materials', 'angle', 'wall', 'floor'] },
  { slug: 'free-concrete-calculator', name: 'Concrete Calculator', industry: 'Concrete', description: 'Slab and footing volumes with depth presets, formwork areas, falls, and ready-mix pricing.', keywords: ['slab', 'footing', 'volume', 'formwork', 'falls', 'gradient', 'ready-mix'] },
  { slug: 'free-landscaping-calculator', name: 'Landscaping Calculator', industry: 'Landscaping', description: 'Garden and lawn areas, turf and topsoil quantities, slopes, gradients, and falls.', keywords: ['garden', 'lawn', 'turf', 'topsoil', 'slope', 'gradient', 'area'] },
  { slug: 'free-birds-mouth-calculator', name: "Bird's Mouth Calculator", industry: 'Roofing', description: "Bird's mouth seat cut and plumb cut angles, heel height, and notch depth with ⅓-depth pass/fail check.", keywords: ['birdsmouth', 'seat cut', 'plumb cut', 'rafter', 'stringer', 'stair', 'notch'] },

  // Roofing SEO slugs
  { slug: 'free-roof-pitch-calculator', name: 'Roof Pitch Calculator', industry: 'Roofing', description: 'Calculate roof pitch from rise and run.', keywords: ['pitch', 'rise', 'run', 'angle', 'slope'] },
  { slug: 'free-roof-pitch-converter', name: 'Roof Pitch Converter', industry: 'Roofing', description: 'Convert between pitch ratio, degrees, and percentage.', keywords: ['pitch', 'convert', 'degrees', 'ratio', 'percentage'] },
  { slug: 'free-roof-area-calculator', name: 'Roof Area Calculator', industry: 'Roofing', description: 'Calculate roof surface area from plan dimensions and pitch.', keywords: ['area', 'surface', 'plan', 'pitch', 'square'] },
  { slug: 'free-rafter-length-calculator', name: 'Rafter Length Calculator', industry: 'Roofing', description: 'Calculate rafter length from span and pitch.', keywords: ['rafter', 'length', 'span', 'pitch'] },
  { slug: 'free-rafter-length-converter', name: 'Rafter Length Converter', industry: 'Roofing', description: 'Convert rafter measurements between metric and imperial.', keywords: ['rafter', 'convert', 'metric', 'imperial'] },
  { slug: 'free-hip-valley-calculator', name: 'Hip & Valley Calculator', industry: 'Roofing', description: 'Calculate hip and valley rafter lengths.', keywords: ['hip', 'valley', 'rafter', 'length'] },
  { slug: 'free-hip-valley-converter', name: 'Hip & Valley Converter', industry: 'Roofing', description: 'Convert hip and valley measurements between units.', keywords: ['hip', 'valley', 'convert', 'metric', 'imperial'] },
  { slug: 'free-roofing-material-calculator', name: 'Roofing Material Calculator', industry: 'Roofing', description: 'Calculate roofing material quantities and costs.', keywords: ['material', 'quantity', 'cost', 'tiles', 'sheets'] },
  { slug: 'free-metal-roofing-calculator', name: 'Metal Roofing Calculator', industry: 'Roofing', description: 'Calculate metal roofing sheets and fixings.', keywords: ['metal', 'sheet', 'fixings', 'corrugated'] },
  { slug: 'free-shingle-calculator', name: 'Shingle Calculator', industry: 'Roofing', description: 'Calculate shingle quantities for your roof.', keywords: ['shingle', 'quantity', 'bundle'] },
  { slug: 'free-roof-tile-calculator', name: 'Roof Tile Calculator', industry: 'Roofing', description: 'Calculate roof tile quantities and waste.', keywords: ['tile', 'quantity', 'waste'] },
  { slug: 'free-flat-roof-calculator', name: 'Flat Roof Calculator', industry: 'Roofing', description: 'Calculate flat roof area and materials.', keywords: ['flat', 'area', 'material', 'membrane'] },
  { slug: 'free-gable-roof-calculator', name: 'Gable Roof Calculator', industry: 'Roofing', description: 'Calculate gable roof area, rafters and materials.', keywords: ['gable', 'area', 'rafter', 'material'] },
  { slug: 'free-hip-roof-calculator', name: 'Hip Roof Calculator', industry: 'Roofing', description: 'Calculate hip roof area, rafters and materials.', keywords: ['hip', 'area', 'rafter', 'material'] },
  { slug: 'free-skillion-roof-calculator', name: 'Skillion Roof Calculator', industry: 'Roofing', description: 'Calculate skillion roof area and materials.', keywords: ['skillion', 'shed', 'area', 'material'] },
  { slug: 'free-roof-squares-calculator', name: 'Roof Squares Calculator', industry: 'Roofing', description: 'Calculate roof area in roofing squares.', keywords: ['squares', 'area', 'measurement'] },
  { slug: 'free-roof-square-metre-calculator', name: 'Roof Square Metre Calculator', industry: 'Roofing', description: 'Calculate roof area in square metres.', keywords: ['square metre', 'm2', 'area'] },
  { slug: 'free-roof-square-footage-calculator', name: 'Roof Square Footage Calculator', industry: 'Roofing', description: 'Calculate roof area in square feet.', keywords: ['square foot', 'ft2', 'area'] },
  { slug: 'free-roof-sheathing-calculator', name: 'Roof Sheathing Calculator', industry: 'Roofing', description: 'Calculate roof sheathing quantities.', keywords: ['sheathing', 'decking', 'plywood', 'osb'] },
  { slug: 'free-roofing-waste-calculator', name: 'Roofing Waste Calculator', industry: 'Roofing', description: 'Calculate roofing waste allowance.', keywords: ['waste', 'allowance', 'offcut'] },
  { slug: 'free-roof-sheet-calculator', name: 'Roof Sheet Calculator', industry: 'Roofing', description: 'Calculate corrugated roof sheet quantities.', keywords: ['sheet', 'corrugated', 'quantity'] },
  { slug: 'free-guttering-calculator', name: 'Guttering Calculator', industry: 'Roofing', description: 'Calculate gutter lengths and downpipe quantities.', keywords: ['gutter', 'downpipe', 'drainage'] },
  { slug: 'free-roof-flashing-calculator', name: 'Roof Flashing Calculator', industry: 'Roofing', description: 'Calculate flashing lengths for roofs.', keywords: ['flashing', 'apron', 'step', 'valley'] },
  { slug: 'free-roof-replacement-cost-calculator', name: 'Roof Replacement Cost Calculator', industry: 'Roofing', description: 'Estimate roof replacement costs.', keywords: ['cost', 'replacement', 'price', 'estimate'] },
  { slug: 'free-roofing-takeoff-calculator', name: 'Roofing Takeoff Calculator', industry: 'Roofing', description: 'Full roofing takeoff with materials and labour.', keywords: ['takeoff', 'material', 'labour', 'estimate'] },
  { slug: 'free-roofing-quote-calculator', name: 'Roofing Quote Calculator', industry: 'Roofing', description: 'Generate a roofing quote from calculations.', keywords: ['quote', 'price', 'estimate'] },

  // Concrete SEO slugs
  { slug: 'free-concrete-slab-calculator', name: 'Concrete Slab Calculator', industry: 'Concrete', description: 'Calculate concrete slab volume and area.', keywords: ['slab', 'volume', 'concrete', 'area'] },
  { slug: 'free-concrete-bag-calculator', name: 'Concrete Bag Calculator', industry: 'Concrete', description: 'Calculate number of concrete bags needed.', keywords: ['bag', 'premix', 'quantity'] },
  { slug: 'free-footing-calculator', name: 'Footing Calculator', industry: 'Concrete', description: 'Calculate concrete footing volumes.', keywords: ['footing', 'foundation', 'volume'] },
  { slug: 'free-rebar-calculator', name: 'Rebar Calculator', industry: 'Concrete', description: 'Calculate rebar quantities for slabs and footings.', keywords: ['rebar', 'reinforcement', 'steel', 'grid'] },
  { slug: 'free-trench-calculator', name: 'Trench Calculator', industry: 'Concrete', description: 'Calculate trench volume for footings and services.', keywords: ['trench', 'excavation', 'volume', 'footing'] },

  // Construction SEO slugs
  { slug: 'free-wall-area-calculator', name: 'Wall Area Calculator', industry: 'Construction', description: 'Calculate wall surface area for materials.', keywords: ['wall', 'area', 'surface', 'paint'] },
  { slug: 'free-paint-calculator', name: 'Paint Calculator', industry: 'Construction', description: 'Calculate paint quantities for walls and ceilings.', keywords: ['paint', 'coverage', 'coats', 'litres'] },
  { slug: 'free-tile-calculator', name: 'Tile Calculator', industry: 'Construction', description: 'Calculate tile quantities for floors and walls.', keywords: ['tile', 'quantity', 'floor', 'wall'] },
  { slug: 'free-flooring-calculator', name: 'Flooring Calculator', industry: 'Construction', description: 'Calculate flooring material quantities.', keywords: ['flooring', 'laminate', 'wood', 'vinyl', 'quantity'] },

  // Slope SEO slugs
  { slug: 'free-slope-calculator', name: 'Slope Calculator', industry: 'Construction', description: 'Calculate slope, gradient and fall percentage.', keywords: ['slope', 'gradient', 'fall', 'percentage'] },
  { slug: 'free-pipe-slope-calculator', name: 'Pipe Slope Calculator', industry: 'Construction', description: 'Calculate pipe slope and fall for drainage.', keywords: ['pipe', 'slope', 'drainage', 'fall'] },
];

const INDUSTRIES = ['All', 'Roofing', 'Construction', 'Concrete', 'Landscaping'];

const TOOL_CARDS = [
  {
    title: 'Calculators',
    description: 'Free trade calculators for roofing, construction, concrete, landscaping and more. Calculate areas, volumes, angles, material quantities and pricing.',
    icon: 'calculator',
    href: '#calculators',
  },
  {
    title: 'Quotes',
    description: 'Create a professional quote in minutes. Upload an existing quote for AI to fill the form, or type it manually. Download as PDF — no signup required.',
    icon: 'quote',
    href: '/free-quote-generator',
  },
  {
    title: 'Ordering',
    description: 'Generate purchase orders for your suppliers. Upload, paste, or type — download as PDF with no signup.',
    icon: 'order',
    href: '/free-purchase-order-generator',
  },
  {
    title: 'Invoicing',
    description: 'Create professional invoices with tax calculations. Pre-fill from a quote or start fresh. Download as PDF — no signup required.',
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    ),
    invoice: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-3 3 3 3-3 3 3z" />
    ),
  };
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[icon]}
    </svg>
  );
}

export default function FreeToolsPage() {
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCalcs = useMemo(() => {
    return CALCULATORS.filter((c) => {
      const matchesIndustry = selectedIndustry === 'All' || c.industry === selectedIndustry;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q));
      return matchesIndustry && matchesSearch;
    });
  }, [selectedIndustry, searchQuery]);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <Link href="/free-calculators" className="flex items-center gap-2">
            <img src="/logo.png" alt="QuoteCore+" className="h-8" />
          </Link>
          <Link href="/signup" className="text-xs font-medium text-[#FF6B35] hover:text-orange-600 transition-colors">
            Get full quoting tools →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
        {/* Hero */}
        <section className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Tools</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Free calculators, quote generators, purchase orders and invoices for trades.
            No signup required — just pick a tool and get started.
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
            {CALCULATORS.length} free calculators across {INDUSTRIES.length - 1} industries. Search by name or keyword, or filter by industry.
          </p>

          {/* Search + filter */}
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
                  className="w-full rounded-full border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none bg-white"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  onClick={() => setSelectedIndustry(ind)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                    selectedIndustry === ind
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-[#FF6B35] hover:text-[#FF6B35]'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-slate-400 mb-3">
            {filteredCalcs.length} calculator{filteredCalcs.length !== 1 ? 's' : ''} found
          </p>

          {/* Calculator grid */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCalcs.map((calc) => (
              <Link
                key={calc.slug}
                href={`/${calc.slug}`}
                prefetch={false}
                className="block p-4 bg-white border border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group"
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
                    <span className="inline-block mt-1.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{calc.industry}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredCalcs.length === 0 && (
            <div className="rounded-xl border-dashed border-slate-200 border-2 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No calculators found. Try a different search or industry.</p>
            </div>
          )}
        </section>
      </div>
      <PublicFooter />
    </main>
  );
}
