import { QcJourney } from '@/app/components/ui/v2/QcJourney';
import Link from 'next/link';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { QuotesList } from '@/app/(auth)/[workspaceSlug]/quotes/QuotesList';
import { JobSpacesList } from '@/app/(auth)/[workspaceSlug]/job-spaces/JobSpacesList';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { createAdminClient } from '@/app/lib/supabase/admin';

/** Server presentation shared by Quotes and Job Spaces. The original quote-list
 * reads, company scope, quota rules and creation props below are unchanged.
 * Quotes remains the default view; the new view never mutates a quote.
 */
export async function QuoteIndexPage({
  params, view = 'quotes',
}: {
  params: Promise<{ workspaceSlug: string }>;
  view?: 'quotes' | 'job-spaces';
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();
  const { company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  const [quotesRes, entitlements, usageRow, componentCollections, pendingRevisionsRes] = await Promise.all([
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
    supabase
      .from('component_collections')
      .select('id, name, is_bootstrap')
      .eq('company_id', profile.company_id)
      .order('is_bootstrap', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('quote_revision_requests')
      .select('quote_id')
      .eq('company_id', profile.company_id)
      .is('resolved_at', null),
  ]);

  const rawQuotes = quotesRes.data ?? [];

  // Quotes with at least one UNRESOLVED revision request -> "Action Required"
  // in the Status column. Fetched in the parallel batch above (owner
  // 2026-10-02: was a sequential roundtrip after it).
  const pendingRevisionRows = pendingRevisionsRes.data ?? [];
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

  const measureProps = {
    workspaceSlug,
    companyId: profile.company_id,
    defaultMeasurementSystem: normalizeMeasurementSystem(company.default_measurement_system),
    digitalTakeoffAvailable: entitlements.features.digital_takeoff,
    monthlyQuoteAtCap: atLimit,
    monthlyQuoteUsed: used,
    monthlyQuoteLimit: limit,
    effectivePlanCode: entitlements.effectivePlanCode,
    defaultTrade: (company as { default_trade?: string }).default_trade ?? 'roofing',
    componentCollections: componentCollections.data ?? [],
    isOverStorage: entitlements.isOverStorage,
  };

  if (view === 'job-spaces') {
    // P3-LIST-01 (resolved): authoritative company-scoped non-draft count so a
    // capped or partial read can never masquerade as the complete job list.
    // Head-only count request; loaded rows stay untouched and the honest
    // partial-list warning in JobSpacesList covers the unpaginated row cap.
    // The existing Quotes view is unchanged.
    const { count: nonDraftCount } = await supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', profile.company_id)
      .neq('status', 'draft');
    return <JobSpacesList quotes={quotesRes.error ? undefined : quotes}
      loadError={!!quotesRes.error} workspaceSlug={workspaceSlug}
      nonDraftCount={quotesRes.error || nonDraftCount == null ? undefined : nonDraftCount} />;
  }

  return (
    <QcJourney><section className="space-y-4 md:space-y-5 px-0 md:px-0">
      <header className="qc-journey-header">
        <div className="min-w-0">
          <p className="qc-journey-eyebrow">Prepare &amp; price</p><h1>Quotes</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Start a quote, continue a draft or open its Job Space.</p>
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
                  className="qc-flow-link text-orange-700 font-semibold hover:underline"
                >
                  Upgrade plan
                </Link>
              </p>
            )}
          </div>
        )}
      </header>

      <QuotesList
        loadError={!!quotesRes.error}
        quotes={quotes}
        workspaceSlug={workspaceSlug}
        monthlyQuoteAtCap={atLimit}
        monthlyQuoteUsed={used}
        monthlyQuoteLimit={limit}
        effectivePlanCode={entitlements.effectivePlanCode}
        subscriptionActive={entitlements.isActive}
        measureProps={measureProps}
      />
    </section></QcJourney>
  );
}
