import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Material Ordering Software for Contractors | QuoteCore+",
  description:
    "Turn an accepted quote into a material order in seconds. Quantities, codes, and supplier details flow straight from the quote. Material ordering built for roofing and construction.",
  alternates: {
    canonical: "https://quote-core.com/features/material-ordering",
    languages: hreflangLanguages("/features/material-ordering"),
  },
  openGraph: {
    title: "Material Ordering Software for Contractors | QuoteCore+",
    description:
      "Turn an accepted quote into a material order in seconds. Material ordering built for roofing and construction.",
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
      name: "How does material ordering work in QuoteCore+?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When a quote is accepted, you can generate a material order from it with one click. The order pulls quantities, product codes, and descriptions directly from the quote's Smart Components. No re-entry required.",
      },
    },
    {
      "@type": "Question",
      name: "Can I send material orders to my supplier?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Material orders can be sent directly from QuoteCore+. The order includes quantities, product codes, and delivery information your supplier needs.",
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
  { num: 1, title: "Accept the quote", text: "When a customer accepts a quote, the quote's materials and quantities are ready to become an order. No re-measuring or re-counting." },
  { num: 2, title: "Generate the order", text: "Create a material order from the accepted quote. Quantities, product codes, and descriptions flow from the Smart Components directly into the order." },
  { num: 3, title: "Review and adjust", text: "Edit quantities, add items the quote didn't include (like fixings or consumables), or remove items you already have in stock." },
  { num: 4, title: "Send to your supplier", text: "Send the order directly from QuoteCore+. The order includes everything your supplier needs: quantities, codes, delivery details." },
];

const faqs = [
  { q: "How does material ordering work in QuoteCore+?", a: "When a quote is accepted, you can generate a material order from it with one click. The order pulls quantities, product codes, and descriptions directly from the quote's Smart Components. No re-entry required." },
  { q: "Can I send material orders to my supplier?", a: "Yes. Material orders can be sent directly from QuoteCore+. The order includes quantities, product codes, and delivery information your supplier needs." },
  { q: "Can I edit a material order before sending it?", a: "Yes. You can adjust quantities, add or remove items, and edit delivery details before sending the order to your supplier." },
];

export default function MaterialOrderingPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Feature</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Material ordering, straight from the quote.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              When a quote is accepted, generate a material order in seconds. Quantities, product codes, and descriptions flow from the quote&apos;s Smart Components. No re-counting, no spreadsheets, no phone calls with missing details.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/free-trial" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]">
                Start free trial
              </a>
              <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">
                All features
              </Link>
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What is material ordering in QuoteCore+?</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Material ordering is the step between an accepted quote and a supplier order. When a customer accepts a quote, every Smart Component in that quote already knows what material it is, what quantity is needed, and what product code it uses. The material order builder takes that information and turns it into an order you can review, adjust, and send.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            This eliminates the most common bottleneck after quote acceptance: re-counting materials from the quote, formatting them into a supplier order, and sending it. What used to take 20-30 minutes takes seconds.
          </p>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
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
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Who it&apos;s for</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Contractors who order materials from suppliers after a quote is accepted. If you&apos;re re-counting materials from a quote document, typing them into a supplier order form, or calling in orders with missing product codes, this feature eliminates that work.
          </p>
        </section>

        {/* What it solves */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What problem it solves</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Re-counting from the quote</h3>
              <p className="mt-2 text-sm text-zinc-600">After acceptance, materials have to be counted and formatted for the supplier. The order builder does this automatically from the quote's Smart Components.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Missing product codes</h3>
              <p className="mt-2 text-sm text-zinc-600">Supplier orders without product codes lead to delays and wrong deliveries. Smart Components store product codes, so every order includes them.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No order history</h3>
              <p className="mt-2 text-sm text-zinc-600">Every material order is stored against the job. You can see what was ordered, when, and for which quote, without searching through emails.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
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
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Related</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link href="/features/smart-components" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Smart Components</h3>
              <p className="mt-1 text-sm text-zinc-600">Components store product codes and quantities. Orders pull from them.</p>
            </Link>
            <Link href="/features/digital-roof-takeoff" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Digital roof takeoff</h3>
              <p className="mt-1 text-sm text-zinc-600">Measure the job. Smart Components price it. Material orders flow from it.</p>
            </Link>
            <Link href="/free-purchase-order-generator" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Free purchase order generator</h3>
              <p className="mt-1 text-sm text-zinc-600">Create a purchase order for free, no signup required.</p>
            </Link>
            <Link href="/suppliers" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Supplier network</h3>
              <p className="mt-1 text-sm text-zinc-600">Get your materials in front of contractors who order every day.</p>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try material ordering free</h2>
            <p className="mt-2 text-zinc-600">14 days, all features, no credit card required.</p>
            <a href="/free-trial" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]">
              Start free trial
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
