import type { Metadata } from "next";
import Image from "next/image";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import SupplierCTA from "./SupplierCTA";
import SupplierImageCarousel from "./SupplierImageCarousel";
import { VideoPlaceholder } from "./SupplierPartnershipVisuals";

export const metadata: Metadata = {
  title: "Supplier Partnership",
  description:
    "Put your roofing products into the tools contractors use to price jobs. Free supplier integrations - no setup fee, no commission, no strings attached.",
  alternates: { canonical: "https://quote-core.com/supplier-partnership" },
  openGraph: {
    title: "A free way to put your roofing products in front of buyers",
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

function ExternalLinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function ScreenshotFrame({
  src,
  alt,
  href,
  label,
}: {
  src: string;
  alt: string;
  href?: string;
  label?: string;
}) {
  const content = (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition hover:shadow-[0_12px_40px_rgba(255,107,53,0.12)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B35]" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
        </div>
        {label && (
          <span className="text-[10px] font-medium text-slate-400">{label}</span>
        )}
      </div>
      <div className="relative aspect-[16/10] w-full bg-slate-50">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition group-hover:scale-[1.02]"
        />
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }
  return content;
}

const trustPoints = [
  "No setup fee",
  "You control pricing",
  "Enquiries go directly to you",
  "No strings attached",
];

const customServices = [
  "Branded calculators and website embeds",
  "Supplier quoting systems and catalogue workflows",
  "Custom admin dashboards",
  "Usage reporting and demand analysis",
];

export default function SupplierPartnershipPage() {
  return (
    <>
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* Hero */}
        <section className="relative overflow-hidden py-14 sm:py-16 lg:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,107,53,0.13),transparent_34%),radial-gradient(circle_at_88%_20%,rgba(15,23,42,0.06),transparent_28%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#BD4A1A]">
                <span className="h-2 w-2 rounded-full bg-[#FF6B35]" />
                Free supplier partnership
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
                Get your products into the tools contractors use to price roofing jobs - free.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
                We turn your catalogue into usable pricing data inside QuoteCore+ and a public roofing tool. Contractors get a useful starting price. You get a better-qualified enquiry sent directly to your inbox.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <SupplierCTA href="/contact" intent="free_setup" location="hero">
                  Start my free supplier setup <ArrowIcon />
                </SupplierCTA>
                <SupplierCTA href="#free-integrations" intent="learn_more" location="hero" variant="secondary">
                  See what's included
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
                description="This placeholder is ready for your short video explaining the offer and what the supplier receives."
                duration="45-60 sec"
              />
              <p className="mt-3 text-center text-xs text-slate-600">
                Video placeholder - final footage drops into this frame without layout changes.
              </p>
            </div>
          </div>
        </section>

        {/* Two free integrations */}
        <section id="free-integrations" className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                No strings attached
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Two free integrations. Both yours to keep.
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-600">
                We build the useful foundation first. You keep control of your products, pricing and customer relationships. No obligation to buy anything else.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {/* Integration 01: Inside QuoteCore+ */}
              <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition hover:border-orange-200 hover:shadow-[0_20px_65px_rgba(255,107,53,0.10)] sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="text-sm font-semibold text-[#BD4A1A]">01</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      Inside QuoteCore+
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">
                      Your products available while contractors quote
                    </h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  We add your supplier profile, catalogue and component library to QuoteCore+ so contractors can find and specify your materials while they build a job price.
                </p>
                <ul className="mt-5 space-y-2.5">
                  <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#BD4A1A]" />
                    Partner supplier profile inside QuoteCore+
                  </li>
                  <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#BD4A1A]" />
                    Your products applied to real roof measurements
                  </li>
                  <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#BD4A1A]" />
                    Control over what products and pricing are visible
                  </li>
                </ul>

                <div className="mt-6">
                  <SupplierImageCarousel />
                </div>
              </article>

              {/* Integration 02: Public customer tool */}
              <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition hover:border-orange-200 hover:shadow-[0_20px_65px_rgba(255,107,53,0.10)] sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="text-sm font-semibold text-[#BD4A1A]">02</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      Public customer tool
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">
                      Contractors get a real price, you get a qualified enquiry
                    </h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  The same supplier data powers a public roofing takeoff tool. Contractors measure, see a preliminary total using your products, and send the enquiry directly to you.
                </p>
                <ul className="mt-5 space-y-2.5">
                  <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#BD4A1A]" />
                    A supplier-specific pricing experience on quote-core.com
                  </li>
                  <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#BD4A1A]" />
                    Enquiries delivered straight to your inbox with takeoff attached
                  </li>
                  <li className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#BD4A1A]" />
                    No middleman - the customer contacts your business directly
                  </li>
                </ul>
                <a
                  href="https://quote-core.com/free-roofing-takeoff-builder"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#BD4A1A] hover:text-[#9E3E16]"
                >
                  Try the live tool <ExternalLinkIcon />
                </a>

                <div className="mt-6">
                  <ScreenshotFrame
                    src="/images/supplier-partnership/takeoff-builder.jpg"
                    alt="Free roofing takeoff builder showing roof area input with supplier pricing applied"
                    label="quote-core.com/free-roofing-takeoff-builder"
                    href="https://quote-core.com/free-roofing-takeoff-builder"
                  />
                </div>
              </article>
            </div>

            <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-orange-200 bg-orange-50/70 p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  You supply the catalogue. We build the rest.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Send us your catalogue or book a short call. We will show you the proposed setup before anything goes live.
                </p>
              </div>
              <SupplierCTA href="/contact" intent="free_setup" location="free_offer" className="shrink-0">
                Start the free setup <ArrowIcon />
              </SupplierCTA>
            </div>
          </div>
        </section>

        {/* Brief custom services mention */}
        <section className="bg-zinc-950 py-14 text-white lg:py-16">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                  Want to go further later?
                </p>
                <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                  The free integrations are the starting point, not the limit.
                </h2>
                <p className="mt-4 text-sm leading-7 text-zinc-400">
                  We also build fully tailored packages around your brand, sales process and growth goals - only when there is a clear fit. No pressure, no obligation.
                </p>
                <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                  {customServices.map((service) => (
                    <li key={service} className="flex items-center gap-2 text-sm text-zinc-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B35]" />
                      {service}
                    </li>
                  ))}
                </ul>
              </div>
              <SupplierCTA
                href="/contact"
                intent="custom_package"
                location="custom_mention"
                variant="darkSecondary"
                className="shrink-0"
              >
                Ask about custom packages <ArrowIcon />
              </SupplierCTA>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to get your products in front of buyers?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-zinc-600">
              Send us your company details and catalogue, or book a short call. We will show you the proposed free setup before anything goes live.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <SupplierCTA href="/contact" intent="free_setup" location="final_cta">
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
                variant="secondary"
              >
                Email info@quote-core.com
              </SupplierCTA>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              No obligation. No pressure to replace your current process.
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
