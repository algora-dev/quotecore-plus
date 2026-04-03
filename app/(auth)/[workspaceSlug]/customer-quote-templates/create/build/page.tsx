import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCustomerQuoteTemplates } from '../../../quotes/actions';
import { TemplateBuilder } from './TemplateBuilder';

export default async function TemplateBuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ name?: string; starter?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { name, starter } = await searchParams;
  await requireCompanyContext();

  const templates = await loadCustomerQuoteTemplates();
  const starterTemplate = templates.find(t => t.is_starter_template);

  return (
    <TemplateBuilder
      workspaceSlug={workspaceSlug}
      templateName={name || ''}
      useStarter={starter === 'true'}
      starterTemplate={starterTemplate || null}
    />
  );
}
