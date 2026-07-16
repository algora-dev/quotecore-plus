import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { notFound } from 'next/navigation';
import { BackButton } from '@/app/components/BackButton';
import { LineSelector } from './LineSelector';

interface Props {
  params: Promise<{ workspaceSlug: string; quoteId: string }>;
  searchParams: Promise<{ layout?: string; column?: string }>;
}

export default async function OrderLineSelectPage({ params, searchParams }: Props) {
  const { workspaceSlug, quoteId } = await params;
  const { layout, column } = await searchParams;

  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Load the quote (verify ownership)
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, customer_name, job_name, company_id')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (!quote) notFound();

  // Load its components — the user will pick which ones to include in the order
  const { data: components } = await supabase
    .from('quote_components')
    .select('id, name, measurement_type, final_quantity, priced_quantity, material_cost, labour_cost')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });

  const layoutParam = layout === 'line_by_line' ? 'line_by_line' : 'components';
  const columnParam = column === 'single' || column === 'double' ? column : undefined;

  return (
    <section className="space-y-5">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Select Lines</h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose which components from Quote #{quote.quote_number} to include in this order.
        </p>
      </div>

      {/* Quote summary pill */}
      <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm">
        <span className="font-semibold text-orange-600">#{quote.quote_number}</span>
        <span className="text-slate-700">{quote.customer_name || '—'}</span>
        {quote.job_name && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{quote.job_name}</span>
          </>
        )}
      </div>

      {!components || components.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
          <p className="text-sm text-slate-500">This quote has no components to order from.</p>
        </div>
      ) : (
        <LineSelector
          quoteId={quoteId}
          workspaceSlug={workspaceSlug}
          layout={layoutParam}
          column={columnParam}
          components={components}
        />
      )}
    </section>
  );
}
