import { redirect } from 'next/navigation';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadSupplierProfile, loadSupplierLibraries, loadSupplierCatalogs } from './actions';
import { getUserCollections } from '../supplier-directory/actions';
import { SupplierDashboard } from './SupplierDashboard';

export default async function SupplierPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const { company } = await loadCompanyContext();

  // Only suppliers can access this page
  if (!(company as { is_supplier?: boolean }).is_supplier) {
    redirect(`/${workspaceSlug}/components`);
  }

  const [profileResult, librariesResult, catalogsResult, collections] = await Promise.all([
    loadSupplierProfile().then(p => ({ data: p, error: null as string | null })).catch(e => ({ data: null, error: e instanceof Error ? e.message : String(e) })),
    loadSupplierLibraries().then(p => ({ data: p, error: null as string | null })).catch(e => ({ data: null, error: e instanceof Error ? e.message : String(e) })),
    loadSupplierCatalogs().then(p => ({ data: p, error: null as string | null })).catch(e => ({ data: null, error: e instanceof Error ? e.message : String(e) })),
    getUserCollections().catch(() => []),
  ]);

  const profile = profileResult.data;
  const libraries = librariesResult.data ?? [];
  const catalogs = catalogsResult.data ?? [];

  // Log errors for debugging
  if (profileResult.error) console.error('[supplier/page] loadSupplierProfile error:', profileResult.error);
  if (librariesResult.error) console.error('[supplier/page] loadSupplierLibraries error:', librariesResult.error);
  if (catalogsResult.error) console.error('[supplier/page] loadSupplierCatalogs error:', catalogsResult.error);

  // If all three failed, show a detailed error
  const allErrors = [profileResult.error, librariesResult.error, catalogsResult.error].filter(Boolean);
  if (allErrors.length === 3) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">Supplier data failed to load</h2>
          <ul className="mt-3 space-y-1 text-sm text-red-700">
            {profileResult.error && <li>Profile: {profileResult.error}</li>}
            {librariesResult.error && <li>Libraries: {librariesResult.error}</li>}
            {catalogsResult.error && <li>Catalogs: {catalogsResult.error}</li>}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <SupplierDashboard
      workspaceSlug={workspaceSlug}
      profile={profile}
      libraries={libraries}
      catalogs={catalogs}
      collections={collections}
    />
  );
}
