import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Features | QuoteCore+",
  description:
    "Digital roof takeoffs, Smart Components™, material ordering, and invoicing. Explore the features that make QuoteCore+ the connected quoting platform for roofing and construction.",
  alternates: {
    canonical: "https://quote-core.com/features",
    languages: hreflangLanguages("/features"),
  },
  openGraph: {
    title: "Features | QuoteCore+",
    description:
      "Digital roof takeoffs, Smart Components™, material ordering, quote approval tracking, and invoicing. Explore the features of QuoteCore+.",
    url: "https://quote-core.com/features",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const features = [
  {
    title: "Digital Roof Takeoff",
    description:
      "Upload plans, measure digitally, and build a complete roof takeoff with sections, lengths, areas, and flashings connected from the start.",
    href: "/features/digital-roof-takeoff",
    keyword: "roof takeoff software",
    steps: ["Upload a roof plan", "Measure sections digitally", "Generate a complete takeoff", "Send to quote builder"],
  },
  {
    title: "Smart Components™",
    description:
      "Reusable quoting components that know their own measurements, waste allowances, and pricing rules. Build a roof quote in minutes, not hours.",
    href: "/features/smart-components",
    keyword: "reusable quoting components",
    steps: ["Create a component once", "Set pricing and waste rules", "Drop into any quote", "Quote repeats automatically"],
  },
  {
    title: "Material Ordering",
    description:
      "From a saved quote, create a material order with quantities and supplier details carried over. Choose from three display formats and send it straight to your supplier.",
    href: "/features/material-ordering",
    keyword: "material ordering software",
    steps: ["Save a quote", "Create order from quote", "Edit and format", "Send to supplier"],
  },
  {
    title: "Invoicing",
    description:
      "Turn accepted quotes into professional invoices with line items and configurable payment methods. QuoteCore+ presents bank details, Stripe links or PayPal links - recipients pay using the provided details and can mark the invoice paid or dispute it.",
    href: "/features/invoicing",
    keyword: "contractor invoicing software",
    steps: ["Accept a quote", "Create an invoice from the quote", "Configure payment methods", "Customer marks paid or disputes"],
  },
  {
    title: "Supplier Resources",
    description:
      "Search supplier pricing catalogs and component libraries by area or product type. Import ready-made components or convert catalogs in bulk.",
    href: "/features/supplier-resources",
    keyword: "supplier pricing catalogs",
    steps: ["Search suppliers", "Browse catalogs and libraries", "Import or convert", "Quote with indicative pricing"],
  },
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
  ],
};

