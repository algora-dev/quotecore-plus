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

const faqSchemaData = [
  {
    q: "What is a supplier partnership with QuoteCore+?",
    a: "We add your roofing products, service area, and base pricing to QuoteCore+ so contractors can generate preliminary prices using your materials. You control what is shown, how visible pricing is, and how detailed the estimates are. Contractors get a useful starting point, and you get better-qualified enquiries.",
  },
  {
    q: "How much does it cost to list our business?",
    a: "The basic supplier listing is free. We add your business, service area, products, and base pricing at no cost. If you want a branded pricing tool, website integration, or a full supplier quoting system, those are custom projects scoped based on complexity.",
  },
  {
    q: "Do we need to replace our current quoting process?",
    a: "No. QuoteCore+ does not replace your existing workflow. Contractors use the tool to get a preliminary price before they contact you. When they do get in touch, they arrive with a clearer idea of what they need, which reduces back-and-forth and makes the conversation more productive.",
  },
  {
    q: "Who controls the pricing shown in the tool?",
    a: "You do. You provide the base pricing and you decide how visible it is. You can show full pricing, indicative ranges, or hide pricing entirely and just show product selection. You can update pricing whenever you want.",
  },
  {
    q: "What types of roofing suppliers is this for?",
    a: "Any supplier of roofing materials - tiles, slates, shingles, metal sheets, membranes, insulation, battens, fixings, flashings, gutters, rooflights, or accessories. If contractors buy it for roofs, it belongs in the tool.",
  },
  {
    q: "How long does setup take?",
    a: "For a free supplier listing, we can have your business, products, and base pricing added within a few days of receiving your catalogue. Custom and branded systems take longer depending on scope.",
  },
  {
    q: "Can we update our products and pricing after launch?",
    a: "Yes. You can update product codes, names, prices, and specifications at any time. Keeping your catalogue current means contractors always quote with accurate information.",
  },
  {
    q: "Do contractors order through QuoteCore+ or directly from us?",
    a: "Contractors contact you directly. QuoteCore+ connects the contractor to your business - we do not hold stock, take a cut, or insert ourselves between you and the customer. You keep the relationship and the pricing.",
  },
  {
    q: "What if we only supply a specific region?",
    a: "That is fine. We set your service area so you only appear in searches where you can actually deliver. Local and regional suppliers are prioritised over national ones where relevant.",
  },
  {
    q: "What does the supplier dashboard show?",
    a: "The dashboard shows which products are being selected, how often the tool is used, what roof types and materials are being priced, the regions where activity is happening, and how many enquiries are being generated. You get a clear picture of demand without picking up the phone.",
  },
  {
    q: "Can we get a branded version of the pricing tool?",
    a: "Yes. A branded pricing tool featuring your logo, colours, and product range is available as a custom project. This can be embedded on your website or hosted on a dedicated page. Contact us to discuss scope and pricing.",
  },
  {
    q: "What happens if a contractor gets a preliminary price and then contacts us?",
    a: "That is the goal. The contractor arrives with a rough idea of cost based on your actual products, which means the conversation is more productive. You can refine the price, adjust the spec, and move toward a formal quote. The tool reduces the repetitive early-stage conversations that eat up your team's time.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqSchemaData.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://quote-core.com/" },
    { "@type": "ListItem", position: 2, name: "Supplier Partnership", item: "https://quote-core.com/supplier-partnership" },
  ],
};

const beforeSteps = [
  "Customer calls or emails asking for a rough price",
  "You explain you need to check current pricing and get back to them",
  "Customer waits, may call another supplier in the meantime",
  "You do a manual calculation and call them back",
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
];

const flexibleSetupOptions = [
  {
    title: "Simple Estimate",
    description: "Customer selects a roof type and enters area. The tool returns a rough cost range based on your base pricing. Fast, low friction, useful for early-stage budgeting.",
  },
  {
    title: "Detailed Product Calculator",
    description: "Customer selects specific products, enters multiple roof areas, adjusts pitch and waste factors. The tool returns a more detailed material breakdown with pricing.",
  },
  {
    title: "Full Preliminary Quote",
    description: "Customer goes through a guided flow that covers roof geometry, product selection, accessories, and labour assumptions. The tool produces a structured preliminary quote they can save or print.",
  },
];

const freeIntegrationChecklist = [
  "Your business name and contact details added to QuoteCore+",
  "Your service area set so you appear in the right searches",
  "Your roofing products added with codes, names, and descriptions",
  "Your base pricing loaded and configured to your visibility preference",
  "Disclaimers and estimate scope set to match your requirements",
  "The tool live and accessible to contractors in your area",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

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
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href="#walkthrough"
                    className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
                  >
                    Show me what this could look like
                  </a>
                  <a
                    href="#free-integration"
                    className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                  >
                    List our business for free
                  </a>
                </div>
                <p className="mt-5 text-sm text-slate-500">
                  No obligation. No need to replace your current quoting process.
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
              The usual supplier process ends with the customer waiting. A pricing tool gives them a useful first result immediately - and gives you a better-qualified enquiry when they do call.
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

        {/* 4. Flexible Setup */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Three levels of detail, your choice
            </h2>
            <p className="mt-4 text-lg text-zinc-600 max-w-3xl">
              You decide how much detail the tool provides - from a quick cost range to a structured preliminary quote.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {flexibleSetupOptions.map((option) => (
                <div
                  key={option.title}
                  className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
                >
                  <h3 className="text-base font-semibold text-slate-900">{option.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{option.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm font-medium text-slate-700">
              You control the products, prices, visibility, disclaimers, and level of detail.
            </p>
          </div>
        </section>

        {/* 5. Free Supplier Integration */}
        <section id="free-integration" className="py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="rounded-2xl border-2 border-[#FF6B35]/30 bg-orange-50/30 p-8 lg:p-12">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Start free
              </h2>
              <p className="mt-4 text-lg text-zinc-600 max-w-2xl">
                We can add your business, service area, products, and base pricing to QuoteCore+ at no cost.
              </p>
              <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {freeIntegrationChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-sm text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <a
                  href="/contact"
                  className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
                >
                  Add our business for free
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Your pricing remains under your control.
              </p>
            </div>
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

        {/* 7. Supplier Dashboard */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
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
            <div className="mt-8">
              <a
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Request a tailored example
              </a>
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
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
              >
                Show me a tailored example
              </a>
              <a
                href="/contact"
                className="px-4 py-2 text-sm font-medium rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-900 transition"
              >
                Book a short call
              </a>
            </div>
            <a href="#free-integration" className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-300 transition">
              List our business for free
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
