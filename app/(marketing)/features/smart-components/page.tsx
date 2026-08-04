import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Smart Components: Reusable Quoting Components | QuoteCore+",
  description:
    "Smart Components™ are reusable quoting components that know their own measurements, waste allowances, and pricing rules. Anything in your business can be a component. Build a roof quote in minutes, not hours.",
  alternates: {
    canonical: "https://quote-core.com/features/smart-components",
    languages: hreflangLanguages("/features/smart-components"),
  },
  openGraph: {
    title: "Smart Components: Reusable Quoting Components | QuoteCore+",
    description:
      "Reusable quoting components that know their own measurements, waste allowances, and pricing rules. Build a roof quote in minutes.",
    url: "https://quote-core.com/features/smart-components",
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
    { "@type": "ListItem", position: 3, name: "Smart Components", item: `${SITE_URL}/features/smart-components` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What are Smart Components in QuoteCore+?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Smart Components™ are reusable quoting components that store their own measurements, waste allowances, and pricing rules. Anything in your business - a product, a material, a service, a labour rate - can be a component. You create it once, then drop it into any quote. The component automatically calculates its own quantities and price.",
      },
    },
    {
      "@type": "Question",
      name: "What measurement types do Smart Components support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Smart Components™ support area-based measurements (square metres, square feet, roofing squares), linear measurements (metres, feet), volume, per-unit counts, and fixed-cost items. You choose the measurement type that fits the component, and it calculates accordingly.",
      },
    },
    {
      "@type": "Question",
      name: "Can I import components from my supplier's price list?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can import components from supplier catalogs and price lists. You can also search for supplier component libraries by area or product type and add them to your account. This gives you a baseline pricing source even if you don't have your own prices yet.",
      },
    },
    {
      "@type": "Question",
      name: "Can I create my own Smart Components?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can create Smart Components™ for any material, assembly, service, or workflow you use regularly. There is no limit to what can be a component - if it has a price and a measurement, it can be a Smart Component.",
      },
    },
  ],
};

const steps = [
  { num: 1, title: "Create or import a component", text: "Create a component from scratch, import one from a supplier's catalog, or search for a supplier component library and add it to your account. Anything goes - products, materials, services, labour rates." },
  { num: 2, title: "Set the measurement type and pricing", text: "Choose how the component is measured: area (square metres, square feet, roofing squares), linear length, volume, per unit, or fixed cost. Set the item cost, labour rate, and waste allowance." },
  { num: 3, title: "Drop it into a quote", text: "When building a quote, add the component to a roof section. The system measures the section, applies the component's rules, and calculates the quantity and price automatically - including pitch adjustments and waste." },
  { num: 4, title: "Quote repeats automatically", text: "Every future quote that uses the same component gets the same calculation. Update the component's price once, and every new quote uses the new price. Old quotes keep their original pricing." },
];

const faqs = [
  { q: "What are Smart Components™ in QuoteCore+?", a: "Smart Components™ are reusable quoting components that store their own measurements, waste allowances, and pricing rules. Anything in your business - a product, a material, a service, a labour rate - can be a component. You create it once, then drop it into any quote. The component automatically calculates its own quantities and price." },
  { q: "What measurement types do Smart Components™ support?", a: "Smart Components™ support area-based measurements (square metres, square feet, roofing squares), linear measurements (metres, feet), volume, per-unit counts, and fixed-cost items. You choose the measurement type that fits the component, and it calculates accordingly." },
  { q: "Can I import components from my supplier's price list?", a: "Yes. You can import components from supplier catalogs and price lists. You can also search for supplier component libraries by area or product type and add them to your account. This gives you a baseline pricing source even if you don't have your own prices yet." },
  { q: "Can I create my own Smart Components™?", a: "Yes. You can create Smart Components™ for any material, assembly, service, or workflow you use regularly. There is no limit to what can be a component - if it has a price and a measurement, it can be a Smart Component." },
];

