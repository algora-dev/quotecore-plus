import { BackButton } from '@/app/components/BackButton';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { InvoiceTemplatesList } from './InvoiceTemplatesList';

export default async function InvoiceTemplatesSectionPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase.from('users').select('company_id').single();
  const { data: templates } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('company_id', profile?.company_id ?? '')
    .order('name');

  return (
    <section className="space-y-5">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Invoice Templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create named templates with your business header, payment details, and footer. Select one each time you create an invoice.
        </p>
      </div>
      <InvoiceTemplatesList
        workspaceSlug={workspaceSlug}
        initialTemplates={templates ?? []}
      />
    </section>
  );
}
