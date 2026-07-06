import { requireCompanyContext } from '@/app/lib/supabase/server';
import { TemplateBuilder } from './TemplateBuilder';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';

export default async function TemplateBuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { name } = await searchParams;
  const profile = await requireCompanyContext();

  const ent = await loadCompanyEntitlements(profile.company_id);

  return (
    <TemplateBuilder
      workspaceSlug={workspaceSlug}
      templateName={name || ''}
      isOverStorage={ent.isOverStorage}
    />
  );
}
