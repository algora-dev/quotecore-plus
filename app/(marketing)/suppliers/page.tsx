import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Partner with QuoteCore+ | Roofing Supplier Network",
  description:
    "Get your roofing materials in front of contractors who quote, order, and buy every day. Join the QuoteCore+ supplier network to reach active buyers, upload your catalogue, and grow your business.",
  alternates: {
    canonical: "https://quote-core.com/suppliers",
  },
  openGraph: {
    title: "Partner with QuoteCore+ | Roofing Supplier Network",
    description:
      "Get your roofing materials in front of contractors who quote, order, and buy every day. Join the QuoteCore+ supplier network.",
    url: "https://quote-core.com/suppliers",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Partner with QuoteCore+ | Roofing Supplier Network",
    description:
      "Get your roofing materials in front of contractors who quote, order, and buy every day. Join the QuoteCore+ supplier network.",
  },
};

const supplierBenefits = [
  {
    title: "Reach active buyers",
    body: "Contractors using QuoteCore+ are actively quoting, ordering materials, and buying. Your products appear where purchasing decisions are made - not on a passive directory page.",
  },
  {
    title: "Upload your catalogue",
    body: "Add your products with three things contractors need: a product code or SKU, a product name or description, and a current price. That is the core of what turns a quote from a guess into an order. Contractors can find your materials and include them in quotes without chasing price lists or phone calls.",
  },
  {
    title: "Be found by area",
    body: "Contractors search for suppliers by region and material type. If you cover an area, you show up. No more being overlooked because someone found a competitor first.",
  },
  {
    title: "Connect at quote time",
    body: "When a contractor builds a quote, your materials - with product codes, descriptions, and pricing - are right there in the component library. Your products are specified before the order even goes out.",
  },
  {
    title: "Branded free tools",
    body: "We can build branded free tools - calculators, takeoff builders, material lists - that feature your brand and products. A roofing calculator with your logo is a lead generator that works 24/7.",
  },
  {
    title: "No middleman markup",
    body: "You keep your pricing and your customer relationship. QuoteCore+ connects contractors to suppliers - we do not buy your materials and resell them.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Tell us about your business",
    body: "Share your coverage area, material categories, and contact details so we can match you with the right contractors.",
  },
  {
    step: "02",
    title: "Upload your catalogue",
    body: "Provide your product list with three core fields: product code or SKU, product name or description, and current price. We help you get it into the format contractors can use.",
  },
  {
    step: "03",
    title: "Contractors find and specify your products",
    body: "When contractors in your area build quotes, your materials appear in the component library. They specify your products before the order goes out.",
  },
  {
    step: "04",
    title: "Receive orders and grow",
    body: "Contractors send purchase orders directly to you. You keep the relationship, the pricing, and the customer.",
  },
];

const faqs = [
  {
    q: "What types of suppliers can join?",
    a: "Any supplier of roofing materials - tiles, slates, shingles, metal sheets, membranes, insulation, battens, fixings, flashings, gutters, rooflights, or accessories. If contractors buy it for roofs, it belongs here.",
  },
  {
    q: "How much does it cost to join?",
    a: "We are currently onboarding suppliers as founding partners. Pricing will be discussed during the application process. The goal is to make it cheaper than traditional advertising for the volume of qualified leads you receive.",
  },
  {
    q: "Do contractors order through QuoteCore+ or directly from us?",
    a: "Contractors send purchase orders directly to you. QuoteCore+ connects the contractor to your business - we do not hold stock, take a cut, or insert ourselves between you and the customer.",
  },
  {
    q: "What if I only supply a specific region?",
    a: "That is exactly what the area-based search is for. Contractors filter suppliers by region, so you only appear in searches where you can actually deliver. Local suppliers are prioritised.",
  },
  {
    q: "Can I update my catalogue after joining?",
    a: "Yes. You can update product codes, names, prices, and specifications at any time. Keeping your catalogue current means contractors always quote with accurate information.",
  },
  {
    q: "What does a supplier catalogue need to include?",
    a: "Three things matter most: a product code or SKU, a product name or description, and a current price. Those three fields let contractors specify your products in a quote and generate a purchase order without calling you. Beyond that, pack quantities, coverage area, product images, and lead times all help contractors choose your products with confidence.",
  },
  {
    q: "How is this different from a supplier directory?",
    a: "A directory lists your name and number. QuoteCore+ puts your products - with codes, descriptions, and pricing - inside the quoting workflow itself. Contractors specify your materials while building quotes, before they even contact you. That is a much stronger position than being listed on a page.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
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
    { "@type": "ListItem", position: 2, name: "Suppliers", item: "https://quote-core.com/suppliers" },
  ],
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "QuoteCore+ Supplier Network",
  description:
    "Get your roofing materials in front of contractors who quote, order, and buy every day. Join the QuoteCore+ supplier network to reach active buyers, upload your catalogue, and grow your business.",
  provider: {
    "@type": "Organization",
    name: "QuoteCore+",
    url: "https://quote-core.com/",
  },
  serviceType: "Roofing Supplier Network",
  areaServed: "Global",
  url: "https://quote-core.com/suppliers",
};

