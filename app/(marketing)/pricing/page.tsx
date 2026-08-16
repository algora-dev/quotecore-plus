import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteFooter from "@/components/SiteFooter";
import { pricingPlans } from "@/lib/pricing";
import { buildBreadcrumbSchema, buildFaqSchema, buildPricingOffers } from "@/lib/schema";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "QuoteCore+ Pricing | Roofing & Construction Software Plans",
  description:
    "Compare QuoteCore+ plans from free to premium. 14-day full-feature trial, no credit card required. Takeoff, Smart Components, invoicing, and material ordering included.",
  alternates: {
    canonical: "https://quote-core.com/pricing",
    languages: hreflangLanguages("/pricing"),
  },
  openGraph: {
    title: "QuoteCore+ Pricing | Roofing & Construction Software Plans",
    description: "Compare QuoteCore+ plans from free to premium. 14-day full-feature trial, no credit card required.",
    url: "https://quote-core.com/pricing",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://quote-core.com/#software",
  name: "QuoteCore+",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://quote-core.com/pricing",
  offers: [buildPricingOffers("USD")],
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: "https://quote-core.com" },
  { name: "Pricing", url: "https://quote-core.com/pricing" },
]);

const faqs = [
  {
    question: "How long is the free trial?",
    answer: "The Full trial runs for 14 days and unlocks all features within the trial limits shown on this page. You get 20 AI Scan Assist points to try AI roof plan scanning.",
  },
  {
    question: "Is a credit card required for the trial?",
    answer: "No. QuoteCore+ does not require a credit card to start the 14-day trial.",
  },
  {
    question: "What happens after the trial?",
    answer: "The account moves to the Lite free plan unless you choose to upgrade to a paid plan.",
  },
  {
    question: "Which currencies are shown?",
    answer: "This global pricing page shows current monthly prices in US dollars. Taxes are calculated where applicable.",
  },
];

const faqSchema = buildFaqSchema(faqs);

// Card styling per tier — richer treatment on higher tiers draws the eye up-range
function planStyles(plan: (typeof pricingPlans)[number]): string {
  const premium = plan.name === "Pro Plus" || plan.name === "Premium";
  if (plan.featured) {
    return "border-[#BD4A1A] bg-white shadow-[0_18px_50px_rgba(24,24,27,0.10)] hover:border-[#BD4A1A] hover:shadow-[0_26px_64px_rgba(189,74,26,0.22)]";
  }
  if (premium) {
    return "border-zinc-300 bg-gradient-to-b from-white to-zinc-50 shadow-[0_10px_36px_rgba(24,24,27,0.07)] hover:border-zinc-400 hover:shadow-[0_22px_54px_rgba(24,24,27,0.15)]";
  }
  return "border-zinc-200 bg-white hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_24px_rgba(255,107,53,0.12)]";
}

export default function PricingPage() {
  return (
    <>
      <Script id="pricing-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }} />
      <Script id="pricing-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script id="pricing-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <BlogHeader />
      <main className="bg-white text-zinc-950">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Pricing" }]} />
        <section className="mx-auto max-w-7xl px-6 pb-14 pt-12 text-center lg:px-8 lg:pb-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">Simple monthly plans</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            QuoteCore+ pricing for every stage of a roofing business.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-600">
            Start with the complete product for 14 days, no card required. Compare each plan by its real quote, storage and AI Scan Assist limits before you choose.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/free-trial" className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]">
              Start free trial
            </Link>
            <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 px-7 text-sm font-semibold text-zinc-900 transition-colors hover:border-zinc-500">
              Compare features
            </Link>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-zinc-50 py-16">
          <div className="mx-auto grid max-w-7xl items-stretch gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3 lg:px-8">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex h-full flex-col rounded-[2rem] border p-8 transition-all duration-300 hover:-translate-y-1 ${planStyles(plan)}`}
              >
                {plan.featured && <span className="absolute right-6 top-6 rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
                <h2 className="text-xl font-semibold">{plan.displayName}</h2>
                <p className="mt-2 min-h-10 text-sm leading-6 text-zinc-600">{plan.subtitle}</p>
                <div className="mt-6">
                  <div className="flex min-h-[92px] w-full flex-col justify-center rounded-xl border border-zinc-200/80 bg-white/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">USD</p>
                    <p className="mt-1 text-2xl font-semibold">{plan.usd}</p>
                    {!plan.isFree && !plan.contactUs && <p className="text-xs text-zinc-500">per month</p>}
                  </div>
                </div>
                {plan.originalUsd && (
                  <p className="mt-3 text-xs text-zinc-500">Regular monthly price: <s>{plan.originalUsd} USD</s></p>
                )}
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-zinc-700">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#BD4A1A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={plan.contactUs ? "/contact" : "/free-trial"} className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors ${plan.featured ? "bg-black text-white hover:bg-zinc-800" : "border border-zinc-300 text-zinc-900 hover:border-zinc-500"}`}>
                  {plan.contactUs ? "Contact us" : plan.isFree ? "Start free trial" : "Try this plan"}
                </Link>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl px-6 text-center text-sm text-zinc-600">Monthly prices are shown in USD. Taxes are calculated at checkout where applicable.</p>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">Pricing questions</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Know what happens before you start.</h2>
          </div>
          <div className="mt-10 divide-y divide-zinc-200 border-y border-zinc-200">
            {faqs.map((faq) => (
              <div key={faq.question} className="py-6">
                <h3 className="font-semibold text-zinc-950">{faq.question}</h3>
                <p className="mt-2 leading-7 text-zinc-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Related</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a href="/roofsnap-alternative" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">RoofSnap alternative</p>
              <p className="mt-1 text-sm text-zinc-600">How our pricing and workflow compare.</p>
            </a>
            <a href="/eagleview-alternative" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">EagleView alternative</p>
              <p className="mt-1 text-sm text-zinc-600">Per-report costs vs a flat subscription.</p>
            </a>
            <a href="/planswift-alternative" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">PlanSwift alternative</p>
              <p className="mt-1 text-sm text-zinc-600">US$2,000/seat/yr vs plans from free.</p>
            </a>
            <a href="/features" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Features</p>
              <p className="mt-1 text-sm text-zinc-600">See what is included in each plan.</p>
            </a>
            <a href="/trust" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Trust and security</p>
              <p className="mt-1 text-sm text-zinc-600">Trial terms, cancellation, data ownership.</p>
            </a>
            <a href="/free-tools" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Free tools</p>
              <p className="mt-1 text-sm text-zinc-600">Calculators and generators, no signup required.</p>
            </a>
            <a href="/roofing-quoting-software" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Roofing quoting software</p>
              <p className="mt-1 text-sm text-zinc-600">The full roofing workflow.</p>
            </a>
            <a href="/construction-quoting-software" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Construction quoting software</p>
              <p className="mt-1 text-sm text-zinc-600">The full construction workflow.</p>
            </a>
            <a href="/contact" className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <p className="font-semibold text-zinc-950">Contact us</p>
              <p className="mt-1 text-sm text-zinc-600">Questions about plans or pricing.</p>
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
