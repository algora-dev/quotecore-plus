import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { getPublicSupplier } from "@/lib/supplier-directory";
import {
  getPublicSupplierCatalogueByVersion,
  getCatalogueVersionHistory,
  getOrderedColumns,
  columnLabel,
  normalizeColumn,
  type CatalogueItem,
} from "@/lib/supplier-catalogue";
import { CatalogueSearchBar, CataloguePagination } from "../../catalogue/CatalogueControls";

interface PageProps {
  params: Promise<{ slug: string; version: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, version } = await params;
  const versionNum = parseInt(version, 10);
  if (isNaN(versionNum)) return { title: "Invalid Version", robots: { index: false, follow: false } };

  const data = await getPublicSupplier(slug);
  if (!data || !data.eligibility.page_visible) {
    return { title: "Catalogue Not Found", robots: { index: false, follow: false } };
  }

  const title = `${data.supplier.supplier_name} — Catalogue v${versionNum} | Quote Core+`;
  const description = `Version ${versionNum} of ${data.supplier.supplier_name}'s product catalogue with pricing. Download as CSV or JSON.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://quote-core.com/suppliers/${slug}/catalogues/${versionNum}`,
    },
    openGraph: {
      title,
      description,
      url: `https://quote-core.com/suppliers/${slug}/catalogues/${versionNum}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

function sortByColumn(items: CatalogueItem[], column: string, dir: "asc" | "desc"): CatalogueItem[] {
  const sorted = [...items].sort((a, b) => {
    const av = a.raw_row[column] ?? "";
    const bv = b.raw_row[column] ?? "";
    const an = parseFloat(av.replace(/[^0-9.\-]/g, ""));
    const bn = parseFloat(bv.replace(/[^0-9.\-]/g, ""));
    if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
    return av.localeCompare(bv);
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

function filterByQuery(items: CatalogueItem[], query: string): CatalogueItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter((item) => Object.values(item.raw_row).some((v) => v?.toLowerCase().includes(q)));
}

export default async function VersionedCataloguePage({ params, searchParams }: PageProps) {
  const { slug, version } = await params;
  const versionNum = parseInt(version, 10);
  if (isNaN(versionNum) || versionNum < 1) notFound();

  const sp = await searchParams;
  const page = Math.max(1, parseInt((sp.page as string) ?? "1", 10));
  const search = (sp.q as string) ?? "";
  const sortCol = (sp.sort as string) ?? "";
  const sortDir = (sp.dir as string) === "desc" ? "desc" : "asc";

  const data = await getPublicSupplier(slug);
  if (!data || !data.eligibility.page_visible) notFound();

  const offset = (page - 1) * PAGE_SIZE;
  const cat = await getPublicSupplierCatalogueByVersion(slug, versionNum, PAGE_SIZE, offset);

  if (!cat || !cat.catalogue || cat.catalogue.version !== versionNum) {
    notFound();
  }

  const s = data.supplier;
  const totalItems = cat.catalogue.total_items ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  let items = cat.items ?? [];
  items = filterByQuery(items, search);
  if (sortCol) items = sortByColumn(items, sortCol, sortDir);

  const columns = getOrderedColumns(items);
  const baseUrl = `https://quote-core.com/suppliers/${slug}`;

  // Versioned download URLs
  const csvUrl = `${baseUrl}/catalogues/${versionNum}/catalogue.csv`;
  const jsonUrl = `${baseUrl}/catalogues/${versionNum}/catalogue.json`;

  // Check if this is the latest version
  const history = await getCatalogueVersionHistory(slug);
  const latestVersion = history.length > 0 ? history[0].version : versionNum;
  const isLatest = versionNum === latestVersion;

  // Structured data
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://quote-core.com/" },
        { "@type": "ListItem", position: 2, name: "Supplier Directory", item: "https://quote-core.com/suppliers" },
        { "@type": "ListItem", position: 3, name: s.supplier_name, item: baseUrl },
        { "@type": "ListItem", position: 4, name: "Catalogue", item: `${baseUrl}/catalogue` },
        { "@type": "ListItem", position: 5, name: `Version ${versionNum}`, item: `${baseUrl}/catalogues/${versionNum}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${s.supplier_name} Product Catalogue v${versionNum}`,
      description: `Version ${versionNum} of ${s.supplier_name}'s product catalogue, published on QuoteCore+`,
      url: `${baseUrl}/catalogues/${versionNum}`,
      creator: { "@type": "Organization", name: s.supplier_name },
      publisher: { "@type": "Organization", name: "QuoteCore+" },
      version: versionNum,
      datePublished: cat.catalogue.uploaded_at ?? undefined,
      distribution: [
        { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: csvUrl },
        { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: jsonUrl },
      ],
    },
  ];

  return (
    <>
      <BlogHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
      />

      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-slate-500">
            <Link href="/suppliers" className="hover:text-slate-700">Suppliers</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/suppliers/${slug}`} className="hover:text-slate-700">{s.supplier_name}</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/suppliers/${slug}/catalogue`} className="hover:text-slate-700">Catalogue</Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-700">v{versionNum}</span>
          </nav>

          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-950">
                {s.supplier_name} — Catalogue v{versionNum}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {totalItems} products
                {cat.catalogue.uploaded_at && ` • Published ${new Date(cat.catalogue.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
                {cat.catalogue.currency && ` • ${cat.catalogue.currency}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={csvUrl} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                CSV
              </a>
              <a href={jsonUrl} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                JSON
              </a>
            </div>
          </div>

          {/* Version notice */}
          {!isLatest && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                This is version {versionNum} (historical). The <Link href={`/suppliers/${slug}/catalogue`} className="font-semibold underline">latest version ({latestVersion})</Link> may have updated pricing.
              </p>
            </div>
          )}

          {/* Pricing notice */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">
              Pricing is indicative and for estimation purposes only. Contact {s.supplier_name} for current pricing and availability.
            </p>
          </div>

          {/* Search */}
          <div className="mb-4">
            <CatalogueSearchBar supplierSlug={slug} initialQuery={search} versionedPath={`/suppliers/${slug}/catalogues/${versionNum}`} />
          </div>

          {/* Table */}
          {items.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {columns.map((col) => {
                      const norm = normalizeColumn(col);
                      const isSorted = sortCol === col;
                      const newDir = isSorted && sortDir === "asc" ? "desc" : "asc";
                      const sortHref = `/suppliers/${slug}/catalogues/${versionNum}?${new URLSearchParams({
                        ...(search ? { q: search } : {}),
                        sort: col,
                        dir: newDir,
                        ...(page > 1 ? { page: String(page) } : {}),
                      }).toString()}`;
                      return (
                        <th key={col} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          <a href={sortHref} className="inline-flex items-center gap-1 hover:text-slate-700">
                            {columnLabel(col)}
                            {isSorted && (sortDir === "asc" ? " ↑" : " ↓")}
                          </a>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-orange-50/40">
                      {columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                          {item.raw_row[col] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
              <p className="text-sm text-slate-500">
                {search ? `No products matching "${search}" in this version.` : "No products in this catalogue version."}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <CataloguePagination
                currentPage={page}
                totalPages={totalPages}
                basePath={`/suppliers/${slug}/catalogues/${versionNum}`}
                search={search}
                sort={sortCol}
                dir={sortDir}
              />
            </div>
          )}

          {/* Version history link */}
          <div className="mt-8 border-t border-slate-200 pt-4">
            <Link href={`/suppliers/${slug}/catalogue`} className="text-sm text-[#2563EB] hover:underline">
              ← Back to latest catalogue
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
