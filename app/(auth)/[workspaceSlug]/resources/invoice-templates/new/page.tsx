import { BackButton } from '@/app/components/BackButton';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { InvoiceTemplateEditor } from '../InvoiceTemplateEditor';

export default async function NewInvoiceTemplatePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from('users').select('company_id').single();

  return (
    <section className="space-y-5">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Invoice Template</h1>
        <p className="text-sm text-slate-500 mt-1">Create a reusable header, payment details, and footer template for your invoices.</p>
      </div>
      <InvoiceTemplateEditor
        workspaceSlug={workspaceSlug}
        companyId={profile?.company_id ?? ''}
      />
    </section>
  );
}
