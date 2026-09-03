'use client';

// Supplier Pricing Tool - combined demo entry point. One page, one question:
// what are you pricing? Roof -> Apex Roofing (roofing flow), Walls/cladding
// -> Vertex Cladding, Flooring -> Oakline Flooring. Direct per-supplier
// routes (e.g. /supplier-pricing-tool/burton-roofing) keep working for
// single-trade customer demos (Burton = real-customer example).

import Link from 'next/link';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';

const OPTIONS = [
  {
    href: '/supplier-pricing-tool/apex-roofing',
    title: 'Roof',
    desc: 'Price a full roof - slate or tile, ridges, valleys, hips, barges, spouting and downpipes.',
    demo: 'Apex Roofing',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v10h14V10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20v-6h6v6" />
      </>
    ),
  },
  {
    href: '/supplier-pricing-tool/vertex-cladding',
    title: 'Walls / Cladding',
    desc: 'Price wall systems - weatherboard, fibre cement, cedar and trims, measured per wall.',
    demo: 'Vertex Cladding',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V8l8-5 8 5v13" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 16h16M8 8h8" />
      </>
    ),
  },
  {
    href: '/supplier-pricing-tool/oakline-flooring',
    title: 'Flooring',
    desc: 'Price floor systems - hybrid, LVT, laminate, underlay, skirting and floor fittings.',
    demo: 'Oakline Flooring',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="1" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M9 6v12M15 6v12" />
      </>
    ),
  },
];

function Hub() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-black/20" style={{ backgroundColor: '#1E293B' }}>
        <div className="mx-auto max-w-5xl px-4 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Supplier Pricing Tool</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
                  Demo
                </span>
              </div>
              <div className="hidden sm:block text-xs text-white/60">Measure, price and quote a job in minutes - demo only, not a real company</div>
            </div>
          </div>
          <span className="text-xs text-white/60">Powered by QuoteCore+</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">What would you like to price?</h1>
          <p className="mt-2 text-sm text-slate-500">Pick a trade to start - you can restart with another at any time.</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {OPTIONS.map(o => (
            <Link
              key={o.href}
              href={o.href}
              className="group rounded-xl border border-slate-200 bg-white px-6 py-7 text-center transition hover:border-blue-200 hover:shadow-[0_0_12px_rgba(37,99,235,0.15)]"
            >
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white transition group-hover:bg-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {o.icon}
                </svg>
              </span>
              <div className="mt-4 text-base font-bold text-slate-900">{o.title}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-slate-500">{o.desc}</div>
              <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">{o.demo}</div>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Each trade runs the full flow: measure from a plan or site dimensions, pick products, get priced totals with trade discounts.
        </p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <FreeToolsAuthProvider>
      <Hub />
    </FreeToolsAuthProvider>
  );
}
