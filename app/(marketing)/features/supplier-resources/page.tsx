import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Supplier Resources: Catalogs & Component Libraries | QuoteCore+",
  description:
    "Search supplier pricing catalogs and component libraries by area or product type. Import ready-made components into your account. Convert supplier catalogs into Smart Components™ in bulk. Save hours of manual pricing setup.",
  alternates: {
    canonical: "https://quote-core.com/features/supplier-resources",
    languages: hreflangLanguages("/features/supplier-resources"),
  },
  openGraph: {
    title: "Supplier Resources: Catalogs & Component Libraries | QuoteCore+",
    description:
      "Search supplier pricing catalogs and component libraries. Import components, convert catalogs to Smart Components™, and start quoting with real pricing.",
    url: "https://quote-core.com/features/supplier-resources",
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
    { "@type": "ListItem", position: 3, name: "Supplier Resources", item: `${SITE_URL}/features/supplier-resources` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What are supplier resources in QuoteCore+?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Supplier resources are publicly available pricing catalogs and component libraries published by roofing and construction suppliers. Users can search by area or product type, find a supplier's catalog or library, and import components directly into their own account to use for quoting.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between a catalog and a component library?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A catalog is a CSV file of pricing from a supplier - product codes, names, and prices. A component library is a full set of Smart Components™ that a supplier has created, including measurement types, waste rules, labour rates, and pricing. Component libraries are ready to use immediately; catalogs can be converted into components.",
      },
    },
    {
      "@type": "Question",
      name: "What is the catalog to component converter?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The catalog to component converter lets you open a supplier catalog (CSV) and convert each row into a Smart Component. You select which columns map to which component fields - name, price, measurement type, product code - and the converter creates all the components at once. You can then fine-tune each component individually.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use supplier pricing if I don't have my own prices yet?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Supplier resources are designed for contractors who don't have established pricing yet. Search for a supplier in your area, import their component library or catalog, and start quoting with real pricing from day one. You can adjust the imported prices to match your trade discount or markup.",
      },
    },
  ],
};

const steps = [
  { num: 1, title: "Search for suppliers", text: "Search by your area, by product type, or by supplier name. Find suppliers who have published their pricing catalogs and component libraries publicly on QuoteCore+." },
  { num: 2, title: "Browse catalogs and libraries", text: "Open a supplier's component library to see ready-made Smart Components™ with pricing, measurement types, and waste rules. Or open their catalog (CSV) to see raw pricing data - product codes, names, and prices." },
  { num: 3, title: "Import or convert", text: "Import a supplier's component library directly into your account. Or use the catalog to component converter to turn a CSV catalog into Smart Components™ - map columns to fields, convert in bulk, then fine-tune individually." },
  { num: 4, title: "Quote with real pricing", text: "Your imported components are ready to use in quotes immediately. Adjust prices to match your trade discount or markup. Every time you quote, these components calculate automatically." },
];

const faqs = [
  { q: "What are supplier resources in QuoteCore+?", a: "Supplier resources are publicly available pricing catalogs and component libraries published by roofing and construction suppliers. Users can search by area or product type, find a supplier's catalog or library, and import components directly into their own account to use for quoting." },
  { q: "What is the difference between a catalog and a component library?", a: "A catalog is a CSV file of pricing from a supplier - product codes, names, and prices. A component library is a full set of Smart Components™ that a supplier has created, including measurement types, waste rules, labour rates, and pricing. Component libraries are ready to use immediately; catalogs can be converted into components." },
  { q: "What is the catalog to component converter?", a: "The catalog to component converter lets you open a supplier catalog (CSV) and convert each row into a Smart Component. You select which columns map to which component fields - name, price, measurement type, product code - and the converter creates all the components at once. You can then fine-tune each component individually." },
  { q: "Can I use supplier pricing if I don't have my own prices yet?", a: "Yes. Supplier resources are designed for contractors who don't have established pricing yet. Search for a supplier in your area, import their component library or catalog, and start quoting with real pricing from day one. You can adjust the imported prices to match your trade discount or markup." },
];