export default function SmartComponentsPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
       <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features", href: "/features" }, { label: "Smart Components" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Feature</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Smart Components™: build a roof quote in minutes.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Reusable quoting components that know their own measurements, waste allowances, and pricing rules. Anything in your business - products, materials, services, labour - can be a component. Create once, use forever.
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

        {/* Screenshot showcase - quote view */}
        <section className="mx-auto max-w-5xl px-6 pb-8 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
              <div className="h-3 w-3 rounded-full bg-green-400/70" />
              <span className="ml-3 text-xs text-slate-500">QuoteCore+ - Quote Components</span>
            </div>
            <img
              src="/images/features/smart-components-quote.png"
              alt="QuoteCore+ Smart Components in a quote showing auto-calculated quantities, waste allowances, and pricing for roofing materials"
              className="w-full"
              loading="lazy"
            />
          </div>
        </section>

        {/* Screenshot showcase - admin view */}
        <section className="mx-auto max-w-5xl px-6 pb-16 lg:px-8">
          <p className="mb-4 text-center text-sm font-medium text-[#FF6B35]">Manage your component library</p>
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
              <div className="h-3 w-3 rounded-full bg-green-400/70" />
              <span className="ml-3 text-xs text-slate-500">QuoteCore+ - Smart Components™ Manager</span>
            </div>
            <img
              src="/images/features/smart-components-admin.png"
              alt="QuoteCore+ Smart Components management page showing component library with pricing, labour rates, waste allowances, and measurement types"
              className="w-full"
              loading="lazy"
            />
          </div>
          {/* Feature callouts */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Anything can be a component</h3>
              <p className="mt-1 text-sm text-zinc-600">Products, materials, services, labour rates, delivery fees - if it has a price and a measurement, it can be a Smart Component.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Multiple measurement types</h3>
              <p className="mt-1 text-sm text-zinc-600">Area (m2, sq ft, roofing squares), linear length (m, ft), volume, per unit, or fixed cost. Each component uses the type that fits.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10">
                <svg className="h-5 w-5 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Import from supplier catalogs</h3>
              <p className="mt-1 text-sm text-zinc-600">Search supplier component libraries by area or product type. Import pricing and components directly into your account.</p>
            </div>
          </div>
        </section>

        {/* What they are */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What are Smart Components™?</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Smart Components™ are the core building blocks of a QuoteCore+ quote. A Smart Component stores three things: what it is (a product, material, or service), how it is measured (area, linear length, volume, per unit, or fixed cost), and how it is priced. When you add a Smart Component to a roof section in a quote, it looks at the section&apos;s dimensions and calculates its own quantity and price automatically.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            There is no limit to what can be a component. A metal roofing sheet, a delivery fee, an hour of labour, a custom flashing - each one is a Smart Component that represents a piece of your business. Set it up once with its measurement type, pricing, and waste rules, and it calculates itself every time you quote.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            Measurement types are flexible. Area-based components can use square metres, square feet, or roofing squares. Linear components can use metres or feet. You pick the unit that matches how you work, and the component handles the conversions.
          </p>
        </section>

        {/* Supplier catalogs */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Import from supplier catalogs</h2>
          <p className="mt-4 leading-7 text-zinc-600">
            Don&apos;t have your own pricing yet? Smart Components™ can be imported from supplier catalogs and component libraries. Search by your area or by product type, find a supplier&apos;s library, and add it to your account. You get baseline pricing to start quoting with immediately.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            Suppliers can publish their catalogs publicly, so contractors anywhere can find and use real pricing. This means you can quote jobs accurately even if you&apos;re new to a market or working with a new supplier. Adjust the imported prices to match your trade discount or markup, and you&apos;re ready to go.
          </p>
          <div className="mt-6">
            <Link href="/suppliers-info" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">
              Learn about suppliers
            </Link>
          </div>
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
            Any contractor who quotes the same types of jobs repeatedly. If you find yourself looking up the same material prices, applying the same waste factors, and doing the same calculations for every quote, Smart Components™ eliminate that repetition.
          </p>
          <p className="mt-4 leading-7 text-zinc-600">
            Also for contractors who don&apos;t have established pricing yet. Import from a supplier catalog and start quoting with real prices from day one.
          </p>
        </section>

        {/* What it solves */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What problem it solves</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Repetitive calculations</h3>
              <p className="mt-2 text-sm text-zinc-600">Every roofer knows the formula for their materials. Smart Components™ store that formula so you never have to calculate it by hand again.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Inconsistent pricing</h3>
              <p className="mt-2 text-sm text-zinc-600">When prices change, update the component once. Every new quote uses the updated price. Old quotes keep their original pricing.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No baseline pricing</h3>
              <p className="mt-2 text-sm text-zinc-600">New contractors or contractors entering a new market can import supplier pricing and start quoting accurately from day one.</p>
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
                <li>- Component name and description</li>
                <li>- Measurement type (area, linear, volume, per unit, fixed cost)</li>
                <li>- Price per unit (in your chosen currency)</li>
                <li>- Waste allowance (percentage or fixed)</li>
                <li>- Labour rates (optional)</li>
                <li>- Product codes and supplier references</li>
                <li>- CSV catalogs from suppliers (bulk import)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Outputs</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                <li>- Priced line items in quotes</li>
                <li>- Material quantities with waste applied</li>
                <li>- Labour cost estimates</li>
                <li>- Material order line items</li>
                <li>- Invoice line items from accepted quotes</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Worked example */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Worked example: pricing a concrete tile roof</h2>
          <div className="mt-6 rounded-xl border border-slate-200 p-6">
            <p className="text-sm text-zinc-600">A contractor creates a Smart Component for a concrete interlocking tile:</p>
            <ol className="mt-4 space-y-3 text-sm text-zinc-600">
              <li><strong>1. Create:</strong> Name: "Concrete Tile (Marley Modern)". Measurement type: area. Price: $12/m2. Waste: 10%.</li>
              <li><strong>2. Attach to takeoff:</strong> The takeoff measures 180 m2 of roof area at 30-degree pitch.</li>
              <li><strong>3. Auto-calculate:</strong> Area with waste: 180 m2 x 1.10 = 198 m2. Material cost: 198 x $12 = $2,376.</li>
              <li><strong>4. Reuse:</strong> Next week, a different job has 95 m2 of roof. The same component is dropped in. No re-pricing, no re-calculating waste. The quote updates instantly.</li>
              <li><strong>5. Update pricing:</strong> Supplier raises the price to $13/m2. Update the component once. All new quotes use $13. Existing quotes keep $12.</li>
            </ol>
          </div>
        </section>

        {/* Honest limitations */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What it does not do</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No live supplier price syncing</h3>
              <p className="mt-2 text-sm text-zinc-600">Component prices are set by you. They do not auto-update from supplier systems. You can import supplier catalogs via CSV, but ongoing price changes require manual updates or re-importing.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">No multi-currency within a single quote</h3>
              <p className="mt-2 text-sm text-zinc-600">Each quote uses one currency. You can set your default currency, but quotes do not mix USD and GBP line items.</p>
            </div>
          </div>
        </section>

        {/* Less suitable use */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">When it may not be the right fit</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">You do the same quote every time</h3>
              <p className="mt-2 text-sm text-zinc-600">If you quote the same product with the same pricing on every job, a simple spreadsheet may be enough. Smart Components add the most value when you quote varied roof types, materials, and suppliers.</p>
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
              <p className="mt-1 text-sm text-zinc-600">Upload plans and measure digitally. Smart Components™ drop into the takeoff.</p>
            </Link>
            <Link href="/features/material-ordering" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Material ordering</h3>
              <p className="mt-1 text-sm text-zinc-600">Turn accepted quotes into material orders. Smart Components™ know what to order.</p>
            </Link>
            <Link href="/suppliers-info" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Supplier network</h3>
              <p className="mt-1 text-sm text-zinc-600">Suppliers publish catalogs. Contractors import pricing. Everyone wins.</p>
            </Link>
            <Link href="/roofing-quoting-software" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Roofing quoting software</h3>
              <p className="mt-1 text-sm text-zinc-600">The full roofing quote workflow, from measurement to invoice.</p>
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
            <h2 className="text-2xl font-semibold tracking-tight">Start building Smart Components™</h2>
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
