'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { trackEvent } from '@/lib/analytics';

interface CalcEntry {
  slug: string;
  name: string;
  industry: string;
  description: string;
  keywords: string[];
  isCore: boolean;
}

const CALCULATORS: CalcEntry[] = [
  { slug: 'free-roofing-calculator', name: 'Roofing Calculator', industry: 'Roofing', description: 'Roof pitch, rafter and hip/valley lengths, surface area, and roofing material quantities.', keywords: ['pitch', 'rafter', 'hip', 'valley', 'area', 'battens', 'angle'], isCore: true },
  { slug: 'free-construction-calculator', name: 'Construction Calculator', industry: 'Construction', description: 'Floor and wall areas, timber and stud lengths, material quantities, and cutting angles.', keywords: ['area', 'timber', 'stud', 'materials', 'angle', 'wall', 'floor'], isCore: true },
  { slug: 'free-concrete-calculator', name: 'Concrete Calculator', industry: 'Concrete', description: 'Slab and footing volumes with depth presets, formwork areas, falls, and ready-mix pricing.', keywords: ['slab', 'footing', 'volume', 'formwork', 'falls', 'gradient', 'ready-mix'], isCore: true },
  { slug: 'free-landscaping-calculator', name: 'Landscaping Calculator', industry: 'Landscaping', description: 'Garden and lawn areas, turf and topsoil quantities, slopes, gradients, and falls.', keywords: ['garden', 'lawn', 'turf', 'topsoil', 'slope', 'gradient', 'area'], isCore: true },
  { slug: 'free-birds-mouth-calculator', name: "Bird's Mouth Calculator", industry: 'Roofing', description: "Bird's mouth seat cut and plumb cut angles, heel height, and notch depth with 1/3-depth pass/fail check.", keywords: ['birdsmouth', 'seat cut', 'plumb cut', 'rafter', 'stringer', 'stair', 'notch'], isCore: true },
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
  { slug: 'free-concrete-slab-calculator', name: 'Concrete Slab Calculator', industry: 'Concrete', description: 'Calculate concrete slab volume and area.', keywords: ['slab', 'volume', 'concrete', 'area'], isCore: false },
  { slug: 'free-concrete-bag-calculator', name: 'Concrete Bag Calculator', industry: 'Concrete', description: 'Calculate number of concrete bags needed.', keywords: ['bag', 'premix', 'quantity'], isCore: false },
  { slug: 'free-footing-calculator', name: 'Footing Calculator', industry: 'Concrete', description: 'Calculate concrete footing volumes.', keywords: ['footing', 'foundation', 'volume'], isCore: false },
  { slug: 'free-rebar-calculator', name: 'Rebar Calculator', industry: 'Concrete', description: 'Calculate rebar quantities for slabs and footings.', keywords: ['rebar', 'reinforcement', 'steel', 'grid'], isCore: false },
  { slug: 'free-trench-calculator', name: 'Trench Calculator', industry: 'Concrete', description: 'Calculate trench volume for footings and services.', keywords: ['trench', 'excavation', 'volume', 'footing'], isCore: false },
  { slug: 'free-wall-area-calculator', name: 'Wall Area Calculator', industry: 'Construction', description: 'Calculate wall surface area for materials.', keywords: ['wall', 'area', 'surface', 'paint'], isCore: false },
  { slug: 'free-paint-calculator', name: 'Paint Calculator', industry: 'Construction', description: 'Calculate paint quantities for walls and ceilings.', keywords: ['paint', 'coverage', 'coats', 'litres'], isCore: false },
  { slug: 'free-tile-calculator', name: 'Tile Calculator', industry: 'Construction', description: 'Calculate tile quantities for floors and walls.', keywords: ['tile', 'quantity', 'floor', 'wall'], isCore: false },
  { slug: 'free-flooring-calculator', name: 'Flooring Calculator', industry: 'Construction', description: 'Calculate flooring material quantities.', keywords: ['flooring', 'laminate', 'wood', 'vinyl', 'quantity'], isCore: false },
  { slug: 'free-slope-calculator', name: 'Slope Calculator', industry: 'Construction', description: 'Calculate slope, gradient and fall percentage.', keywords: ['slope', 'gradient', 'fall', 'percentage'], isCore: false },
  { slug: 'free-pipe-slope-calculator', name: 'Pipe Slope Calculator', industry: 'Construction', description: 'Calculate pipe slope and fall for drainage.', keywords: ['pipe', 'slope', 'drainage', 'fall'], isCore: false },
];

function FeatureCheck({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <span className="text-sm text-slate-600 leading-relaxed">{children}</span>
    </li>
  );
}

