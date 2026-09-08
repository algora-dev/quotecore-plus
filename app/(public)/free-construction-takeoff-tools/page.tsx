import type { Metadata } from 'next';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { buildBreadcrumbSchema } from '@/lib/schema';

const SITE_URL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Free Construction Takeoff Tools — Measure PDF Plans Online | QuoteCore+',
  description:
    'Free construction takeoff software: upload your own PDF plans and measure roof, siding/cladding and flooring areas, lengths and quantities online. Or start with measurements you already have. No signup for the core workflow.',
  alternates: {
    canonical: `${SITE_URL}/free-construction-takeoff-tools`,
    languages: hreflangLanguages('/free-construction-takeoff-tools'),
  },
  openGraph: {
    title: 'Free Construction Takeoff Tools — Measure PDF Plans Online | QuoteCore+',
    description:
      'Upload your own plans and measure roof, siding/cladding and flooring takeoffs online free - or start with measurements you already have. No signup.',
    url: `${SITE_URL}/free-construction-takeoff-tools`,
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: `${SITE_URL}/` },
  { name: 'Free Construction Takeoff Tools', url: `${SITE_URL}/free-construction-takeoff-tools` },
]);

const tools = [
  {
    title: 'Free Roof Takeoff',
    href: '/free-roof-takeoff',
    desc: 'Upload a roof plan or image, calibrate the scale, and measure roof areas, ridges, hips, valleys, barges and eaves with automatic pitch factors. Metric, imperial or roofing squares, with your own component pricing if you want it.',
    cta: 'Measure a roof plan free',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v10h14V10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20v-6h6v6" />
      </>
    ),
  },
  {
    title: 'Free Siding & Cladding Takeoff',
    href: '/free-cladding-takeoff',
    desc: 'Upload an elevation or wall plan and measure siding and cladding areas, trims, window and door openings, and battens as linear quantities. Square feet or square metres, any material, gross or net of openings.',
    cta: 'Measure an elevation or wall plan free',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V8l8-5 8 5v13" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 16h16M8 8h8" />
      </>
    ),
  },
  {
    title: 'Free Flooring Takeoff',
    href: '/free-flooring-takeoff',
    desc: 'Upload a floor plan and measure room areas by material - timber, LVP, laminate, carpet, tile - with baseboard/skirting, scotia and transitions as linear runs, plus openings and fixed items deducted.',
    cta: 'Measure a floor plan free',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="1" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M9 6v12M15 6v12" />
      </>
    ),
  },
];

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function FreeConstructionTakeoffToolsPage() {
  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <BlogHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.06),transparent_60%)]" />
        <div className="relative mx-auto max-w-5xl px-4 md:px-6 pt-10 md:pt-14 pb-6 text-center">
          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Free Construction Takeoff Tools — Use Your Own Plans, No Signup
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm md:text-base text-slate-600">
            Upload your own plans, measure real areas and lengths, or start with measurements you already have.
            These are the high-value plan-measurement and measurement-to-pricing tools - not quick calculators -
            and the core workflow needs no account.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#choose-a-tool" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]">
              Choose a free takeoff tool
            </a>
            <Link href="/measurement-to-quote-tool" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">
              I already have measurements
            </Link>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section id="choose-a-tool" className="mx-auto max-w-5xl px-4 md:px-6 pt-10 scroll-mt-24">
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">The free takeoff tools</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {tools.map((t) => (
            <div key={t.href} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF6B35]/10 text-[#BD4A1A]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {t.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{t.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{t.desc}</p>
              <Link
                href={t.href}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Measurement-to-Quote - equal prominence */}
        <div className="mt-6 rounded-xl border-2 border-[#FF6B35]/30 bg-orange-50/40 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#BD4A1A]">Already measured the job?</p>
          <div className="mt-2 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-slate-900">Measurement-to-Quote</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Enter areas, lengths and quantities from anywhere - a site measure, another takeoff app, an aerial or
                satellite report, a spreadsheet. Reusable components apply materials, labor, waste, pack sizes and
                pitch logic automatically, and the priced output becomes a professional estimate or quote.
              </p>
            </div>
            <Link
              href="/measurement-to-quote-tool"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
            >
              Turn measurements into pricing
            </Link>
          </div>
        </div>
      </section>

      {/* What makes these different */}
      <section className="mx-auto max-w-5xl px-4 md:px-6 py-12">
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">What makes these different from basic calculators?</h2>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-2">
          <li className="rounded-xl border border-slate-200 bg-white px-5 py-4">You use <strong className="text-slate-900">your own plan or measurements</strong> - not generic sample inputs.</li>
          <li className="rounded-xl border border-slate-200 bg-white px-5 py-4">You work a <strong className="text-slate-900">real measurement workflow</strong> - upload, calibrate, trace - the same steps as paid takeoff software.</li>
          <li className="rounded-xl border border-slate-200 bg-white px-5 py-4">You get <strong className="text-slate-900">meaningful, project-specific output</strong> - quantities and totals you can order and quote from.</li>
          <li className="rounded-xl border border-slate-200 bg-white px-5 py-4">Where supported, you apply <strong className="text-slate-900">your own pricing and custom components</strong> - not fixed assumptions.</li>
          <li className="rounded-xl border border-slate-200 bg-white px-5 py-4 md:col-span-2">And the core experience needs <strong className="text-slate-900">no signup</strong> - do real takeoff work before you create any account.</li>
        </ul>
      </section>

      {/* Two routes */}
      <section className="mx-auto max-w-5xl px-4 md:px-6 pb-12">
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Start from a plan, or start from measurements</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6">
            <p className="text-sm font-semibold text-slate-900">I have a plan or image</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose the surface you&rsquo;re pricing:
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>Roof plan → <Link href="/free-roof-takeoff" className={link}>Free Roof Takeoff</Link></li>
              <li>Elevation / wall plan (siding, cladding) → <Link href="/free-cladding-takeoff" className={link}>Free Siding &amp; Cladding Takeoff</Link></li>
              <li>Floor plan → <Link href="/free-flooring-takeoff" className={link}>Free Flooring Takeoff</Link></li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6">
            <p className="text-sm font-semibold text-slate-900">I already have measurements</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Skip the takeoff and price what you have - from a site measure, satellite report, another app or a
              spreadsheet:
            </p>
            <p className="mt-3 text-sm">
              <Link href="/measurement-to-quote-tool" className={link}>Open the Measurement-to-Quote tool →</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Full app */}
      <section className="mx-auto max-w-5xl px-4 md:px-6 pb-12">
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">What happens in the full app?</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-900">Free tools</p>
            <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-600">
              <li>Use now, no signup</li>
              <li>Session-oriented - measure, output, done</li>
              <li>Real plans, real measurements, real output</li>
              <li>Limited saving/reuse depending on the tool</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-900">Full QuoteCore+ app</p>
            <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-600">
              <li>Save jobs and takeoffs</li>
              <li>Saved component libraries and reusable pricing</li>
              <li>Full quote, order and invoice workflow</li>
              <li>AI Scan Assist where included, plus job and customer history</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          The free result is never locked behind a signup - upgrade only when saving and the connected workflow are useful. See{' '}
          <Link href="/construction-quoting-software" className={link}>contractor estimating &amp; quoting software</Link> or{' '}
          <Link href="/construction-takeoff-software" className={link}>construction takeoff software</Link> for the full platform.
        </p>
      </section>

      {/* Calculators bridge */}
      <section className="mx-auto max-w-5xl px-4 md:px-6 pb-14">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-5 text-center">
          <p className="text-sm text-slate-600">
            Need a quick roof, concrete, margin, material or construction calculator?{' '}
            <Link href="/free-tools" className="font-semibold text-[#BD4A1A] hover:underline">Browse all free tools.</Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
