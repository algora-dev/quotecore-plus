import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "About QuoteCore+ | Construction Quoting Software Built From the Industry",
  description: "QuoteCore+ was built by an ex-roofer who spent 12 years quoting jobs the hard way. Meet Shaun and the story behind the software.",
  alternates: { canonical: "https://quote-core.com/about", languages: hreflangLanguages("/about") },
  openGraph: {
    title: "About QuoteCore+ | Construction Quoting Software Built From the Industry",
    description: "QuoteCore+ was built by an ex-roofer who spent 12 years quoting jobs the hard way.",
    url: "https://quote-core.com/about",
    siteName: "QuoteCore+",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <>
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">About QuoteCore+</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              He spent 12 years quoting roofs the hard way. Then he built QuoteCore+.
            </h1>
          </div>
        </section>

        {/* Story */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">

          {/* Founder card */}
          <div className="flex items-center gap-6 rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
            <img src="/shaun.jpg" alt="" className="h-20 w-20 rounded-full object-cover border-2 border-[#FF6B35]/20" />
            <div>
              <p className="text-xl font-semibold">Shaun</p>
              <p className="text-sm text-zinc-500">Founder, QuoteCore+</p>
              <p className="mt-1 text-sm font-medium text-[#FF6B35]">12 years on the tools</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-12">

            {/* Stop 1 */}
            <div className="relative pl-12">
              <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6B35] text-xs font-bold text-white shadow-[0_0_0_4px_rgba(255,107,53,0.15)]">1</div>
              <div className="absolute bottom-0 left-4 top-9 w-px bg-zinc-200" />
              <div className="pb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">Age 21 - 33</p>
                <h3 className="mt-2 text-xl font-semibold">12 years on the roof</h3>
                <div className="mt-4 space-y-4 leading-8 text-zinc-600">
                  <p>For twelve years, he was on the tools. Multiple quotes a day, some days. Each one the same process: measure on site, bring the numbers home, work out the pricing, write it up, file it, send it. Then hope the client hadn't already gone with someone else.</p>
                  <p>He shared the workload with another man who had his own system. Which meant two systems. Which meant no system.</p>
                  <p>The paper files were a nightmare. Jobs stacked in folders. Old quotes mixed with new ones. Trying to find a previous job's measurements when a similar roof came up - ten minutes of searching through paper instead of ten seconds on a screen.</p>
                  <p className="font-medium text-zinc-800">He knew there had to be a better way. He just couldn't find it.</p>
                </div>
              </div>
            </div>

            {/* Stop 2 */}
            <div className="relative pl-12">
              <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6B35] text-xs font-bold text-white shadow-[0_0_0_4px_rgba(255,107,53,0.15)]">2</div>
              <div className="absolute bottom-0 left-4 top-9 w-px bg-zinc-200" />
              <div className="pb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">The gap in the market</p>
                <h3 className="mt-2 text-xl font-semibold">The software that didn't exist</h3>
                <div className="mt-4 space-y-4 leading-8 text-zinc-600">
                  <p>The tools available were either generic - built for "trades" and completely misunderstanding how a roofer actually prices a job - or so complex they needed a trained estimator to operate them.</p>
                  <p>Nothing was built for the working roofer. He wanted something that understood roofing. That knew the difference between a hip and a valley. That could take his measurements and turn them into a professional client-ready quote without him spending two hours reformatting a Word document.</p>
                  <p className="font-medium text-zinc-800">That software didn't exist. So he built it.</p>
                </div>
              </div>
            </div>

            {/* Stop 3 */}
            <div className="relative pl-12">
              <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6B35] text-xs font-bold text-white shadow-[0_0_0_4px_rgba(255,107,53,0.15)]">3</div>
              <div className="pb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">Why it matters</p>
                <h3 className="mt-2 text-xl font-semibold">Built from the inside out</h3>
                <div className="mt-4 space-y-4 leading-8 text-zinc-600">
                  <p>QuoteCore+ isn't built by developers who interviewed a few roofers. It's built by someone who lived the problem for over a decade. Every feature exists because someone who spent twelve years roofing decided it should.</p>
                  <p>Before launch, it was tested and refined by working roofers across the industry - contractors who quoted real jobs through the platform and gave honest feedback on what wasn't good enough. Every iteration shaped by people who actually use it on the job.</p>
                  <p className="font-medium text-zinc-800">The result is a quoting tool that thinks the way a roofer thinks - because it was built by one.</p>
                  <p className="mt-4 text-zinc-600">QuoteCore+ started in roofing because that was the problem Shaun knew first-hand. But the same chaos - manual measuring, copied numbers, reformatted spreadsheets, quotes sent too late - exists across construction. Today QuoteCore+ is used by trades businesses of all kinds: roofing, cladding, flooring, fencing, landscaping, general building, exterior works, and more.</p>
                </div>
              </div>
            </div>

          </div>

          {/* CTA */}
          <div className="mt-10 rounded-[2rem] border border-[#FF6B35]/20 bg-[#FF6B35]/5 p-8 text-center">
            <p className="text-xl font-semibold text-zinc-950">See it for yourself.</p>
            <p className="mt-2 text-zinc-500">Two weeks free. No card required. Start quoting in minutes.</p>
            <a
              href="/free-trial"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF6B35] px-10 py-3 text-base font-semibold text-white transition-colors hover:bg-[#E55A28]"
            >
              Start your free trial
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
