import Link from 'next/link';
import { TRADE_CALCULATORS, HUB_BLURBS } from './configs/registry';
import { ROOFING_SLUG_CONFIGS } from './configs/roofingSlugRegistry';

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
      {/* Hero */}
      <section className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Trade Calculators</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-xl">
          Free online calculators built for trades — areas, volumes, angles, material quantities,
          waste allowances, and pricing. No signup required, works on mobile and desktop.
        </p>
      </section>

      {/* Calculator grid */}
      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TRADE_CALCULATORS.map((calc) => (
            <Link
              key={calc.slug}
              href={`/${calc.slug}`}
              prefetch={false}
              className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                  <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{calc.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{HUB_BLURBS[calc.slug] ?? calc.metaDescription}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Roofing-specific calculators */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Roofing calculators</h2>
        <p className="mt-1 text-sm text-slate-500">26 free roofing-specific calculators — pitch, area, rafters, materials, flashing, guttering, and more.</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ROOFING_SLUG_CONFIGS.map((calc) => (
            <Link
              key={calc.slug}
              href={`/${calc.slug}`}
              prefetch={false}
              className="block w-full text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-[#FF6B35] hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-medium text-slate-900 group-hover:text-[#FF6B35] transition">{calc.content.h1}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Other free tools */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">More free tools</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/free-quote-generator"
            prefetch={false}
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Free Quote Generator</p>
                <p className="text-xs text-slate-500 mt-0.5">Turn measurements into a professional quote</p>
              </div>
            </div>
          </Link>

          <Link
            href="/free-invoice-generator"
            prefetch={false}
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Free Invoice Generator</p>
                <p className="text-xs text-slate-500 mt-0.5">Create and send professional invoices</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Why these calculators */}
      <section className="mt-12 mb-8">
        <h2 className="text-lg font-semibold text-slate-900">Why use these calculators?</h2>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Built by trade software, for trades</h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              These calculators use the same measurement and pricing engine as QuoteCore+, the quoting and job
              management platform for trade businesses. Every formula — pitch factors, waste allowances,
              pack-based pricing — is the same maths professionals use to price real jobs.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Free, private, no signup</h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              All calculations run in your browser — nothing is uploaded, tracked, or stored on a server.
              Use them on-site from your phone or at the desk, as often as you like.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
