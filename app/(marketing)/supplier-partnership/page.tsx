import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import FAQAccordion from "./FAQAccordion";

export const metadata: Metadata = {
  title: "Supplier Partnership - Give Customers Useful Roofing Prices Instantly | QuoteCore+",
  description:
    "Use your own products and base pricing to provide fast preliminary estimates, capture better-qualified enquiries, and reduce back-and-forth. Free supplier listing available.",
  alternates: {
    canonical: "https://quote-core.com/supplier-partnership",
  },
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Supplier Partnership - Give Customers Useful Roofing Prices Instantly | QuoteCore+",
    description:
      "Use your own products and base pricing to provide fast preliminary estimates, capture better-qualified enquiries, and reduce back-and-forth. Free supplier listing available.",
    url: "https://quote-core.com/supplier-partnership",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Supplier Partnership - Give Customers Useful Roofing Prices Instantly | QuoteCore+",
    description:
      "Use your own products and base pricing to provide fast preliminary estimates, capture better-qualified enquiries, and reduce back-and-forth. Free supplier listing available.",
  },
};

const beforeSteps = [
  "Customer contacts you for a rough price",
  "You explain you need to check current pricing and get back to them",
  "Customer waits, may contact another supplier in the meantime",
  "You do a manual calculation and get back to them",
  "Half the time, they have already moved on",
];

const afterSteps = [
  "Customer visits the pricing tool on your website or QuoteCore+",
  "They select a roofing system and enter their measurements",
  "They receive a useful preliminary price based on your products",
  "They contact you with a clear idea of what they want",
  "You spend time on the quote, not on chasing tyre-kickers",
];

const walkthroughSteps = [
  {
    caption: "Select the roofing system",
    description: "The customer picks from the roofing products you have made available.",
  },
  {
    caption: "Enter the measurements",
    description: "They enter their roof area, pitch, and other basic details.",
  },
  {
    caption: "Receive a useful starting price",
    description: "The tool generates a preliminary price using your base pricing.",
  },
  {
    caption: "Send an enquiry",
    description: "The customer sends an email directly from the tool with the details they want you to see.",
  },
];

const freeOfferings = [
  {
    number: "01",
    title: "Supplier integration in QuoteCore+",
    description: "We add your business as a partner supplier inside the QuoteCore+ app. You get a supplier dashboard where you can upload pricing catalogues and build component libraries. Contractors using QuoteCore+ can search, find your products, and use your pricing in their quotes.",
    bullets: [
      "Your business listed as a partner supplier inside QuoteCore+",
      "Dashboard to manage your pricing catalogues and component libraries",
      "We help you build your component library and upload your pricing",
      "Contractors worldwide can search and use your products in their quotes",
      "The goal: users price jobs with your materials, then order from you",
    ],
    link: { label: "See the app", href: "https://app.quote-core.com" },
  },
  {
    number: "02",
    title: "Free roofing pricing tool",
    description: "We connect your supplier pricing into a free public roofing takeoff and pricing tool. Customers searching for roofing prices online can find your tool, or you can link to it from your website. It uses the same component library from the main app, so everything stays in sync.",
    bullets: [
      "A free tool hosted on quote-core.com using your products and pricing",
      "Customers find it through search or via a link from your website",
      "Uses the same component library as your QuoteCore+ integration",
      "Customers get a useful preliminary price and can contact you directly",
      "You can give customers a direct link to your specific tool",
    ],
    link: { label: "See the tool", href: "https://quote-core.com/free-roofing-takeoff-builder" },
  },
];

const supplierExamples = [
  { label: "Roof tile supplier - estimate tool", href: "#walkthrough" },
  { label: "Metal roofing supplier - product calculator", href: "#walkthrough" },
  { label: "Membrane supplier - preliminary quote tool", href: "#walkthrough" },
];

const dashboardDataPoints = [
  "How many times the tool has been used",
  "Which products are being selected most often",
  "What roof types and systems are being priced",
  "Which regions are generating the most activity",
  "How many enquiries have been generated through the tool",
  "Average estimate value being produced",
  "Which products are selected but rarely convert to enquiries",
  "Time of day and day of week usage patterns",
];

