import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { TOOLS, CALCULATORS, CALCULATOR_COUNT } from './tools-data';
import CalculatorSearchGrid from './CalculatorSearchGrid';
import { QuoteGeneratorSection, RoofTakeoffSection, CalculatorsSection, PurchaseOrderSection, InvoiceSection } from './ToolSections';
import DemoCTACard from "@/components/DemoCTACard";

const SITE_URL = 'https://quote-core.com';

export default function FreeToolsPage() {
  // Group calculators by industry for the static crawl-friendly list
  const roofingCalcs = CALCULATORS.filter(c => c.industry === 'Roofing');
  const concreteCalcs = CALCULATORS.filter(c => c.industry === 'Concrete');
  const constructionCalcs = CALCULATORS.filter(c => c.industry === 'Construction');
  const landscapingCalcs = CALCULATORS.filter(c => c.industry === 'Landscaping');

  return (
    <FreeToolsAuthProvider>
      <main className="min-h-screen bg-white">
        <BlogHeader />

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.06),transparent_60%)]" />
          <div className="relative mx-auto max-w-5xl px-2 md:px-6 pt-10 md:pt-14 pb-6 md:pb-8 text-center">
            <h1 className="text-xl md:text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Free Roofing Tools & Calculators</h1>
            <p className="mt-3 md:mt-4 text-sm md:text-lg text-slate-500 max-w-2xl mx-auto px-2">
              Professional roofing calculators and document generators so good, other apps charge you for them. Built by a roofer, for roofers - and every trade that measures and quotes. Need the full workflow? Explore <Link href="/construction-quoting-software" className="text-[#BD4A1A] underline underline-offset-2">construction quoting software</Link> from QuoteCore+.
            </p>
          </div>
        </section>

        {/* What do you need to do? routing */}
        <section className="mx-auto max-w-5xl px-2 md:px-6 py-8 md:py-12">
          <h2 className="text-lg md:text-2xl font-semibold text-slate-900 mb-4">What do you need to do?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link href="/free-roof-pricing-calculator" prefetch={false} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-[#FF6B35] hover:bg-orange-50/40 transition-all">Price a roof</Link>
            <Link href="/free-roofing-takeoff-builder" prefetch={false} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-[#FF6B35] hover:bg-orange-50/40 transition-all">Measure a roof</Link>
            <Link href="/free-roofing-calculator" prefetch={false} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-[#FF6B35] hover:bg-orange-50/40 transition-all">Calculate materials</Link>
            <Link href="/free-quote-generator" prefetch={false} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-[#FF6B35] hover:bg-orange-50/40 transition-all">Create a quote</Link>
            <Link href="/free-invoice-generator" prefetch={false} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-[#FF6B35] hover:bg-orange-50/40 transition-all">Create an invoice</Link>
            <Link href="/free-purchase-order-generator" prefetch={false} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-[#FF6B35] hover:bg-orange-50/40 transition-all">Create a purchase order</Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">Not sure where to begin? Start with the <Link href="/free-roofing-takeoff-builder" className="text-[#BD4A1A] underline">Roof Takeoff Builder</Link>.</p>
        </section>

        {/* Tool sections */}
        <div className="mx-auto max-w-5xl px-2 md:px-6 pb-12 md:pb-20 space-y-12 md:space-y-20">
          <QuoteGeneratorSection />
          <RoofTakeoffSection />
          <CalculatorsSection calculatorCount={CALCULATOR_COUNT} />
          <PurchaseOrderSection />
          <InvoiceSection />
        </div>

        {/* All calculators search + grid (client component) */}
        <CalculatorSearchGrid />

        {/* Static crawl-friendly tool directory */}
        <section className="mx-auto max-w-5xl px-2 md:px-6 py-10 md:py-16">
          <h2 className="text-lg md:text-2xl font-semibold text-slate-900 mb-2">Complete Tool Directory</h2>
          <p className="text-xs md:text-sm text-slate-500 mb-6">
            All {TOOLS.length} free tools available on QuoteCore+. No signup required.
          </p>

          {/* Generators and takeoff */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Generators &amp; Takeoff</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {TOOLS.filter(t => t.category !== 'calculator').map((tool) => (
                <Link key={tool.slug} href={`/${tool.slug}`} prefetch={false} className="block bg-white border rounded-xl p-4 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                  <div className="font-medium text-sm text-slate-900 group-hover:text-[#BD4A1A]">{tool.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{tool.industry}</div>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{tool.description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Roofing calculators */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Roofing Calculators ({roofingCalcs.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {roofingCalcs.map((tool) => (
                <Link key={tool.slug} href={`/${tool.slug}`} prefetch={false} className="block bg-white border rounded-xl p-4 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                  <div className="font-medium text-sm text-slate-900 group-hover:text-[#BD4A1A]">{tool.name}</div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Concrete calculators */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Concrete Calculators ({concreteCalcs.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {concreteCalcs.map((tool) => (
                <Link key={tool.slug} href={`/${tool.slug}`} prefetch={false} className="block bg-white border rounded-xl p-4 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                  <div className="font-medium text-sm text-slate-900 group-hover:text-[#BD4A1A]">{tool.name}</div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Construction calculators */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Construction Calculators ({constructionCalcs.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {constructionCalcs.map((tool) => (
                <Link key={tool.slug} href={`/${tool.slug}`} prefetch={false} className="block bg-white border rounded-xl p-4 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                  <div className="font-medium text-sm text-slate-900 group-hover:text-[#BD4A1A]">{tool.name}</div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Landscaping calculators */}
          {landscapingCalcs.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Landscaping Calculators ({landscapingCalcs.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {landscapingCalcs.map((tool) => (
                  <Link key={tool.slug} href={`/${tool.slug}`} prefetch={false} className="block bg-white border rounded-xl p-4 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                    <div className="font-medium text-sm text-slate-900 group-hover:text-[#BD4A1A]">{tool.name}</div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Chrome extension strip */}
        <section className="mx-auto max-w-3xl px-2 md:px-6 py-6">
          <div className="flex flex-col items-start gap-4 rounded-xl border-2 border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/blog/chrome-extension-icon.png"
              alt="QuoteCore+ Roof Pitch Calculator Chrome extension icon"
              className="h-12 w-12 rounded-lg"
              loading="lazy"
              width={48}
              height={48}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Roof Pitch Calculator — Chrome extension</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Pitch, angle, slope and rafter calculations in one click, from any tab. Free, no account.
              </p>
            </div>
            <a
              href="https://chromewebstore.google.com/detail/ldndmfncphniifbddcbkmamhpdnfmehm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
            >
              Add to Chrome
            </a>
          </div>
        </section>

        {/* Demo card */}
        <section className="mx-auto max-w-3xl px-2 md:px-6 py-6">
          <DemoCTACard location="free_tools_hub" variant="inline" />
        </section>

        {/* Why free? */}
        <section className="mx-auto max-w-3xl px-2 md:px-6 py-10 md:py-16 text-center">
          <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Why are these free?</h2>
          <p className="mt-3 text-xs md:text-sm text-slate-500 leading-relaxed">
            We build tools for roofers. These calculators and generators are the same ones powering QuoteCore+ - our full quoting and job management platform. We give them away because they should be free. If you want the full system - AI Scan Assist, Smart Components, sending and tracking, orders, invoices, automated follow-ups - that is where QuoteCore+ comes in.
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
