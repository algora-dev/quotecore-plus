import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { getPublicSupplier } from "@/lib/supplier-directory";
import {
  getPublicSupplierCatalogue,
  getPublicSupplierCatalogueCount,
  getOrderedColumns,
  columnLabel,
  normalizeColumn,
  type CatalogueItem,
} from "@/lib/supplier-catalogue";
import { CatalogueSearchBar, CataloguePagination } from "./CatalogueControls";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicSupplier(slug);

  if (!data || !data.eligibility.page_visible) {
    return { title: "Catalogue Not Found", robots: { index: false, follow: false } };
  }

  const title = `${data.supplier.supplier_name} — Product Catalogue | QuoteCore+`;
  const description = `Browse ${data.supplier.supplier_name}'s roofing material catalogue with pricing. Download as CSV or JSON. Calculate roof takeoffs using their pricing.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://quote-core.com/suppliers/${slug}/catalogue`,
    },
    openGraph: {
      title,
      description,
      url: `https://quote-core.com/suppliers/${slug}/catalogue`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: data.eligibility.indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

function sortByColumn(
  items: CatalogueItem[],
  column: string,
  dir: "asc" | "desc",
): CatalogueItem[] {
  const sorted = [...items].sort((a, b) => {
    const av = a.raw_row[column] ?? "";
    const bv = b.raw_row[column] ?? "";

    // Try numeric comparison first
    const an = parseFloat(av.replace(/[^0-9.\-]/g, ""));
    const bn = parseFloat(bv.replace(/[^0-9.\-]/g, ""));
    if (!isNaN(an) && !isNaN(bn) && an !== bn) {
      return an - bn;
    }
    return av.localeCompare(bv);
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

function filterByQuery(items: CatalogueItem[], query: string): CatalogueItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter((item) =>
    Object.values(item.raw_row).some((v) => v?.toLowerCase().includes(q)),
  );
}

function buildStructuredData(
  supplierName: string,
  slug: string,
  catalogueVersion: number | null,
  currency: string | null,
  validFrom: string | null,
  validUntil: string | null,
  items: CatalogueItem[],
) {
  const baseUrl = `https://quote-core.com/suppliers/${slug}`;
  const schemas: Record<string, unknown>[] = [];

  // Breadcrumb
  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://quote-core.com/" },
      { "@type": "ListItem", position: 2, name: "Supplier Directory", item: "https://quote-core.com/suppliers" },
      { "@type": "ListItem", position: 3, name: supplierName, item: `${baseUrl}` },
      { "@type": "ListItem", position: 4, name: "Catalogue", item: `${baseUrl}/catalogue` },
    ],
  });

  // Dataset for the catalogue
  const dataset: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${supplierName} Product Catalogue`,
    description: `Product catalogue for ${supplierName}, published on QuoteCore+`,
    url: `${baseUrl}/catalogue`,
    creator: { "@type": "Organization", name: supplierName },
    publisher: { "@type": "Organization", name: "QuoteCore+" },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: `${baseUrl}/catalogues/${catalogueVersion ?? 1}/catalogue.csv`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${baseUrl}/catalogues/${catalogueVersion ?? 1}/catalogue.json`,
      },
    ],
  };

  if (catalogueVersion != null) dataset.version = String(catalogueVersion);
  if (currency) dataset.spatialCoverage = undefined; // no-op, just keeping structure clean

  if (validFrom || validUntil) {
    const temp: Record<string, unknown> = {};
    if (validFrom) temp.startDate = validFrom;
    if (validUntil) temp.endDate = validUntil;
    dataset.temporalCoverage = temp;
  }

  schemas.push(dataset);

  // Product + Offer schema for catalogue items (cap at 20 to avoid huge JSON-LD)
  const productLimit = Math.min(items.length, 20);
  if (productLimit > 0) {
    const offers: Record<string, unknown>[] = [];
    for (let i = 0; i < productLimit; i++) {
      const item = items[i];
      const row = item.raw_row;
      const productCode = row.supplier_product_code || row.sku || row.code || null;
      const productName = row.product_name || row.name || row.description || 'Product';
      const price = row.price != null ? String(row.price) : null;
      const productUrl = productCode
        ? `${baseUrl}/catalogue?product=${encodeURIComponent(String(productCode))}`
        : undefined;

      const offer: Record<string, unknown> = {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Product",
          "name": String(productName),
        },
        "seller": { "@type": "Organization", "name": supplierName },
      };
      if (productCode) {
        (offer.itemOffered as Record<string, unknown>).sku = String(productCode);
      }
      if (productUrl) {
        (offer.itemOffered as Record<string, unknown>).url = productUrl;
      }
      if (price && currency) {
        offer.price = price;
        offer.priceCurrency = currency;
        offer.availability = "https://schema.org/InStock";
      } else if (price) {
        offer.price = price;
        offer.priceCurrency = currency || "USD";
      }
      offers.push(offer);
    }

    schemas.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${supplierName} Catalogue Items`,
      url: `${baseUrl}/catalogue`,
      numberOfItems: items.length,
      itemListElement: offers.map((offer, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        item: offer,
      })),
    });
  }

  return schemas;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default async function CataloguePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  // Parse query params
  const query = typeof sp.q === "string" ? sp.q : "";
  const sortColumn = typeof sp.sort === "string" ? sp.sort : "";
  const sortDir = sp.dir === "desc" ? "desc" : "asc";
  const pageParam = typeof sp.page === "string" ? parseInt(sp.page, 10) : 1;
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Fetch supplier info
  const supplierData = await getPublicSupplier(slug);
  if (!supplierData || !supplierData.eligibility.page_visible) {
    notFound();
  }

  // Fetch total count
  const totalItems = await getPublicSupplierCatalogueCount(slug);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  // Fetch catalogue page
  const catalogue = await getPublicSupplierCatalogue(slug, PAGE_SIZE, offset);

  if (!catalogue) {
    // Supplier exists but no published catalogue
    return (
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold">{supplierData.supplier.supplier_name}</h1>
          <p className="mt-4 text-zinc-600">No published catalogue available yet.</p>
          <Link
            href={`/suppliers/${slug}`}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800"
          >
            ← Back to supplier page
          </Link>
        </div>
        <SiteFooter />
      </main>
    );
  }

  const s = supplierData.supplier;
  const cat = catalogue.catalogue;
  const items = catalogue.items;

  // Filter by search query
  const filtered = filterByQuery(items, query);

  // Sort
  const sorted = sortColumn ? sortByColumn(filtered, sortColumn, sortDir) : filtered;

  // Get ordered columns
  const columns = getOrderedColumns(items);

  // Build structured data
  const schemas = buildStructuredData(
    s.supplier_name,
    slug,
    cat.version,
    cat.currency,
    cat.valid_from,
    cat.valid_until,
    items,
  );

  // Column visibility: hide columns that have no data in the current page
  const columnsWithData = columns.filter((col) =>
    items.some((item) => {
      const val = item.raw_row[col];
      return val != null && val.trim() !== "";
    }),
  );

  const formatDateStr = formatDate;

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
        <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-zinc-950">Home</Link>
            <span>/</span>
            <Link href="/suppliers" className="hover:text-zinc-950">Suppliers</Link>
            <span>/</span>
            <Link href={`/suppliers/${slug}`} className="hover:text-zinc-950">{s.supplier_name}</Link>
            <span>/</span>
            <span className="text-zinc-950">Catalogue</span>
          </nav>
        </div>

        {/* Catalogue header */}
        <section className="pt-8 pb-6">
          <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {s.supplier_name} — Product Catalogue
            </h1>
            {cat.public_description && (
              <p className="mt-2 text-zinc-600 max-w-3xl">{cat.public_description}</p>
            )}

            {/* Catalogue metadata */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
              {cat.version != null && (
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs">
                  Version {cat.version}
                </span>
              )}
              {cat.currency && (
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs">
                  {cat.currency}
                </span>
              )}
              {formatDateStr(cat.uploaded_at) && (
                <span className="text-xs">Uploaded: {formatDateStr(cat.uploaded_at)}</span>
              )}
              {formatDateStr(cat.valid_from) && (
                <span className="text-xs">Valid from: {formatDateStr(cat.valid_from)}</span>
              )}
              {formatDateStr(cat.valid_until) && (
                <span className="text-xs">Valid until: {formatDateStr(cat.valid_until)}</span>
              )}
              <span className="text-xs">{totalItems} products</span>
            </div>

            {/* Pricing notice */}
            <p className="mt-3 text-xs text-slate-500 max-w-3xl">
              Published prices are provided by the supplier and may remain subject to stock availability, delivery charges, order acceptance, and final supplier confirmation.
            </p>
          </div>
        </section>

        {/* Download links */}
        <section className="pb-6">
          <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
            <div className="flex flex-wrap gap-3">
              <a
                href={`/suppliers/${slug}/catalogues/${cat.version ?? 1}/catalogue.csv`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV
              </a>
              <a
                href={`/suppliers/${slug}/catalogues/${cat.version ?? 1}/catalogue.json`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download JSON
              </a>
              <Link
                href={`/suppliers/${slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                ← Supplier page
              </Link>
            </div>
          </div>
        </section>

        {/* Catalogue table */}
        <section className="pb-12">
          <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {/* Search bar */}
              <div className="border-b border-slate-200 px-4 py-3 bg-zinc-50">
                <CatalogueSearchBar
                  supplierSlug={slug}
                  initialQuery={query}
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 w-12">#</th>
                      {columnsWithData.map((col) => {
                        const isSorted = sortColumn === col;
                        const isAsc = isSorted && sortDir === "asc";
                        return (
                          <th
                            key={col}
                            className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap"
                          >
                            <SortButton
                              column={col}
                              label={columnLabel(col)}
                              isActive={isSorted}
                              isAsc={isAsc}
                              supplierSlug={slug}
                            />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={columnsWithData.length + 1} className="px-4 py-12 text-center text-slate-500">
                          {query ? `No products matching "${query}"` : "No products in this catalogue"}
                        </td>
                      </tr>
                    ) : (
                      sorted.map((item, i) => (
                        <tr
                          key={item.row_index}
                          className="border-b border-slate-100 last:border-0 hover:bg-orange-50/40"
                        >
                          <td className="px-4 py-3 text-slate-400">
                            {offset + i + 1}
                          </td>
                          {columnsWithData.map((col) => (
                            <td key={col} className="px-4 py-3 text-zinc-950">
                              {item.raw_row[col] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <CataloguePagination
                currentPage={safePage}
                totalPages={totalPages}
                supplierSlug={slug}
              />
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}

// Sort link (server-rendered <a> — no client JS needed)
function SortButton({
  column,
  label,
  isActive,
  isAsc,
  supplierSlug,
}: {
  column: string;
  label: string;
  isActive: boolean;
  isAsc: boolean;
  supplierSlug: string;
}) {
  const params = new URLSearchParams();
  const newDir = isActive && isAsc ? "desc" : "asc";
  params.set("sort", column);
  params.set("dir", newDir);

  return (
    <a
      href={`/suppliers/${supplierSlug}/catalogue?${params.toString()}`}
      className={`inline-flex items-center gap-1 hover:text-zinc-950 ${isActive ? "text-[#BD4A1A]" : ""}`}
    >
      {label}
      {isActive && (
        <span className="text-xs">{isAsc ? "▲" : "▼"}</span>
      )}
    </a>
  );
}