const customOptions = [
  {
    title: "Branded Pricing Tool",
    items: [
      "Your logo, brand colours, and product names",
      "Hosted on a dedicated page or embedded on your website",
      "Your products and base pricing only",
      "Enquiries come directly to you",
    ],
  },
  {
    title: "Website Integration",
    items: [
      "Embed the pricing tool on your existing website",
      "Match your site's look and feel",
      "Works on mobile and desktop",
      "No need to rebuild your current site",
    ],
  },
  {
    title: "Full Supplier Quoting System",
    items: [
      "Complete quoting workflow from measurement to formal quote",
      "Product catalogue management with pricing tiers",
      "Dashboard with enquiry tracking and reporting",
      "Integration with your existing systems where needed",
    ],
  },
  {
    title: "Growth and Discovery Support",
    items: [
      "Supplier page on QuoteCore+ with your brand and products",
      "Content and worked examples to attract search traffic",
      "Ongoing optimisation of product listings and pricing",
      "Regular reporting on tool usage and enquiry volume",
    ],
  },
];

export default function SupplierPartnershipPage() {
  return (
    <>
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* 1. Hero */}
        <section className="relative overflow-hidden py-16 lg:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.10),transparent_34%)]" />
          <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
                  Supplier Partnership
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                  Give customers useful roofing prices instantly
                </h1>
                <p className="mt-6 text-lg text-zinc-600">
                  Add your products and base pricing to QuoteCore+ so contractors can generate preliminary prices without picking up the phone. Better-qualified enquiries, less back-and-forth.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <a
                    href="https://calendly.com/quote-core-info/15-minute-meeting"
                    className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
                  >
                    Book a call
                  </a>
                  <a
                    href="/contact"
                    className="inline-flex items-center rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                  >
                    Send a message
                  </a>
                  <a
                    href="#free-integration"
                    className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                  >
                    List our business for free
                  </a>
                </div>
                <p className="mt-5 text-sm text-slate-500">
                  No obligation. No need to replace your current quoting process. Or simply reply to the email you received.
                </p>
              </div>
              <div>
                <div className="aspect-video w-full rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center">
                    <svg className="w-7 h-7 text-white ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">Short supplier overview video</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Problem / Solution */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Instead of "Thanks, we&apos;ll be in touch," give them something useful now.
            </h2>
            <p className="mt-4 text-lg text-zinc-600 max-w-3xl">
              The usual supplier process ends with the customer waiting. A pricing tool gives them a useful first result immediately - and gives you a better-qualified enquiry when they do get in touch.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Before card */}
              <div className="rounded-xl border border-slate-300 bg-slate-100 p-6 lg:p-8">
                <h3 className="text-base font-semibold text-slate-500">The usual supplier process</h3>
                <ol className="mt-6 space-y-4">
                  {beforeSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-semibold text-slate-600">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-600">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {/* After card */}
              <div className="rounded-xl border border-orange-200 bg-white p-6 lg:p-8 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition">
                <h3 className="text-base font-semibold text-[#FF6B35]">A better first result</h3>
                <ol className="mt-6 space-y-4">
                  {afterSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] text-xs font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-700">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Product Walkthrough */}
        <section id="walkthrough" className="py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              How the pricing tool works
            </h2>
            <p className="mt-4 text-lg text-zinc-600 max-w-3xl">
              The supplier controls which products are shown, which prices are visible, and how detailed the estimate should be.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {walkthroughSteps.map((step, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
                >
                  <div className="aspect-video w-full rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#FF6B35]">Step {i + 1}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">{step.caption}</h3>
                  <p className="mt-2 text-sm text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-500">
              The supplier controls which products are shown, which prices are visible, and how detailed the estimate should be.
            </p>
          </div>
        </section>

        {/* 4. What you get for free */}
        <section id="free-integration" className="py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
                Two things, both free
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                What you get when you partner with us
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                We give suppliers two products at no cost. Both work together - your pricing and components live in one place and sync across both.
              </p>
            </div>
            <div className="mt-12 space-y-8">
              {freeOfferings.map((offering) => (
                <div
                  key={offering.number}
                  className="rounded-2xl border-2 border-[#FF6B35]/20 bg-orange-50/20 p-8 lg:p-10"
                >
                  <div className="flex items-start gap-6">
                    <span className="text-2xl font-bold text-[#FF6B35] shrink-0">{offering.number}</span>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-slate-900">{offering.title}</h3>
                      <p className="mt-3 text-base text-zinc-600">{offering.description}</p>
                      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {offering.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span className="text-sm text-slate-700">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                      <a href={offering.link.href} className="mt-6 inline-block text-sm font-medium text-[#FF6B35] hover:underline">
                        {offering.link.label} &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="https://calendly.com/quote-core-info/15-minute-meeting"
                className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
              >
                Book a call to get started
              </a>
              <span className="text-sm text-slate-500">Or simply reply to the email you received.</span>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Your pricing remains under your control at all times.
            </p>
          </div>
        </section>

        {/* 6. Supplier Examples */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Examples of supplier pricing tools
            </h2>
            <p className="mt-4 text-lg text-zinc-600 max-w-3xl">
              Each supplier can configure the tool differently based on their products and preferences.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {supplierExamples.map((example) => (
                <div
                  key={example.label}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
                >
                  <div className="aspect-[4/3] w-full bg-slate-50 flex items-center justify-center">
                    <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                    </svg>
                  </div>
                  <div className="p-5">
                    <p className="text-sm font-semibold text-slate-900">{example.label}</p>
                    <a href={example.href} className="mt-2 inline-block text-sm font-medium text-[#FF6B35] hover:underline">
                      View example
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Supplier Dashboard (custom/branded) */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
              With a custom setup
            </p>
            <div className="mt-4 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="aspect-[4/3] w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
                  <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Know who is using the tool and what they are pricing
                </h2>
                <ul className="mt-6 space-y-3">
                  {dashboardDataPoints.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-sm text-slate-700">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Custom / Branded Options */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Custom and branded options
            </h2>
            <p className="mt-4 text-lg text-zinc-600 max-w-3xl">
              Beyond the free listing, there are several ways to make the tool work harder for your business.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {customOptions.map((option) => (
                <div
                  key={option.title}
                  className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
                >
                  <h3 className="text-base font-semibold text-slate-900">{option.title}</h3>
                  <ul className="mt-4 space-y-2">
                    {option.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-sm text-slate-600">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Request a tailored example
              </a>
              <span className="text-sm text-slate-500">Or simply reply to the email you received.</span>
            </div>
          </div>
        </section>

        {/* 9. Search / AI Discovery */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Help new customers find your pricing tools
            </h2>
            <div className="mt-8 aspect-[16/5] w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="mt-6 text-lg text-zinc-600">
              When your pricing tool is live, search engines and AI systems can find it, index it, and surface it when people search for roofing prices in your area. The more useful the tool, the more likely it is to be recommended.
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Search visibility builds over time and can be supported with supplier pages, worked examples, useful content, and ongoing optimisation.
            </p>
          </div>
        </section>

        {/* 10. Long Video Section */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              See the full supplier walkthrough
            </h2>
            <p className="mt-4 text-lg text-zinc-600 max-w-3xl">
              A detailed walkthrough showing how to configure products, set pricing visibility, and manage enquiries through the supplier dashboard.
            </p>
            <div className="mt-8 aspect-video w-full rounded-2xl border border-slate-200 bg-slate-100 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center">
                <svg className="w-7 h-7 text-white ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">5-10 minute walkthrough video</p>
            </div>
          </div>
        </section>

        {/* 11. FAQ */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
            <div className="mt-8">
              <FAQAccordion />
            </div>
          </div>
        </section>

        {/* 12. Final CTA */}
        <section className="bg-zinc-950 py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              See what this could look like for your business
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              We can build a tailored example using your products and pricing. No obligation, no pressure.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <a
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
              >
                Send a message
              </a>
              <a
                href="https://calendly.com/quote-core-info/15-minute-meeting"
                className="inline-flex items-center rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Book a call
              </a>
              <a
                href="#free-integration"
                className="px-4 py-2 text-sm font-medium rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-900 transition"
              >
                List our business for free
              </a>
            </div>
            <p className="mt-5 text-sm text-zinc-500">
              Or simply reply to the email you received.
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
