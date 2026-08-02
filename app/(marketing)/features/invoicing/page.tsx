import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Professional Invoicing for Contractors | QuoteCore+",
  description:
    "Create professional invoices from accepted quotes, imported quotes, or from scratch. Line items, payment instructions, and online payment tracking. Standalone invoicing built for contractors.",
  alternates: {
    canonical: "https://quote-core.com/features/invoicing",
    languages: hreflangLanguages("/features/invoicing"),
  },
  openGraph: {
    title: "Professional Invoicing for Contractors | QuoteCore+",
    description:
      "Create professional invoices from quotes or from scratch. Line items, payment instructions, and online payment tracking.",
    url: "https://quote-core.com/features/invoicing",
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
    { "@type": "ListItem", position: 3, name: "Invoicing", item: `${SITE_URL}/features/invoicing` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I need a quote to create an invoice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. You can generate an invoice from an accepted quote in QuoteCore+, import a quote from another tool, or create a blank invoice from scratch. The invoicing tool works standalone.",
      },
    },
    {
      "@type": "Question",
      name: "Do invoices include payment instructions?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every invoice includes a payment instructions panel with the amount due, payment reference, and due date. Customers can copy payment details with one click.",
      },
    },
    {
      "@type": "Question",
      name: "Can customers pay or dispute invoices online?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Invoices include action buttons for customers to mark payment as sent or dispute the invoice. This gives both parties a clear record of invoice status.",
      },
    },
  ],
};

const steps = [
  { num: 1, title: "Start from a quote or from scratch", text: "Generate an invoice from an accepted quote in QuoteCore+, import a quote from another tool, or create a blank invoice from scratch. Three ways in, same professional result." },
  { num: 2, title: "Line items flow automatically", text: "When starting from a quote, line items, descriptions, quantities, and pricing flow directly from the quote's Smart Components. No re-entry, no formatting." },
  { num: 3, title: "Payment instructions included", text: "Every invoice includes a payment instructions panel with amount due, payment reference, and due date. Customers copy details with one click." },
  { num: 4, title: "Send and track", text: "Send the invoice to your customer. They can mark payment as sent or dispute the invoice. You see the status of every invoice without chasing emails." },
];

const faqs = [
  { q: "Do I need a quote to create an invoice?", a: "No. You can generate an invoice from an accepted quote in QuoteCore+, import a quote from another tool, or create a blank invoice from scratch. The invoicing tool works standalone." },
  { q: "Do invoices include payment instructions?", a: "Yes. Every invoice includes a payment instructions panel with the amount due, payment reference, and due date. Customers can copy payment details with one click." },
  { q: "Can customers pay or dispute invoices online?", a: "Yes. Invoices include action buttons for customers to mark payment as sent or dispute the invoice. This gives both parties a clear record of invoice status." },
];

export default function InvoicingPage() {
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
              Professional invoices, standalone or from a quote.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Create a branded, professional invoice from an accepted quote, import a quote from another tool, or start from scratch. Line items, pricing, and payment instructions flow automatically. No formatting, no spreadsheets.
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

        {/* Screenshot showcase */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
              <div className="h-3 w-3 rounded-full bg-green-400/70" />
              <span className="ml-3 text-xs text-slate-500">QuoteCore+ - Invoice</span>
            </div>
            <img
              src="/images/features/invoicing.png"
              alt="QuoteCore+ professional invoice showing line items with roofing materials, totals, payment instructions, and customer action buttons"
              className="w-full"
              loading="lazy"
            />
          </div>
          {/* Feature callouts */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Three ways to start</h3>
              <p className="mt-1 text-sm text-zinc-600">From an accepted quote, import a quote from elsewhere, or create a blank invoice from scratch. The tool works standalone.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Payment instructions panel</h3>
              <p className="mt-1 text-sm text-zinc-600">Amount due, payment reference, and due date in a highlighted panel. One-click copy for customers.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Customer actions</h3>
              <p className="mt-1 text-sm text-zinc-600">Customers can mark payment as sent or dispute the invoice. Clear status for both parties.</p>
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What is invoicing in QuoteCore+?</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Invoicing is a standalone tool. You can generate an invoice from an accepted quote in QuoteCore+, import a quote from another tool, or create a blank invoice from scratch. However you start, the result is a branded, professional invoice document with line items, totals, and payment instructions.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            Every invoice includes a payment instructions panel with the amount due, payment reference, and due date. Customers can copy payment details with one click, mark payment as sent, or dispute the invoice. You see the status of every invoice without chasing emails.
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
            Contractors who want to send professional invoices without manually formatting them. Whether you quote in QuoteCore+ or elsewhere, the invoicing tool gives you a clean, branded document with payment tracking.
          </p>
        </section>

        {/* What it solves */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What problem it solves</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Manual invoice formatting</h3>
              <p className="mt-2 text-sm text-zinc-600">Creating invoices from quote data means re-entering line items, quantities, and prices. The invoice builder does this automatically.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Missing payment details</h3>
              <p className="mt-2 text-sm text-zinc-600">Invoices without clear payment instructions lead to delayed payments. Every QuoteCore+ invoice includes a payment panel with all the details.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No invoice tracking</h3>
              <p className="mt-2 text-sm text-zinc-600">When invoices are sent as PDFs, you don&apos;t know if the customer has seen them or acted on them. QuoteCore+ tracks status automatically.</p>
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
            <Link href="/features/digital-roof-takeoff" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Digital roof takeoff</h3>
              <p className="mt-1 text-sm text-zinc-600">Measure the job. The takeoff flows into the quote, and the quote flows into the invoice.</p>
            </Link>
            <Link href="/features/smart-components" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Smart Components</h3>
              <p className="mt-1 text-sm text-zinc-600">Components carry pricing through from takeoff to quote to invoice.</p>
            </Link>
            <Link href="/features/material-ordering" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Material ordering</h3>
              <p className="mt-1 text-sm text-zinc-600">Order materials from suppliers and invoice customers from the same data.</p>
            </Link>
            <Link href="/free-invoice-generator" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Free invoice generator</h3>
              <p className="mt-1 text-sm text-zinc-600">Create a professional invoice for free, no signup required.</p>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try invoicing free</h2>
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
