import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Smart Components: Reusable Quoting Components | QuoteCore+",
  description:
    "Smart Components are reusable quoting components that know their own measurements, waste allowances, and pricing rules. Build a roof quote in minutes, not hours.",
  alternates: {
    canonical: "https://quote-core.com/features/smart-components",
    languages: hreflangLanguages("/features/smart-components"),
  },
  openGraph: {
    title: "Smart Components: Reusable Quoting Components | QuoteCore+",
    description:
      "Reusable quoting components that know their own measurements, waste allowances, and pricing rules. Build a roof quote in minutes.",
    url: "https://quote-core.com/features/smart-components",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
    { "@type": "ListItem", position: 3, name: "Smart Components", item: `${SITE_URL}/features/smart-components` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What are Smart Components in QuoteCore+?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Smart Components are reusable quoting components that store their own measurements, waste allowances, and pricing rules. You create a component once, then drop it into any quote. The component automatically calculates its own quantities and price.",
      },
    },
    {
      "@type": "Question",
      name: "How do Smart Components save time?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Instead of re-entering the same material, waste, and pricing information for every quote, you set it up once in a Smart Component. When you add that component to a quote, the measurements and pricing are calculated automatically based on the roof dimensions you input.",
      },
    },
    {
      "@type": "Question",
      name: "Can I create my own Smart Components?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can create Smart Components for any material, assembly, or workflow you use regularly. You can also try the free Smart Component Creator tool on the QuoteCore+ website.",
      },
    },
  ],
};

const steps = [
  { num: 1, title: "Create a component", text: "Define a component with its material, unit, waste allowance, and pricing rule. For example: 'Metal roofing sheet' that covers 0.42m2 per sheet with 10% waste, priced at $25 per sheet." },
  { num: 2, title: "Set the pricing rule", text: "Pricing rules connect the component to a measurement. 'Per m2 of roof area', 'per linear metre of ridge', or 'per unit'. The component knows how to calculate itself." },
  { num: 3, title: "Drop it into a quote", text: "When building a quote, add the component to a roof section. The system measures the section, applies the component's rule, and calculates the quantity and price automatically." },
  { num: 4, title: "Quote repeats automatically", text: "Every future quote that uses the same component gets the same calculation. Update the component's price once, and every new quote uses the new price." },
];

const faqs = [
  { q: "What are Smart Components in QuoteCore+?", a: "Smart Components are reusable quoting components that store their own measurements, waste allowances, and pricing rules. You create a component once, then drop it into any quote. The component automatically calculates its own quantities and price." },
  { q: "How do Smart Components save time?", a: "Instead of re-entering the same material, waste, and pricing information for every quote, you set it up once in a Smart Component. When you add that component to a quote, the measurements and pricing are calculated automatically based on the roof dimensions you input." },
  { q: "Can I create my own Smart Components?", a: "Yes. You can create Smart Components for any material, assembly, or workflow you use regularly. You can also try the free Smart Component Creator tool on the QuoteCore+ website." },
];

export default function SmartComponentsPage() {
  return (
    <>
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
              Smart Components: build a roof quote in minutes.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Reusable quoting components that know their own measurements, waste allowances, and pricing rules. Create once, use forever. Every component calculates itself when you drop it into a quote.
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

        {/* What they are */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What are Smart Components?</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Smart Components are the core building blocks of a QuoteCore+ quote. A Smart Component stores three things: what material it is, how it is measured (per m2, per linear metre, per unit), and how it is priced. When you add a Smart Component to a roof section in a quote, it looks at the section&apos;s dimensions and calculates its own quantity and price automatically.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            For example, a &quot;metal roofing sheet&quot; component might know that it covers 0.42m2 per sheet, includes 10% waste, and costs $25 per sheet. When you add it to a 50m2 roof section, it calculates: 50 / 0.42 * 1.10 = 131 sheets, $3,275 total. No manual math.
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
            Any contractor who quotes the same types of jobs repeatedly. If you find yourself looking up the same material prices, applying the same waste factors, and doing the same calculations for every quote, Smart Components eliminate that repetition.
          </p>
        </section>

        {/* What it solves */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What problem it solves</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Repetitive calculations</h3>
              <p className="mt-2 text-sm text-zinc-600">Every roofer knows the formula for their materials. Smart Components store that formula so you never have to calculate it by hand again.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Inconsistent pricing</h3>
              <p className="mt-2 text-sm text-zinc-600">When prices change, update the component once. Every new quote uses the updated price. Old quotes keep their original pricing.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Quote-to-quote variation</h3>
              <p className="mt-2 text-sm text-zinc-600">Two quotes for the same job type should have the same structure. Smart Components ensure consistency across every quote your business sends.</p>
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
            <Link href="/features/digital-roof-takeoff" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Digital roof takeoff</h3>
              <p className="mt-1 text-sm text-zinc-600">Upload plans and measure digitally. Smart Components drop into the takeoff.</p>
            </Link>
            <Link href="/features/material-ordering" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Material ordering</h3>
              <p className="mt-1 text-sm text-zinc-600">Turn accepted quotes into material orders. Smart Components know what to order.</p>
            </Link>
            <Link href="/free-smart-component-creator" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Free Smart Component Creator</h3>
              <p className="mt-1 text-sm text-zinc-600">Try creating Smart Components for free, no signup required.</p>
            </Link>
            <Link href="/roofing-quoting-software" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Roofing quoting software</h3>
              <p className="mt-1 text-sm text-zinc-600">The full roofing quote workflow, from measurement to invoice.</p>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Start building Smart Components</h2>
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