function MockQuote() {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="h-6 w-16 rounded-full bg-[#FF6B35]/20" />
        </div>
        <div className="space-y-2 pt-2">
          {[100, 85, 92, 70, 95].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              <div className="h-3 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
              <div className="h-3 w-12 rounded-full bg-orange-100" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="h-4 w-20 rounded-full bg-slate-200" />
          <div className="h-6 px-3 rounded-full bg-black flex items-center">
            <div className="h-2 w-12 rounded-full bg-white/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCalculators() {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="grid grid-cols-2 gap-3">
        {['Roofing', 'Concrete', 'Construction', 'Landscaping'].map((trade) => (
          <div key={trade} className="rounded-xl border border-slate-100 p-3 md:p-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-orange-50">
                <svg className="w-4 h-4 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="h-3 w-20 rounded-full bg-slate-200" />
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="h-2 rounded-full bg-slate-100" style={{ width: '90%' }} />
              <div className="h-2 rounded-full bg-slate-100" style={{ width: '70%' }} />
              <div className="h-2 rounded-full bg-orange-100" style={{ width: '50%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockPO() {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="space-y-1.5">
            <div className="h-3 w-28 rounded-full bg-slate-200" />
            <div className="h-2 w-20 rounded-full bg-slate-100" />
          </div>
          <div className="h-8 w-8 rounded-lg bg-[#FF6B35]/15" />
        </div>
        {[100, 80, 90, 65].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-slate-200" />
            <div className="h-3 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
            <div className="h-3 w-10 rounded-full bg-slate-100" />
            <div className="h-3 w-12 rounded-full bg-orange-100" />
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="h-4 w-16 rounded-full bg-slate-200" />
          <div className="h-6 px-3 rounded-full bg-black flex items-center">
            <div className="h-2 w-10 rounded-full bg-white/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockInvoice() {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-20 rounded-full bg-slate-200" />
            <div className="h-2 w-24 rounded-full bg-slate-100" />
          </div>
          <div className="h-10 w-10 rounded-full bg-[#FF6B35]/15" />
        </div>
        {[95, 78, 88].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-slate-200" />
            <div className="h-3 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
            <div className="h-3 w-14 rounded-full bg-orange-100" />
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="h-4 w-18 rounded-full bg-slate-200" />
          <div className="h-6 px-3 rounded-full bg-[#FF6B35] flex items-center">
            <div className="h-2 w-10 rounded-full bg-white/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCtaCentered({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <div className="mt-6 flex justify-center">
      <Link href={href} onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full bg-black px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 min-h-[44px]">
        {label}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
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

  const visibleCalcs = isSearching ? searchResults : view === 'core' ? coreCalcs : CALCULATORS;

  return (
    <FreeToolsAuthProvider>
      <main className="min-h-screen bg-white">
        <BlogHeader />

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.06),transparent_60%)]" />
          <div className="relative mx-auto max-w-5xl px-2 md:px-6 pt-10 md:pt-14 pb-6 md:pb-8 text-center">
            <h1 className="text-xl md:text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Free Tools for Trades</h1>
            <p className="mt-3 md:mt-4 text-sm md:text-lg text-slate-500 max-w-2xl mx-auto px-2">
              Professional calculators and document generators so good, other apps charge you for them. Built by trades, for trades.
            </p>
          </div>
        </section>

        {/* Tool sections */}
        <div className="mx-auto max-w-5xl px-2 md:px-6 pb-12 md:pb-20 space-y-12 md:space-y-20">
          {/* 1. Quote Generator */}
          <section id="quote-generator" className="scroll-mt-24">
            <div className="flex items-center gap-2.5 mb-3">
              <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Quote Generator</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 md:gap-10 items-center">
              <div className="order-2 lg:order-1">
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Create professional quotes in minutes. Optional signup, no catch. Download as PDF and send to your customer today.</p>
                <ul className="mt-4 md:mt-5 space-y-3">
                  <FeatureCheck>Build quotes line by line with full control over pricing, quantities and descriptions</FeatureCheck>
                  <FeatureCheck>AI-assisted quoting - take a photo, upload an image, or copy-paste content and our system creates a professional quote automatically</FeatureCheck>
                  <FeatureCheck>Add your logo, business details, tax rates and terms - looks like it came from your own software</FeatureCheck>
                  <FeatureCheck>Download as PDF instantly. No account needed, no email required</FeatureCheck>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-100/40 to-transparent rounded-3xl" />
                  <MockQuote />
                </div>
                <ToolCtaCentered href="/free-quote-generator" label="Create a Free Quote" onClick={() => trackEvent('free_tools_hub_click', { tool: 'quote-generator' })} />
              </div>
            </div>
          </section>

          {/* 2. Calculators */}
          <section id="calculators" className="scroll-mt-24">
            <div className="flex items-center gap-2.5 mb-3">
              <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Construction Calculators</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 items-center">
              <div className="order-2 lg:order-1">
                <MockCalculators />
                <ToolCtaCentered href="/free-roofing-calculator" label="Open Roofing Calculator" onClick={() => trackEvent('free_tools_hub_click', { tool: 'roofing-calc' })} />
              </div>
              <div className="order-1 lg:order-2">
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Calculate areas, volumes, complex roofing angles, material quantities and more. Built for the field - mobile-friendly and fast.</p>
                <ul className="mt-4 md:mt-5 space-y-3">
                  <FeatureCheck>Roofing: pitch, rafter &amp; hip/valley lengths, surface area, batten quantities, bird&apos;s mouth cuts</FeatureCheck>
                  <FeatureCheck>Concrete: slab &amp; footing volumes, formwork, falls &amp; gradients, ready-mix pricing</FeatureCheck>
                  <FeatureCheck>Construction: wall &amp; floor areas, timber &amp; stud lengths, paint, tiles, flooring quantities</FeatureCheck>
                  <FeatureCheck>Save your results as a <strong>Smart Component™</strong> draft and import it directly into your QuoteCore+ workspace</FeatureCheck>
                </ul>
                <button onClick={() => document.getElementById('all-calculators')?.scrollIntoView({ behavior: 'smooth' })} className="mt-4 inline-flex items-center text-xs md:text-sm font-medium text-[#BD4A1A] hover:text-[#FF6B35] transition-colors">Browse all {CALCULATORS.length} calculators →</button>
              </div>
            </div>
          </section>

          {/* 3. Purchase Order */}
          <section id="purchase-order" className="scroll-mt-24">
            <div className="flex items-center gap-2.5 mb-3">
              <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
              <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Purchase Order Generator</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 md:gap-10 items-center">
              <div className="order-2 lg:order-1">
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Generate professional purchase orders for your suppliers in minutes. No signup, download as PDF.</p>
                <ul className="mt-4 md:mt-5 space-y-3">
                  <FeatureCheck>Line-by-line purchase orders with quantities, unit prices and totals</FeatureCheck>
                  <FeatureCheck>Add your supplier details, delivery dates and job references</FeatureCheck>
                  <FeatureCheck>Pre-fill from a URL parameter - great for re-ordering common materials</FeatureCheck>
                  <FeatureCheck>Brand it with your logo and business details - looks like it came from your own system</FeatureCheck>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-100/40 to-transparent rounded-3xl" />
                  <MockPO />
                </div>
                <ToolCtaCentered href="/free-purchase-order-generator" label="Create a Free Purchase Order" onClick={() => trackEvent('free_tools_hub_click', { tool: 'po-generator' })} />
              </div>
            </div>
          </section>

          {/* 4. Invoice */}
          <section id="invoice-generator" className="scroll-mt-24">
            <div className="flex items-center gap-2.5 mb-3">
              <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25H6A2.25 2.25 0 003.75 4.5v15A2.25 2.25 0 006 21.75h12A2.25 2.25 0 0020.25 19.5V8.25L14.25 2.25z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25v6h6M9 13h6M9 17h3" /></svg>
              <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Invoice Generator</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 items-center">
              <div className="order-2 lg:order-1">
                <MockInvoice />
                <ToolCtaCentered href="/free-invoice-generator" label="Create a Free Invoice" onClick={() => trackEvent('free_tools_hub_click', { tool: 'invoice-generator' })} />
              </div>
              <div className="order-1 lg:order-2">
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Create professional invoices with tax calculations. Pre-fill from a quote or start fresh - download as PDF, no signup.</p>
                <ul className="mt-4 md:mt-5 space-y-3">
                  <FeatureCheck>Itemised invoices with quantities, rates, subtotals and tax</FeatureCheck>
                  <FeatureCheck>Add your branding, payment terms and bank details</FeatureCheck>
                  <FeatureCheck>Pre-fill from a URL parameter - generate an invoice from your free quote in one click</FeatureCheck>
                  <FeatureCheck>Clean, professional PDF output that matches your business identity</FeatureCheck>
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* All calculators search + grid */}
        <section id="all-calculators" className="scroll-mt-24 bg-slate-50 border-t border-slate-100">
          <div className="mx-auto max-w-5xl px-2 md:px-6 py-10 md:py-16">
            <div className="mb-4 md:mb-6">
              <h2 className="text-lg md:text-2xl font-semibold text-slate-900">All Calculators</h2>
              <p className="mt-1 text-xs md:text-sm text-slate-500">
                {isSearching
                  ? `${searchResults.length} calculator${searchResults.length !== 1 ? 's' : ''} found`
                  : view === 'core'
                  ? '5 core trade calculators. Switch to All to see every calculator, or search.'
                  : `${CALCULATORS.length} free calculators across 4 industries. Search by name or keyword.`}
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
                <option value="all">All Calculators ({CALCULATORS.length})</option>
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

        {/* Why free? */}
        <section className="mx-auto max-w-3xl px-2 md:px-6 py-10 md:py-16 text-center">
          <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Why are these free?</h2>
          <p className="mt-3 text-xs md:text-sm text-slate-500 leading-relaxed">
            We build tools for trades. These calculators and generators are the same ones powering QuoteCore+ - our full quoting and job management platform. We give them away because they should be free. If you want the full system - takeoffs, components, quotes, orders, invoices, scheduling - that is where QuoteCore+ comes in.
          </p>
          <Link href="/signup" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#E55A2B] hover:shadow-[0_0_16px_rgba(255,107,53,0.4)] min-h-[44px]">
            Explore QuoteCore+
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </Link>
        </section>

        <SiteFooter />
      </main>
    </FreeToolsAuthProvider>
  );
}