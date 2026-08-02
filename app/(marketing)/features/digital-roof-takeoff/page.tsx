import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Digital Roof Takeoff Software | QuoteCore+",
  description:
    "Upload roof plans and measure digitally with AI Scan Assist or manual drawing. Pitch, waste, and material quantities auto-calculated. A faster, simpler alternative to expensive takeoff software.",
  alternates: {
    canonical: "https://quote-core.com/features/digital-roof-takeoff",
    languages: hreflangLanguages("/features/digital-roof-takeoff"),
  },
  openGraph: {
    title: "Digital Roof Takeoff Software | QuoteCore+",
    description:
      "Upload roof plans, measure digitally, and build a complete roof takeoff. AI Scan Assist or manual drawing. Auto-calculated pitch, waste, and quantities.",
    url: "https://quote-core.com/features/digital-roof-takeoff",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "QuoteCore+ Digital Roof Takeoff",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Digital takeoff",
  operatingSystem: "Web",
  description: "Digital roof takeoff software with AI Scan Assist and manual drawing tools. Upload plans, measure digitally, and auto-calculate pitch, waste, and material quantities.",
  url: `${SITE_URL}/features/digital-roof-takeoff`,
  publisher: { "@id": `${SITE_URL}/#organization` },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "14-day free trial, no credit card required" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
    { "@type": "ListItem", position: 3, name: "Digital Roof Takeoff", item: `${SITE_URL}/features/digital-roof-takeoff` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a digital roof takeoff?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A digital roof takeoff is the process of measuring a roof from digital plans or drawings using software, instead of measuring manually on site or with paper plans. It calculates areas, lengths, and material quantities from the measurements you input.",
      },
    },
    {
      "@type": "Question",
      name: "Does QuoteCore+ have AI takeoff scanning?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. AI Scan Assist can scan an uploaded roof plan and automatically identify individual roof areas, ridges, hips, valleys, and barges. You can review and adjust what it finds before generating the takeoff. You can also skip AI entirely and draw everything manually.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use QuoteCore+ takeoff without AI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The manual drawing tool lets you upload a plan and draw all areas, lines, and points yourself. You have full control over every measurement. AI Scan Assist is optional.",
      },
    },
    {
      "@type": "Question",
      name: "Does the takeoff calculate pitch automatically?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. When you draw a roof section, the pitch and pitch type are auto-calculated. Areas, waste allowances, and material quantities all update automatically based on the pitch. You draw what you see and the system handles the calculations.",
      },
    },
    {
      "@type": "Question",
      name: "What roof types does the takeoff support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The takeoff builder supports hips, valleys, ridges, eaves, flashings, and custom components. It works with metal, tile, shingle, and membrane roof types.",
      },
    },
  ],
};

const steps = [
  { num: 1, title: "Upload your plan", text: "Upload a roof plan, drawing, or image. Both AI Scan Assist and manual drawing start from the same uploaded plan. No plan? You can also start from scratch with site measurements." },
  { num: 2, title: "Draw or scan - your choice", text: "Use AI Scan Assist to automatically detect roof edges, ridges, valleys, and hips. Or switch to manual and draw every line yourself. Both paths give you the same result." },
  { num: 3, title: "Pitch and quantities auto-calculate", text: "When you draw a section, the pitch and pitch type are calculated automatically. Areas, waste allowances, and material quantities update in real time. You just draw what you see." },
  { num: 4, title: "Attach to components and send to quote", text: "Each measurement attaches to a Smart Component that already knows its pricing and waste rules. Your takeoff flows directly into the quote builder. No copy-pasting." },
];

const faqs = [
  { q: "What is a digital roof takeoff?", a: "A digital roof takeoff is the process of measuring a roof from digital plans or drawings using software, instead of measuring manually on site or with paper plans. It calculates areas, lengths, and material quantities from the measurements you input." },
  { q: "Does QuoteCore+ have AI takeoff scanning?", a: "Yes. AI Scan Assist can scan an uploaded roof plan and automatically identify individual roof areas, ridges, hips, valleys, and barges. You can review and adjust what it finds before generating the takeoff. You can also skip AI entirely and draw everything manually." },
  { q: "Can I use QuoteCore+ takeoff without AI?", a: "Yes. The manual drawing tool lets you upload a plan and draw all areas, lines, and points yourself. You have full control over every measurement. AI Scan Assist is optional." },
  { q: "Does the takeoff calculate pitch automatically?", a: "Yes. When you draw a roof section, the pitch and pitch type are auto-calculated. Areas, waste allowances, and material quantities all update automatically based on the pitch. You just draw what you see and the system handles the calculations." },
  { q: "What roof types does the takeoff support?", a: "The takeoff builder supports hips, valleys, ridges, eaves, flashings, and custom components. It works with metal, tile, shingle, and membrane roof types." },
];

export default function DigitalRoofTakeoffPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features", href: "/features" }, { label: "Digital Roof Takeoff" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Feature</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Digital roof takeoff that actually works.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Upload a plan, draw what you see, and let the system handle the rest. Pitch, waste, and material quantities auto-calculate. Use AI Scan Assist or draw manually - both paths lead to a complete, priced takeoff.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/free-trial" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]">
                Start free trial
              </a>
              <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">
                All features
              </Link>
            </div>
          </div>
        </section>

        {/* Screenshot showcase */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
              <div className="h-3 w-3 rounded-full bg-green-400/70" />
              <span className="ml-3 text-xs text-slate-500">QuoteCore+ - Digital Takeoff</span>
            </div>
            <img
              src="/images/features/digital-roof-takeoff.png"
              alt="QuoteCore+ digital roof takeoff showing color-coded measurement lines on a roof plan with component list"
              className="w-full"
              loading="lazy"
            />
          </div>
          {/* Feature callouts */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">AI Scan Assist</h3>
              <p className="mt-1 text-sm text-zinc-600">Upload a plan and let AI identify individual roof areas, ridges, hips, valleys, and barges automatically. Review and adjust before committing.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Manual drawing</h3>
              <p className="mt-1 text-sm text-zinc-600">Prefer full control? Draw every area, line, and point yourself. Add any component from your library - 30, 100, or more on a single roof.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Auto-calculated everything</h3>
              <p className="mt-1 text-sm text-zinc-600">Pitch, pitch type, areas, waste, and quantities all update automatically. Draw what you see - the system does the math.</p>
            </div>
          </div>
        </section>

        {/* Two ways to takeoff */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Two ways to take off a roof</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            QuoteCore+ gives you two paths to the same result. Both produce a complete, priced takeoff that flows straight into your quote.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#FF6B35]/10 px-3 py-1 text-xs font-semibold text-[#BD4A1A]">AI</span>
                <h3 className="text-lg font-semibold">AI Scan Assist</h3>
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                Upload a roof plan and let AI Scan Assist do the heavy lifting. It scans the plan, identifies individual roof areas, ridges, hips, valleys, and barges, and draws them for you. Review what it found, adjust anything that needs tweaking, and commit.
              </p>
              <p className="mt-3 text-sm text-zinc-600">
                Perfect for when you have a clear plan and want to save time on the initial drawing. AI Scan Assist covers the core roof components - you stay in control of the final measurements.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Manual</span>
                <h3 className="text-lg font-semibold">Manual drawing</h3>
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                Upload a plan and draw everything yourself. Trace roof areas, mark ridges, hips, valleys, and barges - but also add any custom components you have saved in your component library. You could add 30 different component types to a single roof, or hundreds if that's what the job needs. Full control over every line and measurement.
              </p>
              <p className="mt-3 text-sm text-zinc-600">
                Ideal when you want complete control, when the plan is unusual, or when you have specialised components that AI Scan Assist doesn't cover. Digital measure lets you fully customise your takeoff with your entire component library.
              </p>
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">A better alternative to expensive takeoff software</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Most digital takeoff tools are either too expensive, too complicated, or both. QuoteCore+ is built by roofers, for roofers. It does the measuring, the calculating, and the quoting in one connected flow - without the enterprise price tag.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            The takeoff builder is connected to the quote builder. When you finish measuring, your numbers are already in the quote. Pitch, waste allowances, material quantities, and pricing all calculate automatically. No copy-pasting, no re-entry, no transcription errors.
          </p>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-8 space-y-8">
            {steps.map((step) => (
              <div key={step.num} className="relative pl-12">
                <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6B35] text-xs font-bold text-white shadow-[0_0_0_4px_rgba(255,107,53,0.15)]">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 leading-7 text-zinc-600">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Who it's for */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Who it&apos;s for</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Roofing contractors who currently measure jobs with paper plans, a calculator, and a spreadsheet. If you&apos;re re-entering measurements from site notes into a separate quote document, the takeoff builder eliminates that step.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            Also for contractors paying too much for existing takeoff software that&apos;s hard to use or inaccurate. QuoteCore+ is a simpler, faster alternative that connects measuring to quoting in one tool.
          </p>
        </section>

        {/* What it solves */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What problem it solves</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Expensive, complicated software</h3>
              <p className="mt-2 text-sm text-zinc-600">Existing takeoff tools cost a fortune and need training to use. QuoteCore+ is built to be picked up in minutes, at a fraction of the cost.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Manual measurement re-entry</h3>
              <p className="mt-2 text-sm text-zinc-600">Measurements taken on site or from plans have to be re-entered into a quote. The takeoff builder eliminates that step by connecting measurement directly to pricing.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Disconnected tools</h3>
              <p className="mt-2 text-sm text-zinc-600">Using one tool for measurement, another for pricing, and a third for the quote document means numbers get lost in transit. QuoteCore+ keeps it all in one place.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="mt-6 space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">{faq.q}</h3>
                <p className="mt-2 text-sm text-zinc-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Related</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link href="/features/smart-components" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Smart Components™</h3>
              <p className="mt-1 text-sm text-zinc-600">Reusable quoting components that know their own pricing and waste rules.</p>
            </Link>
            <Link href="/roofing-quoting-software" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Roofing quoting software</h3>
              <p className="mt-1 text-sm text-zinc-600">The full roofing quote workflow, from measurement to invoice.</p>
            </Link>
            <Link href="/free-roofing-takeoff-builder" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Free roof takeoff builder</h3>
              <p className="mt-1 text-sm text-zinc-600">Try the takeoff builder for free, no signup required.</p>
            </Link>
            <Link href="/free-roofing-calculator" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Roofing calculator</h3>
              <p className="mt-1 text-sm text-zinc-600">Calculate roof areas, materials, and waste for any roof type.</p>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try the takeoff builder free</h2>
            <p className="mt-2 text-zinc-600">14 days, all features, no credit card required.</p>
            <a href="/free-trial" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]">
              Start free trial
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
