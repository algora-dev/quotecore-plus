import { loadTemplates } from '../../templates/data';
import { NewQuoteForm } from './new-quote-form';

export default async function NewQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { template: preselectedTemplate } = await searchParams;
  const templates = await loadTemplates();

  return (
    <section className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">New Quote</h1>
      <NewQuoteForm
        templates={templates}
        preselectedTemplateId={preselectedTemplate}
        workspaceSlug={workspaceSlug}
      />
    </section>
  );
}
