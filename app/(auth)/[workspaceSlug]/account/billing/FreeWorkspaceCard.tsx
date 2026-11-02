import { createAdminClient } from '@/app/lib/supabase/admin';

/** Loose client: company_custom_billing / qcp_usage_ledger / grant usage are
 * service-role tables outside the generated types (same pattern as the
 * entitlements snapshot + admin-grant enforcement). */
/* eslint-disable @typescript-eslint/no-explicit-any */
const looseAdmin = () => createAdminClient() as unknown as { from(table: string): any; rpc(fn: string, args?: unknown): any };

/**
 * Free Workspace tier card (owner request 2026-11-02): makes the tier real
 * and visible in Account → Billing — every quota with live usage and the
 * monthly reset date. Self-gating: renders nothing for non-free setups.
 */
export async function FreeWorkspaceCard({ companyId, slug }: { companyId: string; slug: string }) {
  const admin = looseAdmin();
  const grantRaw = await admin.from('company_custom_billing')
    .select('purchased_entitlements, period_start, period_end, stripe_subscription_id')
    .eq('company_id', companyId).maybeSingle();
  const grant = grantRaw as unknown as {
    purchased_entitlements?: Record<string, unknown>;
    period_start?: string; period_end?: string; stripe_subscription_id?: string;
  } | null;
  if (!grant?.stripe_subscription_id?.startsWith('admin-free-') || !grant.purchased_entitlements || !grant.period_start || !grant.period_end) return null;
  const limits = grant.purchased_entitlements;
  const num = (key: string) => Number(limits[key] ?? 0);

  const [ledgerRes, sendsRes, offcutsRes, compRes] = await Promise.all([
    admin.from('qcp_usage_ledger').select('resource, units')
      .eq('company_id', companyId).eq('period_start', grant.period_start).neq('state', 'refunded'),
    admin.from('company_admin_grant_usage').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('kind', 'quote_sent')
      .gte('occurred_at', grant.period_start).lt('occurred_at', grant.period_end),
    admin.from('company_admin_grant_usage').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('kind', 'offcut_generated')
      .gte('occurred_at', grant.period_start).lt('occurred_at', grant.period_end),
    admin.rpc('company_component_count', { p_company_id: companyId }),
  ]);
  const used = { quote: 0, scan: 0, assistant: 0 } as Record<string, number>;
  for (const e of (ledgerRes.data ?? []) as { resource: string; units: number | null }[]) {
    if (e.resource === 'quote' || e.resource === 'scan' || e.resource === 'assistant') used[e.resource] += Number(e.units ?? 0);
  }
  const componentCount = Number(compRes.data ?? 0);

  const rows: { label: string; hint: string; used: number; limit: number; lifetime?: boolean }[] = [
    { label: 'Smart Assistant tasks', hint: 'voice or typed, one task each', used: used.assistant, limit: num('assistantTasks') },
    { label: 'Scan tokens', hint: 'simple scan 2 · medium+ stage 6 · re-run free', used: used.scan, limit: num('scanTokens') },
    { label: 'Quotes created', hint: 'new quotes this month', used: used.quote, limit: num('quotes') },
    { label: 'Quotes sent + links', hint: 'emails and customer links', used: sendsRes.count ?? 0, limit: num('quoteSends') },
    { label: 'Offcuts planner', hint: 'quotes using offcut plans', used: offcutsRes.count ?? 0, limit: num('offcutGenerations') },
    { label: 'Smart components', hint: 'total, does not reset', used: componentCount, limit: num('componentLimit'), lifetime: true },
  ];
  const reset = new Date(grant.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Free Workspace</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Your tier and monthly allowances{` · resets ${reset}`}
          </p>
        </div>
        <a href={`/${slug}/account/billing/build-setup`} className="qc-flow-control inline-flex min-h-11 items-center rounded-xl bg-[linear-gradient(135deg,#FF641F_0%,#FF8A3D_55%,#FFB36B_100%)] px-5 py-3 font-semibold text-[#191B20]">
          Upgrade my setup
        </a>
      </div>
      <div className="mt-4 grid gap-2">
        {rows.filter(r => r.limit > 0).map(r => {
          const atLimit = r.used >= r.limit;
          return (
            <div key={r.label} className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${atLimit ? 'border-orange-300 bg-orange-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{r.label}{r.lifetime ? ' (total)' : ''}</p>
                <p className="text-xs text-slate-500">{r.hint}</p>
              </div>
              <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${atLimit ? 'text-orange-700' : 'text-slate-700'}`}>
                {r.used} / {r.limit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