export default function SuppliersPage() {
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />

      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.10),transparent_34%)]" />
          <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
              Supplier Network
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Get your materials in front of contractors who quote online.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 sm:text-xl">
              QuoteCore+ connects roofing suppliers with contractors who are actively quoting, ordering, and buying materials every day. No directory listing. No middleman. Just your products in the workflow where purchasing decisions happen.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
              >
                Get in touch
              </a>
              <a
                href="#benefits"
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* Stats band */}
        <section className="border-y border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-3xl font-semibold text-zinc-950">47+</p>
                <p className="mt-1 text-sm text-zinc-500">Free tools driving contractor traffic</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-semibold text-zinc-950">26</p>
                <p className="mt-1 text-sm text-zinc-500">Blog posts attracting search visitors</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-semibold text-zinc-950">9</p>
                <p className="mt-1 text-sm text-zinc-500">YouTube videos demonstrating the workflow</p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Why partner with QuoteCore+
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                A supplier directory lists your name. QuoteCore+ puts your products inside the quoting workflow - where contractors are already making purchasing decisions.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {supplierBenefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
                >
                  <h3 className="text-base font-semibold text-zinc-950">{benefit.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{benefit.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {howItWorks.map((item) => (
                <div key={item.step}>
                  <p className="text-sm font-semibold text-[#FF6B35]">{item.step}</p>
                  <h3 className="mt-2 text-base font-semibold text-zinc-950">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What suppliers can offer */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 lg:p-12">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                What you need in your catalogue
              </h2>
              <p className="mt-4 text-zinc-600">
                The core of a useful catalogue is three things. Get these right and contractors can specify your products in every quote.
              </p>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { label: "Product code / SKU", desc: "The identifier contractors use to order. Without it, they cannot put your product on a purchase order." },
                  { label: "Product name / description", desc: "A clear name and short description so contractors know exactly what they are specifying." },
                  { label: "Price", desc: "Current, accurate pricing. If the price is wrong, the quote is wrong, and the contractor loses money or the job." },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border-2 border-[#FF6B35]/20 bg-orange-50/30 p-5">
                    <p className="text-sm font-semibold text-[#FF6B35]">{item.label}</p>
                    <p className="mt-1 text-sm text-zinc-600">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-zinc-500">Beyond the core three, these details help contractors specify your products more confidently:</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  "Pack quantities and coverage per unit",
                  "Coverage area and delivery zones",
                  "Material categories (tiles, slates, sheets, membranes, etc.)",
                  "Product images and technical drawings",
                  "Lead times and stock availability",
                  "Brand and product family information",
                  "Special order or custom item details",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-sm text-zinc-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-4 text-xs text-slate-500">Pricing in supplier catalogues is indicative, sourced from publicly available supplier data at upload time. Prices do not auto-update - suppliers can re-upload when pricing changes.</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
            <div className="mt-8 space-y-6">
              {faqs.map((faq) => (
                <div key={faq.q} className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="text-base font-semibold text-zinc-950">{faq.q}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Honest limitations */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">What supplier resources does not do</h2>
            <div className="mt-8 space-y-4">
              <div className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">No live price syncing</h3>
                <p className="mt-2 text-sm text-zinc-600">Supplier catalogs are snapshots at upload time. Prices do not auto-update. Suppliers can re-upload when pricing changes.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">No direct e-commerce ordering</h3>
                <p className="mt-2 text-sm text-zinc-600">Contractors import supplier pricing into their quotes and generate material orders as documents. QuoteCore+ does not place live orders into supplier e-commerce systems.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">No exclusive placement</h3>
                <p className="mt-2 text-sm text-zinc-600">Multiple suppliers in the same area can publish catalogs. Contractors choose based on pricing and availability, not paid placement.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Related */}
        <section className="border-y border-zinc-200 bg-zinc-50 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Related</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <a href="/features/supplier-resources" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
                <h3 className="font-semibold text-slate-900">Supplier resources feature</h3>
                <p className="mt-1 text-sm text-zinc-600">How contractors import and use supplier catalogs in QuoteCore+.</p>
              </a>
              <a href="/features/material-ordering" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
                <h3 className="font-semibold text-slate-900">Material ordering</h3>
                <p className="mt-1 text-sm text-zinc-600">How contractors generate material orders from accepted quotes.</p>
              </a>
              <a href="/features/smart-components" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
                <h3 className="font-semibold text-slate-900">Smart Components</h3>
                <p className="mt-1 text-sm text-zinc-600">The component system that stores product codes and pricing from suppliers.</p>
              </a>
              <a href="/pricing" className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
                <h3 className="font-semibold text-slate-900">Pricing</h3>
                <p className="mt-1 text-sm text-zinc-600">Plans for contractors who use supplier catalogs.</p>
              </a>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-zinc-950 py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to grow your roofing supply business?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              If you supply quality roofing materials to your area, and you want to grow, we want to work with you.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
              >
                Get in touch
              </a>
              <a
                href="/free-tools"
                className="px-4 py-2 text-sm font-medium rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-900 transition"
              >
                Explore free tools
              </a>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
