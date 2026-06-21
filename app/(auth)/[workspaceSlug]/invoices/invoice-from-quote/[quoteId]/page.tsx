import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { notFound } from 'next/navigation';
import { BackButton } from '@/app/components/BackButton';
import { InvoiceLineSelector } from './InvoiceLineSelector';

interface Props {
  params: Promise<{ workspaceSlug: string; quoteId: string }>;
}

export default async function InvoiceLineSelectPage({ params }: Props) {
  const { workspaceSlug, quoteId } = await params;

  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote ownership and get basic info
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, customer_name, job_name, company_id')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (!quote) notFound();

  // Load visible customer quote lines for this quote
  const { data: linesData } = await supabase
    .from('customer_quote_lines')
    .select('id, custom_text, custom_amount, line_type, is_visible, sort_order')
    .eq('quote_id', quoteId)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });

  const lines = (linesData ?? []).map(l => ({
    id: l.id,
    custom_text: l.custom_text,
    custom_amount: l.custom_amount,
    line_type: l.line_type,
    sort_order: l.sort_order,
  }));

  return (
    <section className="space-y-5">
      <BackButton />

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Select Lines</h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose which lines from Quote #{quote.quote_number} to include in this invoice.
        </p>
      </div>

      {/* Quote summary pill */}
      <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm">
        <span className="font-semibold text-orange-600">#{quote.quote_number}</span>
        <span className="text-slate-700 font-medium">{quote.customer_name}</span>
        {quote.job_name && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{quote.job_name}</span>
          </>
        )}
      </div>

      {/* Line selector */}
      <InvoiceLineSelector
        quoteId={quoteId}
        workspaceSlug={workspaceSlug}
        lines={lines}
      />
    </section>
  );
}
