import { loadCatalogs, loadCatalogEntitlements } from './actions';
import { CatalogList } from './catalog-list';

export default async function CatalogsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;

  let catalogs;
  try {
    catalogs = await loadCatalogs();
  } catch (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Unable to load catalogs</h2>
        <p className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  const ent = await loadCatalogEntitlements();

  return (
    <CatalogList
      initialCatalogs={catalogs}
      workspaceSlug={workspaceSlug}
      catalogsEnabled={ent.catalogsEnabled}
      catalogLimit={ent.catalogLimit}
      catalogCount={ent.catalogCount}
      effectivePlanCode={ent.effectivePlanCode}
      subscriptionActive={ent.isActive}
    />
  );
}
