import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadComponentLibrary } from '../../components/actions';
import { loadCustomerQuoteTemplates } from '../../quotes/actions';
import { TemplateBuilder } from './TemplateBuilder';

export default async function CreateTemplatePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  await requireCompanyContext();

  const [componentLibrary, customerTemplates] = await Promise.all([
    loadComponentLibrary(),
    loadCustomerQuoteTemplates(),
  ]);

  return (
    <TemplateBuilder
      workspaceSlug={workspaceSlug}
      componentLibrary={componentLibrary}
      customerTemplates={customerTemplates}
    />
  );
}
