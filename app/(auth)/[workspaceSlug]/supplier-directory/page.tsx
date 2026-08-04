import { listDirectorySuppliers, searchSupplierLibraries, searchSupplierCatalogs } from './actions';
import { SupplierDirectory } from './SupplierDirectory';

export default async function SupplierDirectoryPage(props: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ q?: string; type?: string; brand?: string; cat?: string; location?: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const searchParams = await props.searchParams;

  const [suppliers, libraries, catalogs] = await Promise.all([
    listDirectorySuppliers(),
    searchSupplierLibraries({
      query: searchParams.q,
      roofingType: searchParams.type,
      brand: searchParams.brand,
      productCategory: searchParams.cat,
      location: searchParams.location,
    }),
    searchSupplierCatalogs({
      query: searchParams.q,
      roofingType: searchParams.type,
      brand: searchParams.brand,
      location: searchParams.location,
    }),
  ]);

  // Collect all unique brands and categories for filter chips
  const allBrands = new Set<string>();
  const allCategories = new Set<string>();
  for (const lib of libraries) {
    (lib.brands ?? []).forEach(b => allBrands.add(b));
    (lib.product_categories ?? []).forEach(c => allCategories.add(c));
  }
  for (const cat of catalogs) {
    (cat.brands ?? []).forEach(b => allBrands.add(b));
  }

  const debugInfo = (globalThis as any).__supplierLibDebug;

  return (
    <>
      {debugInfo && (
        <div className="mx-auto max-w-4xl px-4 py-2 text-xs bg-yellow-50 border-b border-yellow-200">
          <details>
            <summary className="cursor-pointer font-medium text-yellow-800">Supplier Libraries Debug Info</summary>
            <pre className="mt-2 whitespace-pre-wrap text-yellow-900">{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        </div>
      )}
      <SupplierDirectory
      workspaceSlug={workspaceSlug}
      suppliers={suppliers}
      libraries={libraries}
      catalogs={catalogs}
      brands={[...allBrands].sort()}
      categories={[...allCategories].sort()}
      initialQuery={searchParams.q ?? ''}
      initialType={searchParams.type ?? ''}
      initialLocation={searchParams.location ?? ''}
    />
    </>
  );
}
