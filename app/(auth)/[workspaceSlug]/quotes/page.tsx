import Link from 'next/link';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { QuotesList } from './QuotesList';

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, customer_name, job_name, status, quote_number, created_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Quotes</h1>
        <p className="text-base text-slate-600">Create and manage roofing quotes.</p>
      </div>

      <QuotesList quotes={quotes ?? []} workspaceSlug={workspaceSlug} />
    </section>
  );
}
