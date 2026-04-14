import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import Link from 'next/link';
import { QuoteSelector } from './quote-selector';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function OrderFromQuotePage(props: Props) {
  const { workspaceSlug } = await props.params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  // Load all quotes (TODO: filter by confirmed status when column exists)
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id, quote_number, job_name, customer_name, created_at, status')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[OrderFromQuote] Load error:', error);
    console.error('[OrderFromQuote] Error details:', JSON.stringify(error));
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">Failed to load quotes</p>
          <p className="text-sm text-red-600 mt-2">{error.message || 'Unknown error'}</p>
          <pre className="text-xs mt-2 text-red-500 overflow-auto">{JSON.stringify(error, null, 2)}</pre>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-slate-900">Order from Quote</h1>
          <Link
            href={`/${workspaceSlug}/material-orders`}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            ← Back
          </Link>
        </div>
        <p className="text-sm text-slate-600">Select a confirmed quote to create a material order</p>
      </div>

      {!quotes || quotes.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-500 mb-4">No quotes found</p>
          <p className="text-sm text-slate-400">
            Create a quote first to generate material orders
          </p>
        </div>
      ) : (
        <QuoteSelector quotes={quotes} workspaceSlug={workspaceSlug} />
      )}
    </div>
  );
}
