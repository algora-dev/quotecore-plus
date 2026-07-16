import Link from 'next/link';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { FEATURE_MIN_PLAN } from '@/app/lib/billing/features';
import { InvoiceList } from './InvoiceList';

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();

  // Hard server-side feature gate — same pattern as orders/page.tsx.
  const ent = await loadCompanyEntitlements(profile.company_id);
  if (!ent.features.invoices) {
    const requiredPlan = FEATURE_MIN_PLAN.invoices;
    return (
      <section className="space-y-4 md:space-y-5 px-0 md:px-0">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Available on the {requiredPlan} plan and above.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">Invoices need a higher plan</h2>
              <p className="text-sm text-slate-600 mt-2">
                Create and send professional invoices to your customers on the {requiredPlan} plan or above. Upgrade your account to unlock invoices.
              </p>
              <div className="mt-4">
                <Link
                  href={`/${workspaceSlug}/account?tab=billing&plan=${requiredPlan}`}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800"
                >
                  View plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const companyId = profile.company_id;

  const { data: invoices } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, payment_reference, status, customer_name, customer_email, currency, total, invoice_date, due_date, sent_at, paid_at, viewed_at, disputed_at, created_at, updated_at, public_token'
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  return (
    <section className="space-y-4 md:space-y-5 px-0 md:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Create and send invoices to your customers.</p>
        </div>
      </div>

      <InvoiceList
        invoices={invoices ?? []}
        workspaceSlug={workspaceSlug}
      />
    </section>
  );
}
