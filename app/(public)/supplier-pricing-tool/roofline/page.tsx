'use client';

// Roofline Canterbury - dual-trade demo entry point. One link to send the
// Roofline team: pick roofing or cladding, then run the full tool under the
// matching slug (roofline-roofing / roofline-cladding). Kept separate from
// the generic demo hub (/supplier-pricing-tool) so this page shows only
// Roofline branding - no fake Apex/Vertex/Oakline trades above the fold.

import Link from 'next/link';

const HEADER_BG = '#111111';
const ACCENT = '#C8102E';

const TRADES = [
  {
    href: '/supplier-pricing-tool/roofline-roofing',
    title: 'Roofing',
    desc: 'Roofdeck and Corrugate coverings, ridge/hip/valley/barge flashings, fascia, gutter and downpipes.',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    href: '/supplier-pricing-tool/roofline-cladding',
    title: 'Cladding',
    desc: 'Weatherboard (Colorsteel) and the full set of cladding flashings, measured per wall.',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V8l8-5 8 5v13" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 16h16" />
      </>
    ),
  },
];

function RooflineHub() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-black/20" style={{ backgroundColor: HEADER_BG }}>
        <div className="mx-auto max-w-5xl px-4 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/supplier-logos/roofline-canterbury.png" alt="Roofline Canterbury" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Roofline Canterbury Ltd</div>
              <div className="hidden sm:block text-xs text-white/60">Roofing &amp; Cladding Manufacturers - Christchurch</div>
            </div>
          </div>
          <span className="text-xs text-white/60">Powered by QuoteCore+</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">What would you like to price?</h1>
          <p className="mt-2 text-sm text-slate-500">Pick a trade to start - you can restart with the other at any time.</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {TRADES.map(t => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-xl border border-slate-200 bg-white px-6 py-8 text-center transition hover:border-red-200 hover:shadow-[0_0_12px_rgba(200,16,46,0.15)]"
            >
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white transition group-hover:bg-[#C8102E]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {t.icon}
                </svg>
              </span>
              <div className="mt-4 text-base font-bold text-slate-900">{t.title}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.desc}</div>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Each trade runs the full flow: measure from a plan or site dimensions, pick products, get priced totals with your trade discounts.
        </p>
      </div>
    </main>
  );
}

export default function Page() {
  return <RooflineHub />;
}
