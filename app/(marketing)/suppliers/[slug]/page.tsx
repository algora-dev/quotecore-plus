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

// Country code mapping for short display in titles
const COUNTRY_CODES: Record<string, string> = {
  NZ: 'NZ', AU: 'AU', GB: 'UK', US: 'US', CA: 'CA', IE: 'IE',
};

/** Build an SEO-optimised title: [Name] — [Types] in [City], [Country] | QuoteCore+ */
function buildSeoTitle(s: SupplierDetail['supplier']): string {
  const parts: string[] = [s.supplier_name, '—'];

  // Roofing types (first 2-3, joined with &)
  if (s.roofing_types?.length) {
    const types = s.roofing_types.slice(0, 3).map(t =>
      t.replace(/ Roofing$/i, '').replace(/All Roofing/i, 'Roofing')
    );
    parts.push(types.length > 1
      ? `${types.slice(0, -1).join(', ')} & ${types[types.length - 1]} Roofing Supplies`
      : `${types[0]} Roofing Supplies`
    );
  } else {
    parts.push('Roofing Supplies');
  }

  // Location
  if (s.branch_city) {
    if (s.branch_country) {
      const code = COUNTRY_CODES[s.branch_country] || s.branch_country;
      parts.push(`in ${s.branch_city}, ${code}`);
    } else {
      parts.push('in', s.branch_city);
    }
  } else if (s.branch_country) {
    const code = COUNTRY_CODES[s.branch_country] || s.branch_country;
    parts.push('in', code);
  }

  parts.push('| QuoteCore+');
  return parts.join(' ');
}