export default function SupplierResourcesPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features", href: "/features" }, { label: "Supplier Resources" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Feature</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Supplier pricing catalogs and component libraries, ready to use.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Search for suppliers in your area, browse their pricing catalogs and component libraries, and import ready-made components directly into your account. No more calling around for price lists. No more manual data entry. Real pricing, ready to quote with.
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

        {/* Feature callouts */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Search by area or product</h3>
              <p className="mt-1 text-sm text-zinc-600">Find suppliers in your region or by product type. See who has published pricing and component libraries.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Ready-made component libraries</h3>
              <p className="mt-1 text-sm text-zinc-600">Suppliers publish full Smart Components™ with pricing, measurement types, and waste rules. Import and use immediately.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Catalog to component converter</h3>
              <p className="mt-1 text-sm text-zinc-600">Open a supplier CSV catalog, map columns to component fields, and convert rows into Smart Components™ in bulk.</p>
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What are supplier resources?</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Supplier resources are publicly available pricing data published by roofing and construction suppliers on QuoteCore+. There are two types: catalogs and component libraries.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            A <strong>component library</strong> is a full set of Smart Components™ that a supplier has created. Each component has a name, product code, measurement type (area, linear length, per unit, fixed cost), price, and waste rules. When you import a component library, the components are ready to use in your quotes immediately.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            A <strong>catalog</strong> is a simpler CSV file of pricing data - typically product codes, product names, and prices. Catalogs are raw data that you can convert into Smart Components™ using the catalog to component converter.
          </p>
        </section>

        {/* Catalog vs library */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Catalogs vs component libraries</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Catalog</span>
                <h3 className="text-lg font-semibold">Pricing data (CSV)</h3>
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                A CSV file from a supplier with product codes, names, and prices. Simple, raw pricing data. Use the catalog to component converter to turn each row into a Smart Component.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Product codes, names, and prices
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Convert to components in bulk
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Map columns to component fields
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Fine-tune each component after conversion
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#FF6B35]/10 px-3 py-1 text-xs font-semibold text-[#BD4A1A]">Library</span>
                <h3 className="text-lg font-semibold">Ready-made components</h3>
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                A full set of Smart Components™ created by a supplier. Each component includes measurement type, pricing, waste rules, and labour rates. Import and use immediately - no conversion needed.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Full Smart Components™, ready to use
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Measurement types, waste, and labour included
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Import directly into your account
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Adjust prices for trade discount or markup
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Catalog to component converter */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Catalog to component converter</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            The catalog to component converter is a bulk import tool. Open a supplier catalog (CSV) or one of your own uploaded catalogs, and the converter shows you each row. You select which columns map to which component fields - name, price, product code, measurement type - and the converter creates Smart Components™ from every row at once.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            This is a massive time saver when a supplier sends you a price list with dozens or hundreds of items. Instead of adding each component one by one, you convert the whole catalog in one pass, then fine-tune individual components as needed. Set the measurement type, adjust waste allowances, add labour rates - all after the initial bulk conversion.
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
            Contractors who need pricing data to quote accurately. If you&apos;re new to a market, working with a new supplier, or simply don&apos;t have your own pricing library built up yet, supplier resources give you real, current pricing to start quoting with immediately.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            Also for contractors who receive supplier price lists as PDFs or spreadsheets. Instead of manually entering each item, import the catalog and convert it to Smart Components™ in one pass.
          </p>
        </section>

        {/* What it solves */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What problem it solves</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No baseline pricing</h3>
              <p className="mt-2 text-sm text-zinc-600">New contractors or contractors entering a new market don&apos;t have pricing data. Supplier resources provide real, current pricing to start quoting from day one.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Manual price list entry</h3>
              <p className="mt-2 text-sm text-zinc-600">Receiving a supplier price list and typing each item into your quoting tool takes hours. The catalog converter does it in seconds.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Outdated pricing</h3>
              <p className="mt-2 text-sm text-zinc-600">Supplier pricing changes. When a supplier updates their component library or catalog on QuoteCore+, you can re-import to get the latest prices.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Finding suppliers</h3>
              <p className="mt-2 text-sm text-zinc-600">Searching for suppliers in a new area means phone calls and emails. Supplier resources lets you search by area and see who has published pricing.</p>
            </div>
          </div>
        </section>

        {/* Supported inputs and outputs */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Supported inputs and outputs</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Inputs</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                <li>- Supplier CSV catalogs (product code, name, price)</li>
                <li>- Supplier component libraries (full Smart Components)</li>
                <li>- Search by area or product type</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Outputs</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                <li>- Imported Smart Components in your account</li>
                <li>- Converted components from CSV catalog rows</li>
                <li>- Searchable supplier directory</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Honest limitations */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What it does not do</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No live price syncing</h3>
              <p className="mt-2 text-sm text-zinc-600">Supplier catalogs are snapshots at import time. Prices do not auto-update. You can re-import when a supplier publishes updated data.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No direct supplier ordering</h3>
              <p className="mt-2 text-sm text-zinc-600">You import supplier pricing into your components, but orders are generated as documents. QuoteCore+ does not place live orders into supplier systems.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Catalog coverage depends on suppliers</h3>
              <p className="mt-2 text-sm text-zinc-600">Supplier resources are only available for suppliers who have published their catalogs or component libraries on QuoteCore+. Coverage grows as more suppliers join.</p>
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
              <h3 className="font-semibold text-slate-900">Smart Components™</h3>
              <p className="mt-1 text-sm text-zinc-600">Imported supplier components become Smart Components™ in your account.</p>
            </Link>
            <Link href="/suppliers" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">For suppliers</h3>
              <p className="mt-1 text-sm text-zinc-600">Are you a supplier? Publish your catalog and reach contractors who order every day.</p>
            </Link>
            <Link href="/features/digital-roof-takeoff" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Digital roof takeoff</h3>
              <p className="mt-1 text-sm text-zinc-600">Measure the job, then quote with supplier-sourced components.</p>
            </Link>
            <Link href="/features/material-ordering" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Material ordering</h3>
              <p className="mt-1 text-sm text-zinc-600">Order materials from the same suppliers whose components you imported.</p>
            </Link>
            <Link href="/pricing" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Pricing</h3>
              <p className="mt-1 text-sm text-zinc-600">Compare plans and start a 14-day free trial.</p>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try supplier resources free</h2>
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
