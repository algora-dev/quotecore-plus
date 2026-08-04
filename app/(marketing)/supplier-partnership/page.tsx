import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import FAQAccordion from "./FAQAccordion";
import SupplierCTA from "./SupplierCTA";
import SupplierJourney from "./SupplierJourney";
import {
  CatalogueOutcomeVisual,
  DashboardVisual,
  ScreenshotVisual,
  VideoPlaceholder,
} from "./SupplierPartnershipVisuals";
import {
  customerExperienceSteps,
  customServices,
  enquiryFlowSteps,
  freeOfferings,
  supplierBenefits,
  trustPoints,
} from "./content";

export const metadata: Metadata = {
  title: "Supplier Partnership | QuoteCore+",
  description:
    "Put your roofing products into the tools contractors use to price jobs. Start with free supplier integrations, then explore custom branded and growth services.",
  alternates: { canonical: "https://quote-core.com/supplier-partnership" },
  openGraph: {
    title: "A free way to put your roofing products in front of buyers | QuoteCore+",
    description:
      "Give contractors a useful preliminary price using your products, capture better-qualified enquiries and keep the customer relationship.",
    url: "https://quote-core.com/supplier-partnership",
    siteName: "QuoteCore+",
    type: "website",
  },
};

function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export default function SupplierPartnershipPage() {
  return (
    <>
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* Hero */}
        <section className="relative overflow-hidden py-14 sm:py-16 lg:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,107,53,0.13),transparent_34%),radial-gradient(circle_at_88%_20%,rgba(15,23,42,0.06),transparent_28%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#BD4A1A]">
                <span className="h-2 w-2 rounded-full bg-[#FF6B35]" />
                Free supplier partnership
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[3.55rem] lg:leading-[1.05]">
                Get your products into the tools contractors use to price roofing jobs - free.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
                We help turn your catalogue into usable product and pricing data inside QuoteCore+ and a public roofing pricing tool. Contractors get a useful starting price. You get a better-informed enquiry sent directly to your business.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <SupplierCTA href="/contact" intent="free_setup" location="hero">
                  Start my free supplier setup <ArrowIcon />
                </SupplierCTA>
                <SupplierCTA href="#how-it-works" intent="learn_more" location="hero" variant="secondary">
                  See how it works
                </SupplierCTA>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {trustPoints.map((point) => (
                  <div key={point} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-[#BD4A1A]">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    {point}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <VideoPlaceholder
                eyebrow="Short overview video"
                title="The free supplier opportunity in under a minute"
                description="This placeholder is ready for the short video explaining the offer, the customer journey and what the supplier receives."
                duration="45-60 sec"
              />
              <p className="mt-3 text-center text-xs text-slate-600">
                Video placeholder - final footage can drop into this frame without changing the layout.
              </p>
            </div>
          </div>
        </section>

        {/* Free Offerings - with real screenshots */}
        <section id="free-partnership" className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                Start here - no strings attached
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Two free ways to put your products in front of buyers
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-600">
                We build the useful foundation first. You keep control of your products, pricing and customer relationships, and there is no obligation to buy anything else.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {freeOfferings.map((offering) => (
                <article
                  key={offering.number}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition hover:border-orange-200 hover:shadow-[0_20px_65px_rgba(255,107,53,0.10)] sm:p-7"
                >
                  <ScreenshotVisual
                    src={offering.screenshot}
                    alt={offering.screenshotAlt}
                  />
                  <div className="mt-7 flex items-start gap-4">
                    <span className="text-sm font-semibold text-[#BD4A1A]">{offering.number}</span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {offering.eyebrow}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">{offering.title}</h3>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-slate-600">{offering.description}</p>
                  <ul className="mt-6 space-y-3">
                    {offering.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#BD4A1A]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-orange-200 bg-orange-50/70 p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  You supply the catalogue. We help build the first experience.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Start with a conversation or send us the basics by email. We will show you what the free setup could look like before anything goes live.
                </p>
              </div>
              <SupplierCTA href="/contact" intent="free_setup" location="free_offer" className="shrink-0">
                Start the free setup <ArrowIcon />
              </SupplierCTA>
            </div>
          </div>
        </section>

        {/* Custom services teaser */}
        <section className="bg-zinc-950 py-10 text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                Want to go further later?
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                The free integrations are the starting point, not the limit.
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                We also build branded calculators, website integrations, supplier quoting systems, catalogue workflows and growth packages - only when there is a clear fit for your business. Read on to see the full picture, or jump to custom services.
              </p>
            </div>
            <SupplierCTA
              href="#custom-services"
              intent="custom_package"
              location="early_custom_teaser"
              variant="darkSecondary"
              className="shrink-0"
            >
              Preview custom options <ArrowIcon />
            </SupplierCTA>
          </div>
        </section>

        {/* The problem we solve */}
        <section id="supplier-problem" className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                The problem we solve
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                The enquiry is not the problem. The dead time around it is.
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-600">
                Early pricing questions can consume real staff time before you know whether the customer is serious. The goal is not to remove your sales team - it is to let the tool do the repetitive preparation so your team enters the conversation at the useful part.
              </p>
            </div>
            <SupplierJourney />
          </div>
        </section>

        {/* How it works - enquiry flow with real screenshots */}
        <section id="how-it-works" className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                The customer experience
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                From rough question to qualified enquiry in four steps
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-600">
                This is what a contractor actually sees when they use the tool with your products. Every step below is a real screenshot - not a mockup.
              </p>
            </div>

            {/* Alternating screenshot rows */}
            <div className="mt-14 space-y-16 lg:space-y-24">
              {enquiryFlowSteps.map((step, index) => {
                const isReversed = index % 2 === 1;
                return (
                  <div
                    key={step.title}
                    className={`grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16 ${
                      isReversed ? "lg:[&>*:first-child]:order-2" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          0{index + 1}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#BD4A1A]">
                          Step {index + 1}
                        </span>
                      </div>
                      <h3 className="mt-5 text-xl font-semibold text-slate-900 sm:text-2xl">
                        {step.title}
                      </h3>
                      <p className="mt-4 text-base leading-7 text-slate-600">{step.description}</p>
                    </div>
                    <div>
                      <ScreenshotVisual
                        src={step.screenshot}
                        alt={step.screenshotAlt}
                        dark={index === 3}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick summary of the customer journey */}
            <div className="mt-16 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                The short version
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {customerExperienceSteps.map(([title, description], index) => (
                  <div key={title} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <CatalogueOutcomeVisual />
              </div>
            </div>
          </div>
        </section>

        {/* Supplier benefits */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                What changes for the supplier
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                A better first interaction creates benefits across the whole sale
              </h2>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {supplierBenefits.map(([title, description], index) => (
                <article
                  key={title}
                  className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-sm font-semibold text-[#BD4A1A]">
                    0{index + 1}
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Custom services */}
        <section id="custom-services" className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                  When you want to go further
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Build a custom growth layer around what works
                </h2>
                <p className="mt-5 text-lg leading-8 text-zinc-600">
                  The free partnership gives us a practical starting point. If it suits your business, we can then scope a package around your brand, sales process and growth priorities.
                </p>
              </div>
              <SupplierCTA
                href="/contact"
                intent="custom_package"
                location="custom_services"
                variant="accent"
                className="shrink-0"
              >
                Discuss a custom package <ArrowIcon />
              </SupplierCTA>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {customServices.map((service) => (
                <article
                  key={service.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-orange-200 hover:shadow-[0_18px_50px_rgba(255,107,53,0.08)]"
                >
                  <span className="text-sm font-semibold text-[#BD4A1A]">{service.number}</span>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">{service.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{service.description}</p>
                  <ul className="mt-6 space-y-3">
                    {service.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckIcon className="h-4 w-4 shrink-0 text-[#BD4A1A]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:items-center">
              <VideoPlaceholder
                eyebrow="Full supplier walkthrough"
                title="See the wider platform and service possibilities"
                description="This frame is ready for the longer video covering branded tools, website integration, reporting and custom supplier systems."
                duration="4-6 min"
                compact
              />
              <div>
                <DashboardVisual />
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">
                    Reporting belongs to the optional growth layer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This example makes the distinction clear: the free integrations create value and enquiries; custom reporting can then reveal demand patterns, product interest and conversion opportunities. Figures shown are illustrative only.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                Questions suppliers usually ask
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Straight answers before we start
              </h2>
              <p className="mt-5 text-base leading-7 text-zinc-600">
                The free offer should feel simple because it is simple. These are the practical points most suppliers want confirmed before opening a conversation.
              </p>
            </div>
            <FAQAccordion />
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden bg-zinc-950 py-16 text-white lg:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,107,53,0.20),transparent_38%)]" />
          <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
              The next step is deliberately easy
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Start free, or talk through the bigger opportunity.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
              Send us your company details and catalogue, book a short call, or email us directly. We will show you the proposed free setup and only discuss custom work if it is genuinely useful.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <SupplierCTA href="/contact" intent="free_setup" location="final_cta" variant="light">
                Start my free supplier setup <ArrowIcon />
              </SupplierCTA>
              <SupplierCTA
                href="https://calendly.com/quote-core-info/15-minute-meeting"
                intent="book_call"
                location="final_cta"
                variant="accent"
              >
                Book a 15-minute call
              </SupplierCTA>
              <SupplierCTA
                href="mailto:info@quote-core.com?subject=Supplier%20partnership"
                intent="email"
                location="final_cta"
                variant="darkSecondary"
              >
                Email info@quote-core.com
              </SupplierCTA>
            </div>
            <p className="mt-6 text-sm text-zinc-500">
              No obligation. No pressure to replace your current process.
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
