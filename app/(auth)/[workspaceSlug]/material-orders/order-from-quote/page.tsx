import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { QuoteSelector } from './quote-selector';
import { BackButton } from '@/app/components/BackButton';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function OrderFromQuotePage(props: Props) {
  const { workspaceSlug } = await props.params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id, quote_number, job_name, customer_name, created_at, status')
    .eq('company_id', profile.company_id)
    .neq('status', 'draft')
    .order('created_at', { ascending: false });
  
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">Failed to load quotes: {error.message}</p>
      </div>
    );
  }
  
  return (
    <section className="space-y-5">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Order from Quote</h1>
        <p className="text-sm text-slate-500 mt-1">Select a confirmed quote to create a material order.</p>
      </div>

      {!quotes || quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No confirmed quotes found.</p>
        </div>
      ) : (
        <QuoteSelector quotes={quotes} workspaceSlug={workspaceSlug} />
      )}
    </section>
  );
}
