import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
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
      "Turn an accepted quote into a material order in seconds. Quantities, codes, and supplier details flow straight from the quote.",
    href: "/features/material-ordering",
    keyword: "material ordering software",
    steps: ["Accept a quote", "Generate a material order", "Send to your supplier", "Track the order"],
  },
  {
    title: "Invoicing",
    description:
      "Turn accepted quotes into professional invoices with line items, payment instructions, and online payment tracking.",
    href: "/features/invoicing",
    keyword: "contractor invoicing software",
    steps: ["Accept a quote", "Generate an invoice", "Customer pays", "Track status"],
  },
  {
    title: "Supplier Resources",
    description:
      "Search supplier pricing catalogs and component libraries by area or product type. Import ready-made components or convert catalogs in bulk.",
    href: "/features/supplier-resources",
    keyword: "supplier pricing catalogs",
    steps: ["Search suppliers", "Browse catalogs and libraries", "Import or convert", "Quote with real pricing"],
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

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Try all features free for 14 days</h2>
            <p className="mt-2 text-zinc-600">No credit card required. Full access to every feature.</p>
            <a
              href="/free-trial"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
            >
              Start free trial
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