/** Build a search-intent meta description */
function buildMetaDescription(s: SupplierDetail['supplier']): string {
  const locationParts = [s.branch_city, s.branch_region].filter(Boolean);
  const location = locationParts.length ? locationParts.join(', ') : (s.branch_country || 'your area');

  const types = s.roofing_types?.length
    ? s.roofing_types.slice(0, 3).map(t => t.toLowerCase()).join(', ')
    : 'roofing';

  return `Roofing supplies in ${location}. Browse ${s.supplier_name}'s ${types} catalogue and calculate material costs free with the QuoteCore+ takeoff builder.`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicSupplier(slug);

  if (!data || !data.eligibility.page_visible) {
    return {
      title: "Supplier Not Found ",
      robots: { index: false, follow: false },
    };
  }

  const s = data.supplier;
  const title = buildSeoTitle(s);
  const description = buildMetaDescription(s);

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
    "@id": `https://quote-core.com/suppliers/${s.slug}#business`,
    name: s.supplier_name,
    url: `https://quote-core.com/suppliers/${s.slug}`,
  };

  if (s.description) org.description = s.description;
  if (s.logo_url) org.logo = s.logo_url;
  org.image = s.banner_url || s.logo_url || undefined;

  if (s.branch_city || s.branch_region || s.branch_country) {
    const addr: Record<string, unknown> = { "@type": "PostalAddress" };
    if (s.branch_city) addr.addressLocality = s.branch_city;
    if (s.branch_region) addr.addressRegion = s.branch_region;
    if (s.branch_postcode) addr.postalCode = s.branch_postcode;
    if (s.branch_country) addr.addressCountry = s.branch_country;
    org.address = addr;
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

  if (s.currency) org.currenciesAccepted = s.currency;

  // OfferCatalog from roofing types
  if (s.roofing_types?.length) {
    org.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: "Roofing Materials",
      itemListElement: s.roofing_types.map((rt: string) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Product", name: rt },
        seller: { "@type": "Organization", name: s.supplier_name },
      })),
    };
  }

  // QuoteCore+ as the platform
  org.parentOrganization = {
    "@type": "Organization",
    name: "QuoteCore+",
    url: "https://quote-core.com/",
  };

  // Geo coordinates
  if (s.branch_latitude != null && s.branch_longitude != null) {
    org.geo = {
      "@type": "GeoCoordinates",
      latitude: s.branch_latitude,
      longitude: s.branch_longitude,
    };
  }

  // Opening hours
  if (s.opening_hours && Array.isArray(s.opening_hours) && (s.opening_hours as unknown[]).length > 0) {
    org.openingHoursSpecification = s.opening_hours;
  }

  // Price range
  if (s.price_range) {
    org.priceRange = s.price_range;
  }

  schemas.push(org);

  // FAQPage — dynamic from supplier data
  const faqs: { q: string; a: string }[] = [];
  if (s.roofing_types?.length) {
    faqs.push({
      q: `What roofing materials does ${s.supplier_name} supply?`,
      a: `${s.supplier_name} supplies ${s.roofing_types.map(t => t.toLowerCase()).join(', ')}${s.branch_city ? ` in ${s.branch_city}` : ''}${s.branch_region ? `, ${s.branch_region}` : ''}.`,
    });
  }
  const locParts = [s.branch_city, s.branch_region, s.branch_country].filter(Boolean);
  if (locParts.length) {
    const locStr = locParts.join(', ');
    const serveStr = s.service_areas?.length ? ` They serve ${s.service_areas.join(', ')}.` : '';
    faqs.push({
      q: `Where is ${s.supplier_name} located?`,
      a: `${s.supplier_name} is based in ${locStr}.${serveStr}`,
    });
  }
  faqs.push({
    q: `Can I see ${s.supplier_name}'s pricing online?`,
    a: `Yes. ${s.supplier_name} publishes an indicative pricing catalogue on QuoteCore+. You can browse their material prices and calculate roof takeoffs using their pricing — free, no signup required.`,
  });
  if (data.eligibility.calculator_available) {
    faqs.push({
      q: `Can I calculate a roof estimate using ${s.supplier_name}'s prices?`,
      a: `Yes. Use the free QuoteCore+ roof takeoff builder pre-configured with ${s.supplier_name}'s catalogue. Enter your roof measurements and get instant material quantities and indicative pricing.`,
    });
  }
  if (s.delivery_coverage?.length) {
    const deliveryDesc = s.delivery_coverage.includes('nationwide')
      ? `${s.supplier_name} provides nationwide delivery${s.branch_country ? ` across ${s.branch_country}` : ''}.`
      : `${s.supplier_name} provides ${s.delivery_coverage.map(d => d === 'local' ? 'local delivery' : d === 'regional' ? 'regional delivery' : d).join(' and ')}${s.service_areas?.length ? ` in ${s.service_areas.join(', ')}` : ''}.`;
    faqs.push({ q: `Does ${s.supplier_name} deliver?`, a: deliveryDesc });
  }
  if (data.eligibility.contacts_visible && (s.phone_number || s.contact_email)) {
    const contactParts: string[] = [];
    if (s.phone_number) contactParts.push(`by phone at ${s.phone_number}`);
    if (s.contact_email) contactParts.push(`by email at ${s.contact_email}`);
    if (s.website_url) contactParts.push(`via their website at ${s.website_url}`);
    faqs.push({
      q: `How do I contact ${s.supplier_name}?`,
      a: `You can reach ${s.supplier_name} ${contactParts.join(', ')}.`,
    });
  }
  if (faqs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  // WebApplication — free roof takeoff calculator
  if (data.eligibility.calculator_available) {
    const calcSlug = s.slug;
    schemas.push({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": `${s.supplier_name} Roof Takeoff Builder`,
      "url": `https://quote-core.com/free-roofing-takeoff-builder/${calcSlug}`,
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "browserRequirements": "Requires JavaScript. Requires a modern web browser.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": s.currency || "USD",
        "description": "Free roof takeoff calculator using supplier catalogue pricing",
      },
      "publisher": {
        "@type": "Organization",
        "name": "QuoteCore+",
        "url": "https://quote-core.com/",
      },
      "about": {
        "@type": "Thing",
        "name": "Roofing material takeoff and estimation",
      },
      "isAccessibleForFree": true,
    });
  }

  return schemas;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-4 py-3 border-b border-slate-100 last:border-0">
      <dt className="w-28 sm:w-36 shrink-0 text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-zinc-950 flex-1">{value}</dd>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] | null | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="flex items-baseline gap-4 py-3 border-b border-slate-100 last:border-0">
      <dt className="w-28 sm:w-36 shrink-0 text-sm font-medium text-slate-500">{label}</dt>
      <dd className="flex flex-wrap gap-1.5 flex-1">
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
        <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-zinc-950">Home</Link>
            <span>/</span>
            <Link href="/suppliers" className="hover:text-zinc-950">Suppliers</Link>
            <span>/</span>
            <span className="text-zinc-950">{s.supplier_name}</span>
          </nav>
        </div>

        {/* Banner image — static override for demo suppliers, DB URL otherwise */}
        {(() => {
          const staticBanners: Record<string, string> = {
            'rs-roofing': '/images/suppliers/rs-roofing-banner-v2.png',
          };
          const bannerSrc = staticBanners[s.slug] || s.banner_url;
          if (!bannerSrc) return null;
          return (
            <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 pt-6">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                <img
                  src={bannerSrc}
                  alt={`${s.supplier_name} banner`}
                  className="w-full h-auto block object-contain"
                />
              </div>
            </div>
          );
        })()}

        {/* 1. Supplier header — logo, name, location, verification badge */}
        <section className="pb-6 pt-8">
          <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              {(() => {
                const staticLogos: Record<string, string> = {
                  'rs-roofing': '/images/suppliers/rs-roofing-logo.png',
                };
                const logoSrc = staticLogos[s.slug] || s.logo_url;
                if (!logoSrc) return null;
                return (
                  <img
                    src={logoSrc}
                    alt={`${s.supplier_name} logo`}
                    className="h-16 w-16 shrink-0 rounded-xl object-contain border border-slate-200"
                  />
                );
              })()}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                    {s.supplier_name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verified supplier
                  </span>
                </div>
                {locationString && (
                  <p className="mt-2 text-sm text-slate-500">{locationString}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Supplier-managed page trust panel */}
        <section className="pb-6">
          <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
            <div className="rounded-xl border border-slate-200 bg-zinc-50 px-5 py-4">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950">Supplier-managed page</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    This page is managed by {s.supplier_name} through its verified QuoteCore+ supplier account. The business has provided or linked all company information, catalogue data, service areas, delivery details, contact information, branding, and pricing shown on this page.
                  </p>
                </div>
              </div>
              {/* Catalogue metadata row */}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                <span>Verification: <span className="text-emerald-600">Verified</span></span>
                {lib?.published_version != null && (
                  <span>Catalogue version: {lib.published_version}</span>
                )}
                {s.pricing_updated_at && (
                  <span>Catalogue uploaded: {new Date(s.pricing_updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                )}
                {s.price_valid_until && (
                  <span>Valid until: {new Date(s.price_valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                )}
                {s.publication_updated_at && (
                  <span>Last updated: {new Date(s.publication_updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                )}
              </div>
              {/* Pricing notice */}
              <p className="mt-3 text-xs text-slate-500 border-t border-slate-200 pt-2">
                Published prices are provided by the supplier and may remain subject to stock availability, delivery charges, order acceptance, and final supplier confirmation.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Main calculator action */}
        {calculatorUrl && (
          <section className="pb-8">
            <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
              <div className="rounded-2xl border border-slate-200 bg-zinc-50 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                  Calculate roof costs with {s.supplier_name} pricing
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* 4. Catalogue status and validity information */}
        <section className="pb-8">
          <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
            {data.eligibility.prices_on_page ? (
              <div className="rounded-xl border border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-zinc-950">Catalogue status</h2>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-slate-600">
                  {lib?.published_version != null && (
                    <span>Version: <span className="font-medium text-zinc-950">{lib.published_version}</span></span>
                  )}
                  {s.currency && (
                    <span>Currency: <span className="font-medium text-zinc-950">{s.currency}</span></span>
                  )}
                  {s.pricing_updated_at && (
                    <span>Uploaded: <span className="font-medium text-zinc-950">{new Date(s.pricing_updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></span>
                  )}
                  {s.price_valid_until && (
                    <span>Valid until: <span className="font-medium text-zinc-950">{new Date(s.price_valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></span>
                  )}
                  {s.price_type && (
                    <span>Type: <span className="font-medium text-zinc-950">{s.price_type === "indicative" ? "Indicative supplier pricing" : s.price_type}</span></span>
                  )}
                </div>
                {s.tax_treatment && s.tax_treatment !== 'not_applicable' && (
                  <p className="mt-2 text-xs text-slate-500">
                    {s.tax_treatment === 'inclusive'
                      ? `Prices include ${s.tax_name ?? 'tax'}${s.tax_rate != null ? ` (${s.tax_rate}%)` : ''}`
                      : 'Prices exclude tax'}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 px-5 py-4">
                <p className="text-sm text-slate-500">Pricing catalogue is not publicly visible for this supplier.</p>
              </div>
            )}
          </div>
        </section>

        {/* 5. Business description */}
        {s.description && (
          <section className="pb-8">
            <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
              <h2 className="text-xl font-semibold text-zinc-950 mb-3">About {s.supplier_name}</h2>
              <p className="text-base text-zinc-600 max-w-3xl">{s.description}</p>
            </div>
          </section>
        )}

        {/* 6. Product types */}
        {(s.roofing_types?.length || s.product_categories?.length || s.brands?.length) ? (
          <section className="pb-8">
            <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
              <h2 className="text-xl font-semibold text-zinc-950 mb-4">Products</h2>
              <dl className="rounded-xl border border-slate-200 px-5">
                <TagList label="Roofing types" items={s.roofing_types} />
                <TagList label="Product categories" items={s.product_categories} />
                <TagList label="Brands" items={s.brands} />
              </dl>
            </div>
          </section>
        ) : null}

        {/* 7. Searchable catalogue table (link) + 8. CSV/JSON downloads */}
        {data.eligibility.prices_on_page && (
          <section className="pb-8">
            <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-950">Product catalogue</h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      Browse {s.supplier_name}'s full product catalogue with pricing. Search, sort, and download.
                    </p>
                  </div>
                  <Link
                    href={`/suppliers/${s.slug}/catalogue`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
                  >
                    View catalogue
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
                {/* Download links */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={`/suppliers/${s.slug}/catalogue.csv`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download CSV
                  </a>
                  <a
                    href={`/suppliers/${s.slug}/catalogue.json`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download JSON
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Takeoff library info (kept — relevant to calculator) */}
        {lib && (
          <section className="pb-8">
            <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
              <div className="rounded-xl border border-slate-200 p-5">
                <h2 className="text-base font-semibold text-zinc-950">Takeoff library</h2>
                <p className="mt-1 text-sm font-medium text-zinc-950">{lib.name || "Published library"}</p>
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
                {lib.roofing_types && lib.roofing_types.length > 0 && <TagList label="Roofing types" items={lib.roofing_types} />}
                {lib.product_categories && lib.product_categories.length > 0 && <TagList label="Product categories" items={lib.product_categories} />}
                {lib.brands && lib.brands.length > 0 && <TagList label="Brands" items={lib.brands} />}
                {s.takeoff_library_includes_tax === true && s.tax_treatment && s.tax_treatment !== 'not_applicable' && (
                  <p className="mt-3 text-xs text-emerald-600">Library prices include {s.tax_name ?? 'tax'}{s.tax_rate != null ? ` (${s.tax_rate}%)` : ''}</p>
                )}
                {s.takeoff_library_includes_tax === false && s.tax_treatment && s.tax_treatment !== 'not_applicable' && (
                  <p className="mt-3 text-xs text-amber-600">Library prices exclude tax</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Price list download (legacy upload — kept if supplier has one) */}
        {s.price_list_url && (
          <section className="pb-8">
            <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
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
          </section>
        )}

        {/* 9. Service areas and delivery areas */}
        <section className="pb-8">
          <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
            <h2 className="text-xl font-semibold text-zinc-950 mb-4">Service &amp; delivery areas</h2>
            <dl className="rounded-xl border border-slate-200 px-5">
              <TagList label="Service areas" items={s.service_areas} />
              {s.delivery_coverage && Array.isArray(s.delivery_coverage) && s.delivery_coverage.length > 0 ? (
                <div className="flex items-baseline gap-4 py-3 border-b border-slate-100 last:border-0">
                  <dt className="w-28 sm:w-36 shrink-0 text-sm font-medium text-slate-500">Delivery</dt>
                  <dd className="flex flex-wrap gap-1.5 flex-1">
                    {s.delivery_coverage.map((d: string) => (
                      <span key={d} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-600">
                        {d === 'nationwide' ? 'Nationwide delivery' : d === 'regional' ? 'State/Province delivery' : d === 'local' ? 'City-wide delivery' : d === 'pickup_only' ? 'Pick up' : d}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : (
                <div className="flex items-baseline gap-4 py-3 border-b border-slate-100 last:border-0">
                  <dt className="w-28 sm:w-36 shrink-0 text-sm font-medium text-slate-500">Delivery</dt>
                  <dd className="text-sm text-slate-600 flex-1">Pick up only</dd>
                </div>
              )}
              {s.delivery_assumptions && <InfoRow label="Delivery notes" value={s.delivery_assumptions} />}
              {s.exclusions && <InfoRow label="Exclusions" value={s.exclusions} />}
              {s.national_coverage && (
                <div className="py-3 border-b border-slate-100 last:border-0">
                  <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">National coverage</span>
                </div>
              )}
            </dl>
          </div>
        </section>

        {/* 10. Physical address and contact information */}
        <section className="pb-12">
          <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              {/* Address */}
              <div>
                <h2 className="text-xl font-semibold text-zinc-950 mb-4">Address</h2>
                {locationString ? (
                  <div className="rounded-xl border border-slate-200 p-5">
                    <dl className="space-y-1">
                      {s.supplier_name && <InfoRow label="Business" value={s.supplier_name} />}
                      {s.branch_city && <InfoRow label="City" value={s.branch_city} />}
                      {s.branch_region && <InfoRow label="Region" value={s.branch_region} />}
                      {s.branch_postcode && <InfoRow label="Postal code" value={s.branch_postcode} />}
                      {s.branch_country && <InfoRow label="Country" value={s.branch_country} />}
                    </dl>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 p-5">
                    <p className="text-sm text-slate-500">Address not publicly available. This supplier may be a service-area business.</p>
                  </div>
                )}
              </div>

              {/* Contact */}
              <div>
                <h2 className="text-xl font-semibold text-zinc-950 mb-4">Contact</h2>
                <div className="rounded-xl border border-slate-200 bg-zinc-50 p-5">
                  {data.eligibility.contacts_visible ? (
                    <div className="space-y-3 text-sm">
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
                    <p className="text-sm text-slate-500">Contact details not publicly available.</p>
                  )}
                  <div className="mt-6 border-t border-slate-200 pt-4 space-y-1.5 text-xs text-slate-500">
                    <p>Last updated: {new Date(s.publication_updated_at || s.pricing_updated_at || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    <p>Platform: QuoteCore+</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Related Resources */}
        <section className="border-t border-zinc-200 py-12">
          <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
            <h2 className="text-lg font-semibold text-zinc-950 mb-6">Related Resources</h2>
            <div className="grid grid-cols-1 gap-6 sm:gap-8 sm:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 mb-3">Free Tools</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/free-roof-pitch-calculator" className="text-[#BD4A1A] hover:underline">Roof Pitch Calculator</Link></li>
                  <li><Link href="/free-roofing-calculator" className="text-[#BD4A1A] hover:underline">Roofing Calculator</Link></li>
                  <li><Link href="/free-tools" className="text-[#BD4A1A] hover:underline">All Free Tools</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 mb-3">Guides</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/blog/how-to-measure-a-roof" className="text-[#BD4A1A] hover:underline">How to Measure a Roof</Link></li>
                  <li><Link href="/blog/how-to-price-a-roofing-job" className="text-[#BD4A1A] hover:underline">How to Price a Roofing Job</Link></li>
                  <li><Link href="/blog/best-free-tools-for-roofers" className="text-[#BD4A1A] hover:underline">Best Free Tools for Roofers</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 mb-3">QuoteCore+</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/roofing-quoting-software" className="text-[#BD4A1A] hover:underline">Roofing Quoting Software</Link></li>
                  <li><Link href="/free-trial" className="text-[#BD4A1A] hover:underline">Start Free Trial</Link></li>
                  <li><Link href="/suppliers" className="text-[#BD4A1A] hover:underline">Browse All Suppliers</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Compact agent payload for AI crawlers */}
        <script
          type="application/json"
          id="agent-payload"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            schemaVersion: '1.0',
            supplier: {
              slug: s.slug,
              name: s.supplier_name,
              supplierPageUrl: `https://quote-core.com/suppliers/${s.slug}`,
              calculatorUrl: calculatorUrl ? `https://quote-core.com${calculatorUrl}` : null,
            },
            location: {
              city: s.branch_city,
              region: s.branch_region,
              country: s.branch_country,
              serviceAreas: s.service_areas,
            },
            products: {
              roofingTypes: s.roofing_types,
              currency: s.currency,
              pricingType: s.price_type,
              pricingUpdatedAt: s.pricing_updated_at,
              priceValidUntil: s.price_valid_until,
            },
            workflow: {
              step1: 'This supplier has a calculator at the calculatorUrl above',
              step2: 'Visit the calculator page for full AI workflow instructions and API endpoints',
            },
          }) }}
        />

        {/* Agent guidance */}
        <section className="border-t border-zinc-200 bg-zinc-50 py-12">
          <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
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
