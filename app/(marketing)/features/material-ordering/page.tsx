import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Material Ordering Software for Contractors",
  description:
    "Create material orders from accepted quotes, imported quotes, or from scratch. Quantities, codes, and supplier details included. Standalone material ordering built for roofing and construction.",
  alternates: {
    canonical: "https://quote-core.com/features/material-ordering",
    languages: hreflangLanguages("/features/material-ordering"),
  },
  openGraph: {
    title: "Material Ordering Software for Contractors",
    description:
      "Create material orders from quotes or from scratch. Material ordering built for roofing and construction.",
    url: "https://quote-core.com/features/material-ordering",
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
    { "@type": "ListItem", position: 3, name: "Material Ordering", item: `${SITE_URL}/features/material-ordering` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I need a quote to create a material order?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. You can create a material order from an accepted quote, import a quote from elsewhere, or start a blank order from scratch. The material ordering tool works standalone.",
      },
    },
    {
      "@type": "Question",
      name: "Can I send material orders to my supplier?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Material orders can be sent directly from QuoteCore+. The order includes quantities, product codes, cut lengths, delivery details, and profile drawings for custom components.",
      },
    },
    {
      "@type": "Question",
      name: "Can I edit a material order before sending it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can adjust quantities, add or remove items, and edit delivery details before sending the order to your supplier.",
      },
    },
  ],
};

const steps = [
  { num: 1, title: "Start from a quote or from scratch", text: "Generate an order from an accepted quote in QuoteCore+, import a quote from another tool, or start with a blank order. Three ways in, same result." },
  { num: 2, title: "Review and adjust", text: "Quantities, product codes, and descriptions flow from the quote's Smart Components™. Edit quantities, add items the quote didn't include (like fixings or consumables), or remove items you already have in stock." },
  { num: 3, title: "Supplier-ready format", text: "The order includes everything your supplier needs: quantities, cut lengths, product codes, delivery address, and contact details. Custom flashings include technical profile drawings with dimensions." },
  { num: 4, title: "Send and track", text: "Send the order directly from QuoteCore+. Every order is stored against the job, so you can see what was ordered, when, and for which quote." },
];

const faqs = [
  { q: "Do I need a quote to create a material order?", a: "No. You can create a material order from an accepted quote in QuoteCore+, import a quote from another tool, or start with a blank order from scratch. The material ordering tool works standalone." },
  { q: "Can I send material orders to my supplier?", a: "Yes. Material orders can be sent directly from QuoteCore+. The order includes quantities, product codes, cut lengths, delivery details, and profile drawings for custom components." },
  { q: "Can I edit a material order before sending it?", a: "Yes. You can adjust quantities, add or remove items, and edit delivery details before sending the order to your supplier." },
];

