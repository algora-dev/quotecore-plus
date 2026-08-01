import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Digital Roof Takeoff Software | QuoteCore+",
  description:
    "Upload roof plans, measure digitally, and build a complete takeoff with sections, lengths, areas, and flashings. Digital roof takeoff software built by roofers, for roofers.",
  alternates: {
    canonical: "https://quote-core.com/features/digital-roof-takeoff",
    languages: hreflangLanguages("/features/digital-roof-takeoff"),
  },
  openGraph: {
    title: "Digital Roof Takeoff Software | QuoteCore+",
    description:
      "Upload roof plans, measure digitally, and build a complete roof takeoff. Built by roofers, for roofers.",
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
  description: "Digital roof takeoff software that lets roofing contractors upload plans, measure digitally, and build a complete takeoff with sections, lengths, areas, and flashings.",
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
      name: "Can I use QuoteCore+ takeoff without a digital plan?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can build a takeoff from site measurements, saved components, or a combination of both. Uploading a plan is optional, not required.",
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
  { num: 1, title: "Upload or start from scratch", text: "Upload a roof plan if you have one, or start with manual measurements from site. Both paths lead to the same takeoff builder." },
  { num: 2, title: "Measure roof sections", text: "Add roof sections with their type, dimensions, and pitch. The system calculates areas, waste allowances, and material quantities automatically." },
  { num: 3, title: "Add flashings and extras", text: "Include ridges, valleys, hips, eaves, flashings, and any custom components your job needs. Everything stays connected to the same takeoff." },
  { num: 4, title: "Send to quote builder", text: "Your takeoff flows directly into the quote builder. No copy-pasting numbers between tools." },
];

const faqs = [
  { q: "What is a digital roof takeoff?", a: "A digital roof takeoff is the process of measuring a roof from digital plans or drawings using software, instead of measuring manually on site or with paper plans. It calculates areas, lengths, and material quantities from the measurements you input." },
  { q: "Can I use QuoteCore+ takeoff without a digital plan?", a: "Yes. You can build a takeoff from site measurements, saved components, or a combination of both. Uploading a plan is optional, not required." },
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

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Feature</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Digital roof takeoff software built by roofers.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Upload a plan, measure digitally, and build a complete roof takeoff with sections, lengths, areas, flashings, and material quantities. No more paper plans and spreadsheet re-entry.
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

        {/* What it is */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What is digital roof takeoff?</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Digital roof takeoff is the process of measuring a roof using software instead of paper plans and a calculator. You input or upload measurements, and the software calculates areas, lengths, material quantities, and waste allowances automatically. The result is a complete takeoff that flows directly into a priced quote.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            In QuoteCore+, the takeoff builder is connected to the quote builder. When you finish measuring, your numbers are already in the quote. No copy-pasting, no re-entry, no transcription errors.
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
            It also works for construction estimators who need a fast, repeatable way to measure from plans without expensive estimating software.
          </p>
        </section>

        {/* What it solves */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What problem it solves</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Manual measurement re-entry</h3>
              <p className="mt-2 text-sm text-zinc-600">Measurements taken on site or from plans have to be re-entered into a quote. The takeoff builder eliminates that step by connecting measurement directly to pricing.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Disconnected tools</h3>
              <p className="mt-2 text-sm text-zinc-600">Using one tool for measurement, another for pricing, and a third for the quote document means numbers get lost in transit. QuoteCore+ keeps it all in one place.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No reusable measurements</h3>
              <p className="mt-2 text-sm text-zinc-600">When a similar job comes up, you should be able to reference previous measurements. The takeoff builder stores every job, searchable and reusable.</p>
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
              <h3 className="font-semibold text-slate-900">Smart Components</h3>
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
