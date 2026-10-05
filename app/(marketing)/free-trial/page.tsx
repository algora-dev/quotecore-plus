import type { Metadata } from "next";
import Script from "next/script";
import FreeTrialClient from "./client";
import FreeTrialFaqPanel from "./FreeTrialFaqPanel";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import BlogHeader from "@/components/BlogHeader";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";
import { buildSoftwareApplicationSchema } from "@/lib/schema";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import DemoCTACard from "@/components/DemoCTACard";
import { pricingPlans } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Get Started with QuoteCore+ - Free Tools + Paid Plans",
  description: "Start with free roofing tools, no signup. Then choose a paid QuoteCore+ plan from $19/month with a 30-day money-back guarantee. Free trial no longer needed - free tools are forever.",
  alternates: {
    canonical: "https://quote-core.com/free-trial",
    languages: hreflangLanguages("/free-trial"),
  },
};

const faqs = [
  {
    question: "Do you offer a free trial?",
    answer: "We replaced the free trial with something better: permanent free tools and a money-back guarantee. Our free tools (takeoff builder, roofing calculator, quote generator and more) are free forever with no signup. For the full app, choose a paid plan - every plan is backed by a 30-day money-back guarantee, so you can try the full workflow with confidence.",
  },
  {
    question: "Do I need a credit card to use the free tools?",
    answer: "No. The free tools work instantly in your browser with no signup and no card. You only pay if you choose a paid app plan.",
  },
  {
    question: "How does the 30-day money-back guarantee work?",
    answer: "You pay up front for your chosen plan and get full access to every QuoteCore+ feature for 30 days. If it is not right for you, request a refund after day 30 via a short request and questionnaire and we will refund your payment.",
  },
  {
    question: "Can I send real quotes to real customers?",
    answer: "Yes. Quote, measure, and send to customers from day one on any paid plan.",
  },
  {
    question: "What if I need help?",
    answer: "You can chat to \"Q\" our smart assistant in the bottom right corner, check the <a href=\"/docs\" class=\"text-[#BD4A1A] underline underline-offset-2 hover:text-[#FF6B35]\">docs</a>, or <a href=\"https://quote-core.com/contact\" class=\"text-[#BD4A1A] underline underline-offset-2 hover:text-[#FF6B35]\">contact us here</a>.",
  },
  {
    question: "What is included in the paid app?",
    answer: "Paid plans include every QuoteCore+ feature: digital roof takeoff, AI Scan Assist, Smart Components, quote builder, sending and tracking with automated follow-ups, material ordering and invoicing. You can send real quotes, orders and invoices to real customers from day one - nothing is locked.",
  },
  {
    question: "How do I get started?",
    answer: "Two ways: dive into the <a href=\"/free-tools\" class=\"text-[#BD4A1A] underline underline-offset-2 hover:text-[#FF6B35]\">free tools</a> right now with no signup, or choose a plan and start in the app. Once you are in, \"Q\" can walk you through everything by chatting to you, or by showing you. Just go to the \"Resources\" page in the main navigation, then to the tutorials page to learn how everything works.",
  },
  {
    question: "Who is QuoteCore+ for?",
    answer: "QuoteCore+ is built for roofing contractors - roofers, roofing estimators and roofing business owners. It handles the pitches, angles and measurements roofing demands. It also works for construction and other measured trades. If your quoting process involves a spreadsheet, a notepad, and a Sunday evening, QuoteCore+ was built for you.",
  },
  {
    question: "What are Smart Components™?",
    answer: "Think of a Smart Component as one row or line on a spreadsheet - it holds all the information about a product or service (materials, labour, waste allowances, measurements, drawings, images and pricing rules), including the complex calculations. The difference is that QuoteCore+ does the calculating for you, so you need no spreadsheet knowledge at all. If you currently price with a spreadsheet, you can upload it and convert your rows into Smart Components in bulk, then reuse them in every future quote.",
  },
];

