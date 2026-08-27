import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import SmartToolFinder from './SmartToolFinder';
import TaskAccordions from './TaskAccordions';
import BrowseAllTools from './BrowseAllTools';
import DemoCTACard from "@/components/DemoCTACard";

export default function FreeToolsPage() {
  return (
    <FreeToolsAuthProvider>
      <main className="min-h-screen bg-white">
        <BlogHeader />

        {/* Hero — short, Tool Finder becomes the visual focus below */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.06),transparent_60%)]" />
          <div className="relative mx-auto max-w-3xl px-2 md:px-6 pt-10 md:pt-14 pb-1 text-center">
            <h1 className="text-xl md:text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Free Roofing &amp; Construction Tools</h1>
            <p className="mt-3 text-sm md:text-base text-slate-500 max-w-2xl mx-auto px-2">
              Measure roofs, calculate materials, build takeoffs, create quotes, invoices and purchase orders — all in one place, and free. What are you trying to solve? Tell us below and we&apos;ll take you straight to it.
            </p>
          </div>
        </section>

        {/* Smart Tool Finder */}
        <SmartToolFinder />

        {/* SEO/GEO answer block */}
        <section className="mx-auto max-w-3xl px-2 md:px-6 pb-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4 text-center">
            <h2 className="text-sm md:text-base font-semibold text-slate-900">What free tools does QuoteCore+ provide?</h2>
            <p className="mt-1.5 text-xs md:text-sm leading-relaxed text-slate-600">
              QuoteCore+ provides free online tools for roofing and construction, including digital roof takeoff, roofing calculators, material calculators, quote generators, invoice generators and purchase order tools. Most tools can be used without creating an account.
            </p>
          </div>
        </section>

        {/* Primary task-based accordions */}
        <TaskAccordions />

        {/* Interactive demo */}
        <section className="mx-auto max-w-3xl px-2 md:px-6 py-6 md:py-10">
          <div className="text-center mb-4">
            <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Want to see what the full system feels like?</h2>
            <p className="mt-1 text-xs md:text-sm text-slate-500">
              Try the actual QuoteCore+ takeoff workspace without creating an account.
            </p>
          </div>
          <DemoCTACard location="free_tools_hub" variant="inline" />
        </section>

        {/* Browse all free tools (search + filters + full crawlable directory) */}
        <BrowseAllTools />

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

        {/* Why free? — short */}
        <section className="mx-auto max-w-3xl px-2 md:px-6 py-10 md:py-14 text-center">
          <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Why are these tools free?</h2>
          <p className="mt-3 text-sm md:text-base font-medium text-slate-700">These free tools solve individual jobs. QuoteCore+ connects the whole workflow.</p>
          <p className="mt-2 text-xs md:text-sm text-[#BD4A1A] font-semibold tracking-wide">Measure → Price → Quote → Order → Invoice.</p>
          <p className="mt-3 text-xs md:text-sm text-slate-500 leading-relaxed">
            Use the free tools whenever you need them. If you want everything connected in one workspace, that is what QuoteCore+ is built for.
          </p>
          <Link href="/signup" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#E55A2B] hover:shadow-[0_0_16px_rgba(255,107,53,0.4)] min-h-[44px]">
            Explore QuoteCore+
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </Link>
        </section>

        {/* Done-For-You bridge */}
        <section className="mx-auto max-w-3xl px-2 md:px-6 pb-12 md:pb-16">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 text-center">
            <p className="text-sm font-semibold text-slate-900">Like the tools but don&apos;t want to set up a new system yourself?</p>
            <p className="mt-1.5 text-xs md:text-sm text-slate-500">
              We can rebuild the way you currently estimate and price work inside QuoteCore+ and show you how to use it.
            </p>
            <Link href="/done-for-you-setup" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#BD4A1A] transition-colors hover:text-[#FF6B35]">
              See Done-For-You Setup
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
          </div>
        </section>

        <SiteFooter />
      </main>
    </FreeToolsAuthProvider>
  );
}
