import { listDirectorySuppliers, searchSupplierLibraries } from './actions';
import { SupplierDirectory } from './SupplierDirectory';

export default async function SupplierDirectoryPage(props: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ q?: string; type?: string; brand?: string; cat?: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const searchParams = await props.searchParams;

  const [suppliers, libraries] = await Promise.all([
    listDirectorySuppliers(),
    searchSupplierLibraries({
      query: searchParams.q,
      roofingType: searchParams.type,
      brand: searchParams.brand,
      productCategory: searchParams.cat,
    }),
  ]);

  // Collect all unique brands and categories for filter chips
  const allBrands = new Set<string>();
  const allCategories = new Set<string>();
  for (const lib of libraries) {
    (lib.brands ?? []).forEach(b => allBrands.add(b));
    (lib.product_categories ?? []).forEach(c => allCategories.add(c));
  }

  return (
    <SupplierDirectory
      workspaceSlug={workspaceSlug}
      suppliers={suppliers}
      libraries={libraries}
      brands={[...allBrands].sort()}
      categories={[...allCategories].sort()}
      initialQuery={searchParams.q ?? ''}
      initialType={searchParams.type ?? ''}
    />
  );
}