export default function MaterialOrderingPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features", href: "/features" }, { label: "Material Ordering" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Feature</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Material ordering, standalone or from a quote.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Create a material order from an accepted quote, import a quote from another tool, or start from scratch. Quantities, product codes, and profile drawings included. No re-counting, no spreadsheets, no phone calls with missing details.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/free-trial" className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]">
                Start free trial
              </a>
              <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">
                All features
              </Link>
            </div>
          </div>
        </section>

        {/* Screenshot showcase */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
              <div className="h-3 w-3 rounded-full bg-green-400/70" />
              <span className="ml-3 text-xs text-slate-500">QuoteCore+ - Material Order</span>
            </div>
            <img
              src="/images/features/material-ordering.png"
              alt="QuoteCore+ material order showing roofing materials with quantities, cut lengths, supplier details, and profile drawings"
              className="w-full"
              loading="lazy"
            />
          </div>
          {/* Feature callouts */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375V21M6 18h2.25c.621 0 1.125-.504 1.125-1.125V13.5c0-.621-.504-1.125-1.125-1.125H6m0 0V9.75M6 4.5h2.25c.621 0 1.125.504 1.125 1.125V9c0 .621-.504 1.125-1.125 1.125H6m0 0V4.5" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Three ways to start</h3>
              <p className="mt-1 text-sm text-zinc-600">From an accepted quote, import a quote from elsewhere, or start a blank order from scratch. The tool works standalone.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0 0V14.25M9.75 9.75h3.375c.621 0 1.125.504 1.125 1.125v3.375M9.75 9.75v3.375m0-3.375h-3.375a1.125 1.125 0 00-1.125 1.125v3.375m6-9.75h6m-6 0V3.375A1.125 1.125 0 0014.25 2.25H5.625A1.125 1.125 0 004.5 3.375v6.75m6-9.75H4.5" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Supplier-ready format</h3>
              <p className="mt-1 text-sm text-zinc-600">Orders include product codes, cut lengths, delivery address, and contact details. Suppliers get exactly what they need.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Profile drawings included</h3>
              <p className="mt-1 text-sm text-zinc-600">Custom flashings include technical profile drawings with dimensions, so suppliers know exactly what to fabricate.</p>
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What is material ordering in QuoteCore+?</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Material ordering is a standalone tool. You can generate an order from an accepted quote in QuoteCore+, import a quote from another tool, or start with a blank order from scratch. However you start, the order builder gives you a supplier-ready document with quantities, product codes, cut lengths, and delivery details.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            When you do start from a QuoteCore+ quote, every Smart Component already knows what material it is, what quantity is needed, and what product code it uses. The material order takes that information and turns it into an order in seconds.
          </p>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
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
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Who it&apos;s for</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Contractors who order materials from suppliers. Whether you quote in QuoteCore+ or elsewhere, the material ordering tool gives you a clean, supplier-ready document without re-counting or re-formatting.
          </p>
        </section>

        {/* What it solves */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What problem it solves</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Re-counting from the quote</h3>
              <p className="mt-2 text-sm text-zinc-600">After acceptance, materials have to be counted and formatted for the supplier. The order builder does this automatically from the quote's Smart Components™.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Missing product codes</h3>
              <p className="mt-2 text-sm text-zinc-600">Supplier orders without product codes lead to delays and wrong deliveries. Smart Components™ store product codes, so every order includes them.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No order history</h3>
              <p className="mt-2 text-sm text-zinc-600">Every material order is stored against the job. You can see what was ordered, when, and for which quote, without searching through emails.</p>
            </div>
          </div>
        </section>

        {/* Supported inputs and outputs */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Supported inputs and outputs</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Inputs</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                <li>- Accepted quote with Smart Components</li>
                <li>- Product codes and quantities from components</li>
                <li>- Supplier details (name, contact)</li>
                <li>- Custom line items (add manually)</li>
                <li>- Blank order (start from scratch)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Outputs</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                <li>- Material order with quantities and product codes</li>
                <li>- Supplier delivery details</li>
                <li>- Order stored against the job</li>
                <li>- Printable order document</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Worked example */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Worked example: ordering tiles and ridge</h2>
          <div className="mt-6 rounded-xl border border-slate-200 p-6">
            <p className="text-sm text-zinc-600">A contractor accepts a quote for a 180 m2 gable roof:</p>
            <ol className="mt-4 space-y-3 text-sm text-zinc-600">
              <li><strong>1. Open the accepted quote:</strong> The quote has 198 m2 of concrete tiles (with waste) and 12 m of ridge.</li>
              <li><strong>2. Generate order:</strong> Click "Create material order". All line items pull through automatically with product codes and quantities.</li>
              <li><strong>3. Add extras:</strong> The contractor adds 2 rolls of underlay and 1 box of nails manually.</li>
              <li><strong>4. Send to supplier:</strong> The order is emailed or printed for the supplier with all details.</li>
            </ol>
          </div>
        </section>

        {/* Honest limitations */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What it does not do</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No direct supplier API ordering</h3>
              <p className="mt-2 text-sm text-zinc-600">Material orders are generated as documents (printable or emailable). The system does not place live orders into supplier e-commerce systems.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No delivery tracking</h3>
              <p className="mt-2 text-sm text-zinc-600">Orders are stored against the job, but delivery status tracking is not included. You track delivery through your supplier as normal.</p>
            </div>
          </div>
        </section>

        {/* Less suitable use */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">When it may not be the right fit</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">You order from a single supplier with a fixed list</h3>
              <p className="mt-2 text-sm text-zinc-600">If you always order the same materials from the same supplier with no variation, a phone call or email may be simpler. The order builder adds the most value when quotes vary in scope and materials.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
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
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Related</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link href="/features/smart-components" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Smart Components™</h3>
              <p className="mt-1 text-sm text-zinc-600">Components store product codes and quantities. Orders pull from them.</p>
            </Link>
            <Link href="/features/digital-roof-takeoff" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Digital roof takeoff</h3>
              <p className="mt-1 text-sm text-zinc-600">Measure the job. Smart Components™ price it. Material orders flow from it.</p>
            </Link>
            <Link href="/free-purchase-order-generator" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Free purchase order generator</h3>
              <p className="mt-1 text-sm text-zinc-600">Create a purchase order for free, no signup required.</p>
            </Link>
            <Link href="/suppliers-info" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Supplier network</h3>
              <p className="mt-1 text-sm text-zinc-600">Get your materials in front of contractors who order every day.</p>
            </Link>
            <Link href="/pricing" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Pricing</h3>
              <p className="mt-1 text-sm text-zinc-600">Compare plans and start a 14-day free trial.</p>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try material ordering free</h2>
            <p className="mt-2 text-zinc-600">14 days, all features, no credit card required.</p>
            <a href="/free-trial" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]">
              Start free trial
            </a>
            <p className="mt-4 text-sm text-zinc-500">
              <Link href="/pricing" className="underline hover:text-zinc-900">See pricing</Link>
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
