import Link from 'next/link';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { QuotesList } from './QuotesList';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { createAdminClient } from '@/app/lib/supabase/admin';

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const [quotesRes, entitlements, usageRow] = await Promise.all([
    supabase
      .from('quotes')
      .select('id, customer_name, job_name, status, quote_number, created_at, updated_at, job_status, viewed_at')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false }),
    loadCompanyEntitlements(profile.company_id),
    // Monthly usage row is keyed by (company_id, period_start) where
    // period_start is the first-of-month UTC. The atomic create_quote_atomic
    // RPC maintains it; we just read here.
    (async () => {
      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10);
      const { data } = await createAdminClient()
        .from('company_quote_usage')
        .select('quotes_created')
        .eq('company_id', profile.company_id)
        .eq('period_start', periodStart)
        .maybeSingle();
      return data;
    })(),
  ]);

  const rawQuotes = quotesRes.data ?? [];

  // Quotes with at least one UNRESOLVED revision request -> "Action Required"
  // in the Status column. One lightweight query, merged in below.
  const { data: pendingRevisionRows } = await supabase
    .from('quote_revision_requests')
    .select('quote_id')
    .eq('company_id', profile.company_id)
    .is('resolved_at', null);
  const pendingRevisionQuoteIds = new Set(
    (pendingRevisionRows ?? []).map((r) => r.quote_id).filter((x): x is string => !!x),
  );

  const quotes = rawQuotes.map((q) => ({
    ...q,
    has_pending_revision: pendingRevisionQuoteIds.has(q.id),
  }));

  const used = usageRow?.quotes_created ?? 0;
  const limit = entitlements.monthlyQuoteLimit;
  // Show the counter for any plan with a finite limit and where the user can
  // realistically run out. Pro at 100/month is generous but still worth a
  // visible counter; Enterprise (2000) we suppress to avoid clutter.
  const showCounter = limit > 0 && limit <= 200;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nearLimit = percent >= 80;
  const atLimit = used >= limit;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quotes</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage all your quotes.</p>
        </div>

        {showCounter && (
          <div className="w-full sm:w-72 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                This month
              </p>
              <p className="text-xs text-slate-500">
                Plan: <span className="font-medium text-slate-700 capitalize">{entitlements.effectivePlanCode}</span>
              </p>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {used} of {limit} quotes
            </p>
            <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
              <div
                className={`h-full ${atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-orange-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            {(nearLimit || atLimit) && (
              <p className="mt-2 text-xs">
                {atLimit ? (
                  <span className="text-red-700 font-medium">
                    Monthly limit reached.{' '}
                  </span>
                ) : (
                  <span className="text-amber-700">{limit - used} left this month. </span>
                )}
                <Link
                  href={`/${workspaceSlug}/account?tab=billing`}
                  prefetch={false}
                  className="text-orange-700 font-semibold hover:underline"
                >
                  Upgrade plan
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      <QuotesList
        quotes={quotes}
        workspaceSlug={workspaceSlug}
        monthlyQuoteAtCap={atLimit}
        monthlyQuoteUsed={used}
        monthlyQuoteLimit={limit}
        effectivePlanCode={entitlements.effectivePlanCode}
        subscriptionActive={entitlements.isActive}
      />
    </section>
  );
}
