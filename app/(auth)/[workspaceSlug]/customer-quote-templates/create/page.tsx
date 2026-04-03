import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCustomerQuoteTemplates } from '../../quotes/actions';
import { TemplateCreator } from './TemplateCreator';

export default async function CreateTemplatePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  await requireCompanyContext();

  const existingTemplates = await loadCustomerQuoteTemplates();

  return (
    <TemplateCreator
      workspaceSlug={workspaceSlug}
      existingTemplates={existingTemplates}
    />
  );
}