function TrialBenefitIcon({ type }: { type: "lock" | "calendar" | "pause" }) {
  if (type === "lock") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 11V8.5A5 5 0 0 1 16.6 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.5 11h11A1.5 1.5 0 0 1 19 12.5v6A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-6A1.5 1.5 0 0 1 6.5 11Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (type === "calendar") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4v3M17 4v3M5 9h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.5 6h11A1.5 1.5 0 0 1 19 7.5v10A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-10A1.5 1.5 0 0 1 6.5 6Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 13h4M12 11v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 7v10M15 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrialPreviewImages() {
  return (
    <div className="relative mx-auto flex min-h-[460px] w-full max-w-md items-center justify-center lg:min-h-[620px]">
      <div className="absolute inset-x-10 top-20 bottom-16 rounded-[44%] bg-[#FF6B35]/10 blur-[2px]" />

      <div className="relative z-10 w-[68%] -translate-y-8 -rotate-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.12)] transition duration-300 ease-out hover:-translate-y-10 hover:-rotate-2 hover:scale-[1.03] hover:shadow-[0_34px_90px_rgba(15,23,42,0.18)]">
        <img
          src="/free-trial-resource-lib.png"
          alt="QuoteCore+ resource library preview"
          className="h-auto w-full"
        />
      </div>

      <div className="absolute bottom-20 right-1 z-20 w-[86%] rotate-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] transition duration-300 ease-out hover:bottom-24 hover:rotate-0 hover:scale-[1.03] hover:shadow-[0_34px_90px_rgba(15,23,42,0.22)]">
        <img
          src="/free-trial-order-layout.png"
          alt="QuoteCore+ order layout preview"
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}

function planStyles(plan: (typeof pricingPlans)[number]): string {
  const premium = plan.name === "Pro Plus";
  if (plan.featured) {
    return "border-[#BD4A1A] bg-white shadow-[0_18px_50px_rgba(24,24,27,0.10)] hover:border-[#BD4A1A] hover:shadow-[0_26px_64px_rgba(189,74,26,0.22)]";
  }
  if (premium) {
    return "border-zinc-300 bg-gradient-to-b from-white to-zinc-50 shadow-[0_10px_36px_rgba(24,24,27,0.07)] hover:border-zinc-400 hover:shadow-[0_22px_54px_rgba(24,24,27,0.15)]";
  }
  return "border-zinc-200 bg-white hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_24px_rgba(255,107,53,0.12)]";
}

const dfyPackages = [
  {
    name: "Done-For-You Estimating Setup",
    price: "$499",
    tagline: "Best for smaller estimating setups or contractors with a focused range of products and services.",
    highlight: false,
    items: [
      "Up to 20 custom components built for you",
      "Your material pricing configured",
      "Labour and waste rules configured",
      "Personalised training",
      "6 months setup and product support",
      "6 months QuoteCore+ Pro included",
    ],
  },
  {
    name: "Complete Done-For-You Setup",
    price: "$999",
    tagline: "Best for larger or more detailed estimating systems.",
    highlight: true,
    items: [
      "Up to 60 custom components built for you",
      "Larger material and pricing setup",
      "More complex labour and waste configurations",
      "Help organising larger pricing lists or catalogues",
      "More detailed workflow configuration",
    ],
  },
];

export default function FreeTrialPage() {
  return (
    <>
      <Script
        id="free-trial-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(faqs)) }}
      />
      <Script
        id="free-trial-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbSchema([
            { name: "Home", url: `${siteUrl}/` },
            { name: "Get started", url: `${siteUrl}/free-trial` },
          ])),
        }}
      />
      <Script
        id="free-trial-software-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", ...buildSoftwareApplicationSchema() }) }}
      />
      <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader backLabel="Back to homepage" backHref="/" />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Get started" }]} />

        <section className="relative overflow-hidden bg-[linear-gradient(180deg,#fff_0%,#fff7f2_52%,#fff_100%)]">
          <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1fr_0.68fr] lg:px-8 lg:py-16 xl:grid-cols-[0.98fr_0.58fr_0.95fr] xl:gap-8">
            <div className="xl:pt-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FF6B35] shadow-sm">
                <span className="text-base leading-none">*</span>
                Free tools + paid plans
              </p>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Get started with QuoteCore+.
              </h1>

              <p className="mt-4 max-w-2xl text-xl font-semibold leading-snug text-zinc-700 sm:text-2xl">
                Free tools, forever. No signup.
                <br />
                Paid plans from $19/month.
              </p>

              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                Try the free tools right now, then start in the app with a 30-day money-back guarantee.
              </p>

              <div className="mt-10 max-w-xl space-y-6 text-zinc-600 hidden" aria-hidden="true">
                {/* SEO content - moved to FAQ section */}
              </div>

              <FreeTrialClient />

              <div className="mt-8 hidden max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:grid sm:grid-cols-3">
                {[
                  { title: "Free tools", text: "No signup, forever", icon: "lock" as const },
                  { title: "From $19/mo", text: "Choose your plan", icon: "calendar" as const },
                  { title: "30-day guarantee", text: "Money-back promise", icon: "pause" as const },
                ].map(({ title, text, icon }, index) => (
                  <div
                    key={title}
                    className={[
                      "flex flex-col items-center justify-start px-7 py-7 text-center",
                      index > 0 ? "border-l border-zinc-200" : "",
                    ].join(" ")}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/10 text-[#FF6B35]">
                      <TrialBenefitIcon type={icon} />
                    </span>
                    <span className="mt-4">
                      <span className="block whitespace-nowrap text-sm font-semibold text-zinc-950">{title}</span>
                      <span className="mt-1 block whitespace-nowrap text-sm text-zinc-500">{text}</span>
                    </span>
                  </div>
                ))}
              </div>

            </div>

            <div className="lg:order-3 lg:col-span-2 xl:order-none xl:col-span-1">
              <TrialPreviewImages />
            </div>

            <div className="xl:pt-8">
              <FreeTrialFaqPanel faqs={faqs} />
            </div>
          </div>
        </section>

        {/* Plans + done for you */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">Paid plans</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Pick the plan that fits.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
              From $19/month, every paid plan backed by the 30-day money-back guarantee.
            </p>
            <div className="mt-10 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={`relative flex h-full flex-col rounded-[2rem] border p-8 transition-all duration-300 hover:-translate-y-1 ${planStyles(plan)}`}
                >
                  {plan.featured && <span className="absolute -top-3 right-6 rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
                  <h3 className="text-xl font-semibold">{plan.displayName}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-6 text-zinc-600">{plan.subtitle}</p>
                  <div className="mt-6">
                    <div className="flex min-h-[92px] w-full flex-col justify-center rounded-xl border border-zinc-200/80 bg-white/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">USD</p>
                      <p className="mt-1 text-2xl font-semibold">{plan.usd}</p>
                      {!plan.isFree && !plan.contactUs && <p className="text-xs text-zinc-500">per month</p>}
                    </div>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm text-zinc-700">
                        <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#BD4A1A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={plan.contactUs ? "/contact" : "https://app.quote-core.com/signup?utm_source=get-started"} className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors ${plan.featured ? "bg-black text-white hover:bg-zinc-800" : "border border-zinc-300 text-zinc-900 hover:border-zinc-500"}`}>
                    {plan.contactUs ? "Contact us" : plan.isFree ? "Get started" : "Choose this plan"}
                  </a>
                </article>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-zinc-600">Monthly prices are shown in USD. Taxes are calculated at checkout where applicable.</p>

            <div className="mt-16 border-t border-zinc-200 pt-16">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">Done for you</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Rather have it set up for you?</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
                One-time packages where the QuoteCore+ team builds your components, pricing and workflow with you, so you start quoting from day one.
              </p>
              <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-2">
                {dfyPackages.map((pkg) => (
                  <article
                    key={pkg.name}
                    className={`relative flex h-full flex-col rounded-[2rem] border p-8 transition-all duration-300 hover:-translate-y-1 ${pkg.highlight ? "border-[#BD4A1A] bg-white shadow-[0_18px_50px_rgba(24,24,27,0.10)]" : "border-zinc-200 bg-white hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_24px_rgba(255,107,53,0.12)]"}`}
                  >
                    {pkg.highlight && <span className="absolute -top-3 right-6 rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white">Most complete</span>}
                    <h3 className="text-xl font-semibold">{pkg.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{pkg.tagline}</p>
                    <div className="mt-6">
                      <div className="flex min-h-[92px] w-full flex-col justify-center rounded-xl border border-zinc-200/80 bg-white/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">USD</p>
                        <p className="mt-1 text-2xl font-semibold">{pkg.price}</p>
                        <p className="text-xs text-zinc-500">one-time setup</p>
                      </div>
                    </div>
                    <ul className="mt-6 flex-1 space-y-3">
                      {pkg.items.map((item) => (
                        <li key={item} className="flex gap-3 text-sm text-zinc-700">
                          <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#BD4A1A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <a href="/done-for-you-setup" className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors ${pkg.highlight ? "bg-black text-white hover:bg-zinc-800" : "border border-zinc-300 text-zinc-900 hover:border-zinc-500"}`}>
                      See what is included
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Demo card */}
        <section className="mx-auto max-w-5xl px-6 pb-8 lg:px-8">
          <DemoCTACard location="free_trial_bottom" variant="inline" className="mx-auto max-w-2xl" />
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
