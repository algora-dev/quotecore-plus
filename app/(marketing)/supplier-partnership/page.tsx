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
    "Get your roofing products and pricing into the tools buyers use to price jobs. Free supplier partnership — no setup fee, no commission, no strings attached.",
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
          sizes="(max-width: 768px) 100vw, 33vw"
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
  "More enquiries sent to your business",
  "No obligation to upgrade",
];

const freeWays = [
  {
    number: "01",
    eyebrow: "QuoteCore+ App",
    heading: "Your products available while contractors quote",
    copy: "We add your supplier profile, products, pricing, and service areas to QuoteCore+ so contractors can find and use your materials while pricing real jobs.",
    bullets: [
      "Searchable by location and product type",
      "Products visible inside QuoteCore+ quoting workflows",
      "Control over what products and pricing are shown",
      "More enquiries sent to your business",
    ],
    exampleHref: "https://quote-core.com",
    exampleLabel: "View QuoteCore+",
  },
  {
    number: "02",
    eyebrow: "Supplier Landing Page",
    heading: "A dedicated supplier page for your business",
    copy: "You receive a dedicated page showing your business, products, service areas, and contact details, giving customers a simple place to learn about your offering and connect with you.",
    bullets: [
      "Business profile and contact details",
      "Products and services",
      "Service areas",
      "Links to your website and tools",
      "Supports search and AI discoverability",
    ],
    exampleHref: "https://quote-core.com/suppliers/rs-roofing",
    exampleLabel: "View live example",
  },
  {
    number: "03",
    eyebrow: "Free Roofing Calculator",
    heading: "A roofing calculator using your products and pricing",
    copy: "Customers can enter roof measurements, select products, and receive a preliminary estimate using your own base pricing. They can then send the full result directly to you as an enquiry from inside the tool.",
    bullets: [
      "Uses your products and pricing",
      "Calculates roof area, pitch, and key components",
      "Produces a preliminary estimate",
      "Sends the full enquiry directly to the supplier",
      "Unique link you can share or add to your website",
    ],
    exampleHref: "https://quote-core.com/free-roofing-takeoff-builder/rs-roofing",
    exampleLabel: "Try the calculator",
  },
];

const howItWorksSteps = [
  {
    number: "01",
    heading: "Apply or book a call",
    copy: "Fill out the supplier setup form, or book a short call if you want to talk it through first.",
  },
  {
    number: "02",
    heading: "Get approved and access your supplier dashboard",
    copy: "Once approved, you receive access to your supplier dashboard where you can manage your profile, products, pricing, and service areas.",
  },
  {
    number: "03",
    heading: "Set everything up and go live when ready",
    copy: "Create your profile, products, pricing, and service areas, then publish everything when you are happy.",
  },
];

const tailoredOptions = [
  "Branded calculators and website embeds",
  "Preliminary ordering workflows",
  "Supplier quoting systems and catalogue workflows",
  "Custom admin dashboards",
  "SEO and AI-search optimisation",
  "CRM and job-management integrations",
  "Usage reporting and demand analysis",
];



export default function SupplierPartnershipPage() {
  return (
    <>
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* 1. Hero */}
        <section className="relative overflow-hidden py-14 sm:py-16 lg:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,107,53,0.13),transparent_34%),radial-gradient(circle_at_88%_20%,rgba(15,23,42,0.06),transparent_28%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#BD4A1A]">
                <span className="h-2 w-2 rounded-full bg-[#FF6B35]" />
                Free supplier partnership
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
                Get your products and pricing into the tools buyers use to price roofing jobs, free.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
                We help roofing suppliers become easier to find, easier to quote, and easier to contact by connecting their products and pricing to the QuoteCore+ app, a dedicated supplier page, and a public roofing calculator they can share.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <SupplierCTA href="/contact" intent="free_setup" location="hero">
                  Start my free supplier setup <ArrowIcon />
                </SupplierCTA>
                <SupplierCTA href="#free-ways" intent="learn_more" location="hero" variant="secondary">
                  See what&apos;s included
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
                Video placeholder — final footage drops into this frame without layout changes.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Three Free Ways */}
        <section id="free-ways" className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                No strings attached
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Three free ways to get your products in front of buyers
              </h2>
              <p className="mt-5 text-lg leading-8 text-zinc-600">
                We build the useful foundation first. You keep control of your products, pricing, and customer relationships. No obligation to buy anything else.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {freeWays.map((way) => (
                <article
                  key={way.number}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition hover:border-orange-200 hover:shadow-[0_20px_65px_rgba(255,107,53,0.10)] sm:p-7"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-semibold text-[#BD4A1A]">{way.number}</span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {way.eyebrow}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {way.heading}
                      </h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {way.copy}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {way.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#BD4A1A]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={way.exampleHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
                  >
                    {way.exampleLabel} <ExternalLinkIcon />
                  </a>
                </article>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-orange-200 bg-orange-50/70 p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  You supply the catalogue and pricing - we help it get seen.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Send us your company details or book a short call. We will show you the proposed setup before anything goes live.
                </p>
              </div>
              <SupplierCTA href="/contact" intent="free_setup" location="free_offer" className="shrink-0">
                Start the free setup <ArrowIcon />
              </SupplierCTA>
            </div>
          </div>
        </section>

        {/* 3. How It Works */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                Simple process
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                How the free supplier setup works
              </h2>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {howItWorksSteps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {step.heading}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {step.copy}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-start gap-3 rounded-xl bg-slate-50 p-5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#BD4A1A]">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm leading-6 text-slate-600">
                We will provide educational documents, tutorials, and videos to help you get set up, and we can jump on a call if needed.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Why Is It Free */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
                Genuinely free
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Why are we offering this for free?
              </h2>
              <div className="mt-6 space-y-4 text-base leading-8 text-zinc-600">
                <p>
                  We&apos;re building a larger network of roofing suppliers, products, pricing, and service areas. Every supplier that joins makes QuoteCore+ more useful for contractors, homeowners, and anyone searching for roofing products or preliminary pricing. That helps the platform grow, while helping participating suppliers become easier to find, quote, and contact.
                </p>
                <p>
                  The free partnership is genuinely free. You remain in control of your products, pricing, service areas, and customer relationships. We only charge if you later choose additional branded, customised, or managed services.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Brand spacer */}
        <section className="py-12 lg:py-16">
          <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              QuoteCore+
            </p>
            <p className="mt-3 text-lg text-slate-500">
              Built for contractors, suppliers, and anyone who needs a useful roofing price.
            </p>
          </div>
        </section>

        {/* 6. Tailored Options */}
        <section className="bg-zinc-950 py-14 text-white lg:py-16">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                  Want something more tailored later?
                </p>
                <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                  The free integrations are the starting point, not the limit.
                </h2>
                <p className="mt-4 text-sm leading-7 text-zinc-400">
                  If you want something more custom later, we can help with that too. These options are completely optional and only relevant if you want to go further.
                </p>
                <div className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {tailoredOptions.map((option) => (
                    <li key={option} className="flex items-center gap-2 text-sm text-zinc-300 list-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B35]" />
                      {option}
                    </li>
                  ))}
                </div>
              </div>
              <SupplierCTA
                href="/contact"
                intent="custom_package"
                location="tailored_section"
                variant="darkSecondary"
                className="shrink-0"
              >
                Discuss a tailored setup <ArrowIcon />
              </SupplierCTA>
            </div>
          </div>
        </section>

        {/* 7. Final CTA */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to get your products in front of buyers?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-zinc-600">
              Apply for a supplier account or book a short call. Once approved, you will receive dashboard access and can set everything up when you are ready.
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