export default function FeaturesHubPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Features</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Every part of the quoting workflow, connected.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              From the first measurement to the final invoice, QuoteCore+ keeps every step of the quoting process in one place. Explore the features that make it work.
            </p>
          </div>
        </section>

        {/* Workflow overview */}
        <section className="mx-auto max-w-5xl px-6 pb-12 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 sm:p-10">
            <h2 className="text-center text-2xl font-semibold tracking-tight">From measurement to invoice in one workflow</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600">Each feature connects to the next. No re-entering data, no switching between tools.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm font-medium sm:gap-3">
              {[
                { label: "Measure", href: "/features/digital-roof-takeoff" },
                { label: "Calculate", href: "/features/smart-components" },
                { label: "Quote", href: "/roofing-quoting-software" },
                { label: "Send", href: "/features/sending-and-tracking" },
                { label: "Order", href: "/features/material-ordering" },
                { label: "Invoice", href: "/features/invoicing" },
              ].map((step, i, arr) => (
                <React.Fragment key={step.label}>
                  <Link href={step.href} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-zinc-900 transition-colors hover:border-orange-200 hover:bg-orange-50/40">{step.label}</Link>
                  {i < arr.length - 1 && <span className="text-zinc-400" aria-hidden="true">&rarr;</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="group rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
              >
                <h2 className="text-lg font-semibold text-slate-900">{feature.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{feature.description}</p>
                <p className="mt-4 text-sm font-medium text-[#BD4A1A] group-hover:text-[#FF6B35]">
                  Learn more
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Four ways to quote */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Four ways to quote</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600">Not every job starts the same way. Pick the path that fits the work.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-semibold text-slate-900">1. Plan + AI Scan Assist</h3>
              <p className="mt-2 text-sm text-slate-500">Best for full reroofs and plan work. Upload a roof plan, AI identifies areas and elements, you verify and Smart Components calculate the rest.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-semibold text-slate-900">2. Plan + manual takeoff</h3>
              <p className="mt-2 text-sm text-slate-500">Best for complex or unusual plans. Upload a plan and draw everything digitally. Smart Components apply pricing as you go.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-semibold text-slate-900">3. Site measurements + Smart Components</h3>
              <p className="mt-2 text-sm text-slate-500">Best for site-measured and repeat jobs. Enter measurements from site and saved rules generate quantities, labour and price.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-semibold text-slate-900">4. Custom / line-by-line quote</h3>
              <p className="mt-2 text-sm text-slate-500">Best for repairs, variations and one-offs. Start blank, use CSV catalogues, supplier catalogues or saved items. Includes AI line-item import.</p>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-6 py-5">
            <p className="text-sm font-medium text-slate-900">Shared accelerators across all paths:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["CSV catalogue import", "Searchable supplier catalogues", "Supplier component libraries", "Saved catalogue items", "AI line-item import"].map((item) => (
                <span key={item} className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">{item}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Comparisons */}
        {/* Feature table */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight">What each feature does</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600">Seven connected features that take you from plan to payment.</p>
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Feature</th>
                  <th className="px-5 py-3 font-semibold">What it does</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 font-medium text-slate-900">Digital Roof Takeoff</td><td className="px-5 py-3 text-slate-600">Upload plans, measure roof areas, lengths and pitch digitally</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 font-medium text-slate-900">AI Scan Assist</td><td className="px-5 py-3 text-slate-600">AI identifies roof areas, ridges, hips, valleys, barges and spouting from your plan</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 font-medium text-slate-900">Smart Components™</td><td className="px-5 py-3 text-slate-600">Store reusable pricing and quantity rules so every quote is consistent</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 font-medium text-slate-900">Sending & Tracking</td><td className="px-5 py-3 text-slate-600">Send documents, track opens/reads, automate follow-ups with cancellation conditions</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 font-medium text-slate-900">Material Ordering</td><td className="px-5 py-3 text-slate-600">Create orders from saved quotes with three display formats and supplier-ready details</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 font-medium text-slate-900">Invoicing</td><td className="px-5 py-3 text-slate-600">Create invoices from accepted quotes with configurable payment methods (bank, Stripe, PayPal)</td></tr>
                <tr className="hover:bg-orange-50/40"><td className="px-5 py-3 font-medium text-slate-900">Supplier Resources</td><td className="px-5 py-3 text-slate-600">Import supplier catalogues and build component libraries from CSV</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#FF6B35] mb-2">Who it&apos;s for</p>
            <p className="text-base text-slate-700">Roofers and roofing estimators come first. QuoteCore+ was built around the pitches, angles and measurements roofing demands. Construction and other measured trades use it too - Smart Components™ adapt to how you work.</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Why contractors switch from other tools</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600">Spreadsheets and standalone apps each solve part of the problem. QuoteCore+ connects the whole workflow.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">vs. Spreadsheets</h3>
              <p className="mt-2 text-sm text-slate-500">No more formula errors or version conflicts. Components store their own pricing and waste rules, and the quote total updates automatically.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">vs. Standalone Takeoff</h3>
              <p className="mt-2 text-sm text-slate-500">Measurements flow straight into the quote. No exporting PDFs or re-entering numbers into a separate quoting tool.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">vs. Generic Invoice Apps</h3>
              <p className="mt-2 text-sm text-slate-500">Invoices pull line items directly from the accepted quote. No copy-pasting between systems or double-handling quantities.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try all features free for 14 days</h2>
            <p className="mt-2 text-zinc-600">No credit card required. Full access to every feature.</p>
            <a
              href="/free-trial"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
            >
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
