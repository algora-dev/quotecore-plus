import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { getSupplierDirectory, type SupplierDirectoryEntry } from "@/lib/supplier-directory";

export const metadata: Metadata = {
  title: "Roofing Supplier Directory",
  description:
    "Browse roofing suppliers with authorised pricing on QuoteCore+. Compare service areas, product categories, and catalogue coverage. Calculate roof takeoffs using real supplier pricing.",
  alternates: {
    canonical: "https://quote-core.com/suppliers",
  },
  openGraph: {
    title: "Roofing Supplier Directory",
    description:
      "Browse roofing suppliers with authorised pricing on QuoteCore+. Compare service areas, product categories, and catalogue coverage.",
    url: "https://quote-core.com/suppliers",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Roofing Supplier Directory",
    description:
      "Browse roofing suppliers with authorised pricing on QuoteCore+. Compare service areas and product categories.",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://quote-core.com/" },
    { "@type": "ListItem", position: 2, name: "Supplier Directory", item: "https://quote-core.com/suppliers" },
  ],
};

const itemListSchema = (suppliers: SupplierDirectoryEntry[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: suppliers.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: s.supplier_name,
    url: `https://quote-core.com/suppliers/${s.slug}`,
  })),
});

function SupplierCard({ supplier }: { supplier: SupplierDirectoryEntry }) {
  const locations = [
    supplier.branch_city,
    supplier.branch_region,
    supplier.branch_country,
  ].filter(Boolean).join(", ");

  return (
    <Link
      href={`/suppliers/${supplier.slug}`}
      className="group block rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-zinc-950 group-hover:text-[#BD4A1A]">
            {supplier.supplier_name}
          </h3>
          {supplier.description && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
              {supplier.description}
            </p>
          )}
        </div>
        {supplier.logo_url && (
          <img
            src={supplier.logo_url}
            alt={`${supplier.supplier_name} logo`}
            className="h-12 w-12 shrink-0 rounded-lg object-contain"
            loading="lazy"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {supplier.calculator_available && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/10 px-2.5 py-1 text-xs font-medium text-[#BD4A1A]">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Calculator available
          </span>
        )}
        {supplier.product_categories?.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
          >
            {cat}
          </span>
        ))}
      </div>

      {(locations || supplier.service_areas?.length) && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {locations || supplier.service_areas?.join(", ")}
        </div>
      )}
    </Link>
  );
}

export default async function SupplierDirectoryPage() {
  const suppliers = await getSupplierDirectory();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {suppliers.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema(suppliers)) }}
        />
      )}

      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.10),transparent_34%)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center md:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
              Supplier Directory
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Roofing suppliers with authorised pricing
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-600 sm:text-lg md:text-xl">
              Browse suppliers publishing their roofing material catalogues on QuoteCore+. Calculate roof takeoffs using real supplier pricing — then contact the supplier directly.
            </p>
          </div>
        </section>

        {/* Directory */}
        <section className="pb-20">
          <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
            {suppliers.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-16 text-center">
                <h2 className="text-lg font-semibold text-zinc-950">No suppliers published yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                  Suppliers are being onboarded. If you supply roofing materials and want to be listed here,{" "}
                  <Link href="/supplier-partnership" className="font-medium text-[#BD4A1A] underline">
                    get in touch
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {suppliers.length} {suppliers.length === 1 ? "supplier" : "suppliers"} found
                  </p>
                  <Link
                    href="/supplier-partnership"
                    className="text-sm font-medium text-[#BD4A1A] hover:underline"
                  >
                    Are you a supplier? →
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {suppliers.map((supplier) => (
                    <SupplierCard key={supplier.slug} supplier={supplier} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-200 bg-zinc-50 py-16">
          <div className="mx-auto max-w-4xl px-4 text-center md:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Are you a roofing supplier?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-600">
              Get your catalogue in front of contractors who quote, order, and buy materials every day.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/supplier-partnership"
                className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
              >
                Learn about supplier partnership
              </Link>
              <Link
                href="/suppliers-info"
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-100 transition"
              >
                Supplier info
              </Link>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
