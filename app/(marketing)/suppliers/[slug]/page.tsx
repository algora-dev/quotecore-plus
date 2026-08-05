import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { getPublicSupplier, type SupplierDetail } from "@/lib/supplier-directory";
import { SupplierPageTracker, SupplierCalculatorClickTracker } from "@/components/SupplierAnalytics";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Force dynamic rendering — supplier publication state can change at any time,
// so we always SSR rather than serving stale static pages.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicSupplier(slug);

  if (!data || !data.eligibility.page_visible) {
    return {
      title: "Supplier Not Found | QuoteCore+",
      robots: { index: false, follow: false },
    };
  }

  const s = data.supplier;
  const title = `${s.supplier_name} ÔÇö Roofing Supplier | QuoteCore+`;
  const description = s.description
    ? `${s.description.slice(0, 155)}`
    : `Roofing supplier ${s.supplier_name} on QuoteCore+. Calculate roof takeoffs using authorised pricing.`;

  const robots = data.eligibility.indexable
    ? { index: true, follow: true }
    : { index: false, follow: true };

  return {
    title,
    description,
    alternates: {
      canonical: `https://quote-core.com/suppliers/${s.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://quote-core.com/suppliers/${s.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots,
  };
}

function buildStructuredData(data: SupplierDetail) {
  const s = data.supplier;
  const schemas: Record<string, unknown>[] = [];

  // Breadcrumb
  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://quote-core.com/" },
      { "@type": "ListItem", position: 2, name: "Supplier Directory", item: "https://quote-core.com/suppliers" },
      { "@type": "ListItem", position: 3, name: s.supplier_name, item: `https://quote-core.com/suppliers/${s.slug}` },
    ],
  });

  // Organization / LocalBusiness
  const org: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: s.supplier_name,
    url: `https://quote-core.com/suppliers/${s.slug}`,
  };

  if (s.description) org.description = s.description;
  if (s.logo_url) org.logo = s.logo_url;
  if (s.logo_url) org.image = s.logo_url;

  if (s.branch_city || s.branch_region || s.branch_country) {
    org.address = {
      "@type": "PostalAddress",
      addressLocality: s.branch_city || undefined,
      addressRegion: s.branch_region || undefined,
      addressCountry: s.branch_country || undefined,
    };
  }

  if (data.eligibility.contacts_visible) {
    if (s.phone_number) org.telephone = s.phone_number;
    if (s.contact_email) org.email = s.contact_email;
  }

  if (s.website_url) {
    org.sameAs = [s.website_url];
  }

  if (s.service_areas?.length) {
    org.areaServed = s.service_areas.map((area) => ({
      "@type": "Place",
      name: area,
    }));
  }

  // QuoteCore+ as the platform
  org.parentOrganization = {
    "@type": "Organization",
    name: "QuoteCore+",
    url: "https://quote-core.com/",
  };

  schemas.push(org);

  return schemas;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <dt className="w-40 shrink-0 text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-zinc-950">{value}</dd>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] | null | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="py-2 border-b border-slate-100 last:border-0">
      <dt className="text-sm font-medium text-slate-500 mb-1.5">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600"
          >
            {item}
          </span>
        ))}
      </dd>
    </div>
  );
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getPublicSupplier(slug);

  if (!data || !data.eligibility.page_visible) {
    notFound();
  }

  const s = data.supplier;
  const lib = data.library;
  const schemas = buildStructuredData(data);
  const calculatorUrl = data.eligibility.calculator_available
    ? `/free-roofing-takeoff-builder/${s.slug}`
    : null;

  const locationParts = [s.branch_city, s.branch_region, s.branch_country].filter(Boolean);
  const locationString = locationParts.join(", ");

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* Breadcrumb */}
        <div className="mx-auto max-w-5xl px-6 pt-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-zinc-950">Home</Link>
            <span>/</span>
            <Link href="/suppliers" className="hover:text-zinc-950">Suppliers</Link>
            <span>/</span>
            <span className="text-zinc-950">{s.supplier_name}</span>
          </nav>
        </div>

        {/* Banner image */}
        {s.banner_url && (
          <div className="mx-auto max-w-5xl px-6 lg:px-8 pt-6">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200">
              <img
                src={s.banner_url}
                alt={`${s.supplier_name} banner`}
                className="w-full h-48 sm:h-64 object-cover"
              />
            </div>
          </div>
        )}

        {/* Supplier header */}
        <section className="pb-8 pt-8">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="flex items-start gap-6">
              {s.logo_url && (
                <img
                  src={s.logo_url}
                  alt={`${s.supplier_name} logo`}
                  className="h-16 w-16 shrink-0 rounded-xl object-contain border border-slate-200"
                />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {s.supplier_name}
                </h1>
                {s.description && (
                  <p className="mt-3 text-lg text-zinc-600 max-w-3xl">{s.description}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {data.eligibility.calculator_available && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/10 px-2.5 py-1 text-xs font-medium text-[#BD4A1A]">
                      Calculator available
                    </span>
                  )}
                  {s.national_coverage && (
                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                      National coverage
                    </span>
                  )}
                  {s.freight_available && (
                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                      Freight available
                    </span>
                  )}
                  {s.pickup_available && (
                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                      Pickup available
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Calculator CTA */}
        {calculatorUrl && (
          <section className="pb-8">
            <div className="mx-auto max-w-5xl px-6 lg:px-8">
              <div className="rounded-2xl border border-slate-200 bg-zinc-50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    Calculate a roof using {s.supplier_name} pricing
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Use the QuoteCore+ takeoff builder with {s.supplier_name}'s authorised catalogue to get an accurate material estimate.
                  </p>
                </div>
                <Link
                  href={calculatorUrl}
                  data-track="supplier-calculator-cta"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
                >
                  Open calculator
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Supplier details */}
        <section className="pb-12">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left: main info */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold text-zinc-950 mb-4">Supplier information</h2>
                <dl>
                  {locationString && <InfoRow label="Location" value={locationString} />}
                  <TagList label="Service areas" items={s.service_areas} />
                  <TagList label="Roofing types" items={s.roofing_types} />
                  <TagList label="Product categories" items={s.product_categories} />
                  <TagList label="Brands" items={s.brands} />
                  {s.delivery_coverage && <InfoRow label="Delivery coverage" value={s.delivery_coverage} />}
                  {s.delivery_assumptions && <InfoRow label="Delivery assumptions" value={s.delivery_assumptions} />}
                  {s.exclusions && <InfoRow label="Exclusions" value={s.exclusions} />}
                  {s.tax_treatment && <InfoRow label="Tax treatment" value={s.tax_treatment} />}
                  {s.currency && <InfoRow label="Currency" value={s.currency} />}
                </dl>

                {/* Pricing info */}
                {data.eligibility.prices_on_page && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold text-zinc-950 mb-4">Pricing</h2>
                    <p className="text-sm text-zinc-600">
                      QuoteCore+ hosts {s.supplier_name}'s authorised pricing catalogue.
                      {s.pricing_updated_at && (
                        <> Last updated {new Date(s.pricing_updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</>
                      )}
                      {s.price_valid_until && (
                        <> Valid until {new Date(s.price_valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</>
                      )}
                    </p>
                    {s.price_type && (
                      <p className="mt-2 text-xs text-slate-500">
                        Pricing type: {s.price_type === "indicative" ? "Indicative ÔÇö sourced from publicly available supplier data" : s.price_type}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-slate-500">
                      Products cannot be purchased directly from QuoteCore+. Contact {s.supplier_name} directly after completing a takeoff.
                    </p>
                  </div>
                )}

                {/* Library info */}
                {lib && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold text-zinc-950 mb-4">Takeoff library</h2>
                    <div className="rounded-xl border border-slate-200 p-5">
                      <p className="text-sm font-medium text-zinc-950">{lib.name || "Published library"}</p>
                      {lib.description && (
                        <p className="mt-1 text-sm text-zinc-600">{lib.description}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {lib.published_version !== null && (
                          <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500">
                            Version {lib.published_version}
                          </span>
                        )}
                        {lib.published_at && (
                          <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500">
                            Published {new Date(lib.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      {lib.roofing_types?.length && <TagList label="Roofing types" items={lib.roofing_types} />}
                      {lib.product_categories?.length && <TagList label="Product categories" items={lib.product_categories} />}
                      {lib.brands?.length && <TagList label="Brands" items={lib.brands} />}
                    </div>
                  </div>
                )}

                {/* Price list download */}
                {s.price_list_url && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold text-zinc-950 mb-4">Price List</h2>
                    <div className="rounded-xl border border-slate-200 p-5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-medium text-zinc-950 truncate">{s.price_list_filename || "Price list"}</span>
                        </div>
                        {s.price_list_uploaded_at && (
                          <p className="text-xs text-slate-500 mt-1">Uploaded {new Date(s.price_list_uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                        )}
                      </div>
                      <a
                        href={s.price_list_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: contact + meta */}
              <div className="lg:col-span-1">
                <div className="rounded-xl border border-slate-200 bg-zinc-50 p-5 sticky top-6">
                  <h3 className="text-sm font-semibold text-zinc-950">Contact</h3>
                  {data.eligibility.contacts_visible ? (
                    <div className="mt-3 space-y-2 text-sm">
                      {s.phone_number && (
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-zinc-950">{s.phone_number}</span>
                        </div>
                      )}
                      {s.contact_email && (
                        <a href={`mailto:${s.contact_email}`} className="flex items-center gap-2 text-[#BD4A1A] hover:underline">
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>{s.contact_email}</span>
                        </a>
                      )}
                      {s.enquiry_email && s.enquiry_email !== s.contact_email && (
                        <a href={`mailto:${s.enquiry_email}`} className="flex items-center gap-2 text-[#BD4A1A] hover:underline">
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>Send enquiry</span>
                        </a>
                      )}
                      {s.website_url && (
                        <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#BD4A1A] hover:underline">
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          <span>Visit website</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Contact details not publicly available.</p>
                  )}

                  {/* Meta */}
                  <div className="mt-6 border-t border-slate-200 pt-4 space-y-1.5 text-xs text-slate-500">
                    {s.publication_updated_at && (
                      <p>Last updated: {new Date(s.publication_updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    )}
                    {s.pricing_updated_at && (
                      <p>Pricing updated: {new Date(s.pricing_updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    )}
                    <p>Platform: QuoteCore+</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Agent guidance */}
        <section className="border-t border-zinc-200 bg-zinc-50 py-12">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-lg font-semibold text-zinc-950">For AI agents</h2>
            <p className="mt-2 text-sm text-zinc-600 max-w-3xl">
              This page contains the current QuoteCore+ catalogue for {s.supplier_name}.
              {calculatorUrl ? (
                <> To calculate a roof using this supplier's pricing, open the{" "}
                <Link href={calculatorUrl} className="font-medium text-[#BD4A1A] underline">supplier calculator</Link>.
                The calculator page contains the complete workflow and machine-readable instructions required to generate and retrieve a result.</>
              ) : (
                <> No calculator is currently available for this supplier.</>
              )}
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
      <SupplierPageTracker supplierSlug={s.slug} supplierName={s.supplier_name} hasCalculator={!!calculatorUrl} pageType="supplier_detail" />
      {calculatorUrl && <SupplierCalculatorClickTracker supplierSlug={s.slug} supplierName={s.supplier_name} />}
    </>
  );
}
