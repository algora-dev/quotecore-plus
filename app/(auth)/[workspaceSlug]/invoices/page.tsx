import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { InvoiceList } from './InvoiceList';

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .single();

  const companyId = profile?.company_id;

  const { data: invoices } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, payment_reference, status, customer_name, customer_email, currency, total, invoice_date, due_date, sent_at, paid_at, created_at, updated_at, public_token'
    )
    .eq('company_id', companyId ?? '')
    .order('created_at', { ascending: false });

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Create and send invoices to your customers.</p>
        </div>
      </div>

      <InvoiceList
        invoices={invoices ?? []}
        workspaceSlug={workspaceSlug}
      />
    </section>
  );
}
