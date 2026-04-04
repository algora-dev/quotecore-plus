import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadComponentLibrary } from '../../../components/actions';
import { loadCustomerQuoteTemplates } from '../../../quotes/actions';
import { loadTemplate } from '../../actions';
import { TemplateEditor } from './TemplateEditor';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  await requireCompanyContext();

  const [template, componentLibrary, customerTemplates] = await Promise.all([
    loadTemplate(id),
    loadComponentLibrary(),
    loadCustomerQuoteTemplates(),
  ]);

  return (
    <TemplateEditor
      workspaceSlug={workspaceSlug}
      template={template}
      componentLibrary={componentLibrary}
      customerTemplates={customerTemplates}
    />
  );
}
