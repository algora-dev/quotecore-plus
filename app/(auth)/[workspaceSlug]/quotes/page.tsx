import Link from 'next/link';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';

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
    .select('id, customer_name, job_name, status, created_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  const basePath = `/${workspaceSlug}/quotes`;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Quotes</h1>
        <p className="text-base text-slate-600">Create and manage roofing quotes.</p>
      </div>

      <Link
        href={`${basePath}/new`}
        className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        + New Quote
      </Link>

      {quotes && quotes.length > 0 ? (
        <div className="grid gap-3">
          {quotes.map((q) => (
            <Link
              key={q.id}
              href={`${basePath}/${q.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-md"
            >
              <div>
                <span className="font-medium text-slate-900">{q.customer_name}</span>
                {q.job_name && <span className="text-slate-500 ml-2">— {q.job_name}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  q.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                  q.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                  q.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {q.status}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(q.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">No quotes yet</h2>
          <p className="mt-2 text-slate-600">Create your first quote to get started.</p>
        </div>
      )}
    </section>
  );
}
