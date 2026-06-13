import { notFound } from 'next/navigation';
import { BackButton } from '@/app/components/BackButton';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { InvoiceTemplateEditor } from '../../InvoiceTemplateEditor';
import type { InvoiceTemplate } from '@/app/(auth)/[workspaceSlug]/invoices/template-actions';

export default async function EditInvoiceTemplatePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (!template) notFound();

  const { data: userRow } = await supabase.from('users').select('company_id').single();

  return (
    <section className="space-y-5">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit Invoice Template</h1>
        <p className="text-sm text-slate-500 mt-1">{template.name}</p>
      </div>
      <InvoiceTemplateEditor
        workspaceSlug={workspaceSlug}
        companyId={userRow?.company_id ?? profile.company_id}
        template={template as unknown as InvoiceTemplate}
      />
    </section>
  );
}
