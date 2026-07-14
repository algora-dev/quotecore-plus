import type { Metadata } from "next";
import Script from "next/script";
import ServicesHeader from "@/components/ServicesHeader";
import SiteFooter from "@/components/SiteFooter";
import { buildBreadcrumbSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Done-for-you roofing quote service | QuoteCore+",
  description:
    "Send QuoteCore+ your plans, scope, photos and pricing. We measure the job, build the quote, and you stay in control of final approval.",
};

const steps = [
  {
    title: "Send us the job",
    text: "Plans, scope, photos and your pricing.",
    icon: "document",
  },
  {
    title: "We measure",
    text: "We take the measurements from your plans.",
    icon: "target",
    image: "/how-it-works-measure-from-plan.png",
  },
  {
    title: "We build the quote",
    text: "We use your pricing, rates and structure in QuoteCore+.",
    icon: "quote",
  },
  {
    title: "You review",
    text: "You check everything before it goes to your customer.",
    icon: "check",
  },
  {
    title: "You send",
    text: "You approve and send the quote with confidence.",
    icon: "send",
  },
];

const perfectFor = [
  "Businesses with quotes piling up",
  "No dedicated estimator or admin",
  "Moving away from spreadsheets",
  "Want professional quotes without hiring staff",
  "Need quotes turned around quickly",
];

const controlItems = [
  "Your pricing, margins and supplier choices",
  "Inclusions, exclusions and terms",
  "Quote wording and presentation",
  "Final review and customer approval",
];

function StepIcon({ type }: { type: string }) {
  const shared = {
    className: "h-9 w-9",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (type === "target") {
    return (
      <svg viewBox="0 0 48 48" {...shared}>
        <circle cx="24" cy="24" r="10" />
        <circle cx="24" cy="24" r="4" />
        <path d="M24 6v6M24 36v6M6 24h6M36 24h6M34 10l3-3M11 37l3-3M14 10l-3-3M34 34l3 3" />
      </svg>
    );
  }

  if (type === "quote") {
    return (
      <svg viewBox="0 0 48 48" {...shared}>
        <path d="M13 7h16l8 8v26H13z" />
        <path d="M29 7v9h8" />
        <path d="M18 24h14M18 31h14M18 17h6" />
      </svg>
    );
  }

  if (type === "check") {
    return (
      <svg viewBox="0 0 48 48" {...shared}>
        <circle cx="24" cy="24" r="17" />
        <path d="M16 24.5l5.5 5.5L33 18" />
      </svg>
    );
  }

  if (type === "send") {
    return (
      <svg viewBox="0 0 48 48" {...shared}>
        <path d="M41 7L20 28" />
        <path d="M41 7L28 41l-8-13-13-8z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" {...shared}>
      <path d="M13 6h17l7 7v29H13z" />
      <path d="M30 6v8h7" />
      <path d="M19 21h12M19 28h12M19 35h8" />
    </svg>
  );
}

function CheckItem({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <li className={`flex items-start gap-3 ${light ? "text-zinc-700" : "text-white"}`}>
      <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-[#FF6B35] text-[#FF6B35]">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8.2l2.7 2.7 6-6" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <Script
        id="services-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbSchema([
            { name: "Home", url: `${siteUrl}/` },
            { name: "Services", url: `${siteUrl}/services` },
          ])),
        }}
      />
      <ServicesHeader />

      <section className="py-12 lg:py-16">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#FF6B35]">Services</p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                Your plans.
                <br />
                Our takeoff.
                <br />
                <span className="text-[#FF6B35]">Your quote.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                We take care of the measuring and quote build so you can focus on running your business and closing more jobs.
              </p>
              <p className="mt-4 max-w-xl rounded-2xl border border-[#FF6B35]/15 bg-[radial-gradient(circle_at_18%_20%,rgba(255,107,53,0.10),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.74)_0%,rgba(255,247,243,0.68)_48%,rgba(255,255,255,0.74)_100%)] px-5 py-4 text-base font-semibold leading-7 text-zinc-950 shadow-[0_18px_55px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl">
                Let us quote a job for you using QuoteCore+. If it&apos;s not better than your current system, get a free coffee on us!
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/contact"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(255,107,53,0.22)] transition-colors hover:bg-[#e85d2b] sm:w-44"
                >
                  Get in touch
                </a>
                <a
                  href="https://calendly.com/quote-core-info/15-minute-meeting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pill-shimmer inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-2.5 text-sm font-medium text-zinc-900 shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition-colors duration-200 hover:border-[#FF6B35]/40 sm:w-44"
                >
                  Book a 15-min call
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl shadow-[0_18px_55px_rgba(15,23,42,0.12)]">
              <img
                src="/services-hero.png"
                alt="QuoteCore+ digital takeoff on a laptop"
                className="aspect-[16/7] h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="mt-10 text-center">
            <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-950">How it works</h2>
          </div>

          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => (
              <div key={step.title} className="relative text-center">
                {index < steps.length - 1 ? (
                  <div className="absolute left-[calc(50%+56px)] top-10 hidden w-16 items-center justify-center text-zinc-300 lg:flex" aria-hidden="true">
                    <svg viewBox="0 0 48 16" className="h-4 w-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 8h40" />
                      <path d="M36 3l6 5-6 5" />
                    </svg>
                  </div>
                ) : null}
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF0EA] text-[#FF6B35]">
                  {step.image ? (
                    <img src={step.image} alt="" className="h-10 w-10 object-contain" aria-hidden="true" />
                  ) : (
                    <StepIcon type={step.icon} />
                  )}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-zinc-950">{step.title}</h3>
                <p className="mx-auto mt-3 max-w-[13rem] text-base leading-6 text-zinc-600">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl bg-zinc-950 p-8 text-white shadow-[0_18px_55px_rgba(15,23,42,0.18)] lg:p-10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em]">This service is perfect for</h2>
              <ul className="mt-6 space-y-4 text-base leading-6">
                {perfectFor.map((item) => (
                  <CheckItem key={item}>{item}</CheckItem>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-[linear-gradient(135deg,#fff_0%,#fff4ef_100%)] p-8 shadow-[0_18px_55px_rgba(255,107,53,0.08)] lg:p-10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-950">You stay in control</h2>
              <ul className="mt-6 space-y-4 text-base leading-6">
                {controlItems.map((item) => (
                  <CheckItem key={item} light>
                    {item}
                  </CheckItem>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#FF6B35]/25 bg-[linear-gradient(135deg,#fff_0%,#fff8f4_100%)] px-4 py-6 sm:p-6 lg:p-8">
            <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#FF6B35]/25 bg-white text-[#FF6B35]">
                <StepIcon type="send" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-zinc-950">Ready to get started?</h2>
                <p className="mt-2 max-w-xl text-base leading-7 text-zinc-600">
                  Send us your plans and we&apos;ll take care of the measuring and quote build.
                </p>
              </div>
              <div className="flex w-full flex-col gap-4 sm:flex-row lg:min-w-[430px] lg:w-auto">
                <a
                  href="/contact"
                  className="inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold leading-none text-white shadow-[0_14px_35px_rgba(255,107,53,0.22)] transition-colors hover:bg-[#e85d2b] sm:min-h-14 sm:px-8 sm:py-3 sm:text-base"
                >
                  Get in touch
                </a>
                <a
                  href="https://calendly.com/quote-core-info/15-minute-meeting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pill-shimmer inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-2.5 text-sm font-medium leading-none text-zinc-900 shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition-colors duration-200 hover:border-[#FF6B35]/40 sm:min-h-14 sm:px-8 sm:py-3"
                >
                  Book a 15-min call
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
