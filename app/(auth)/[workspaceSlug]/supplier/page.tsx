import { redirect } from 'next/navigation';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadSupplierProfile, loadSupplierLibraries } from './actions';
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

  const [profile, libraries] = await Promise.all([
    loadSupplierProfile(),
    loadSupplierLibraries(),
  ]);

  return (
    <SupplierDashboard
      workspaceSlug={workspaceSlug}
      profile={profile}
      libraries={libraries}
    />
  );
}
