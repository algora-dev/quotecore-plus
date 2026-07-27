import { redirect } from 'next/navigation';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadSupplierProfile, loadSupplierLibraries } from './actions';
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

  const [profile, libraries, collections] = await Promise.all([
    loadSupplierProfile(),
    loadSupplierLibraries(),
    getUserCollections().catch(() => []),
  ]);

  return (
    <SupplierDashboard
      workspaceSlug={workspaceSlug}
      profile={profile}
      libraries={libraries}
      collections={collections}
    />
  );
}
