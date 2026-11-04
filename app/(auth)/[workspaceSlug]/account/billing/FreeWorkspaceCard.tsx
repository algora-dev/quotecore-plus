import { createAdminClient } from '@/app/lib/supabase/admin';
import { QcLinkButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';

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
export async function FreeWorkspaceCard({ companyId, slug, storageUsedBytes = 0 }: { companyId: string; slug: string; storageUsedBytes?: number | null }) {
  const admin = looseAdmin();
  // Owner 2026-11-04: the original read cast the PostgREST response wrapper
  // ({data, error}) as the row itself, so this card silently never rendered
  // for anyone. Destructure the row; the gate below stays the source of truth.
  const { data: grantRow } = await admin.from('company_custom_billing')
    .select('purchased_entitlements, period_start, period_end, stripe_subscription_id')
    .eq('company_id', companyId).maybeSingle();
  const grant = grantRow as unknown as {
    purchased_entitlements?: Record<string, unknown>;
    period_start?: string; period_end?: string; stripe_subscription_id?: string;
  } | null;
  if (!grant?.stripe_subscription_id?.startsWith('admin-free-') || !grant.purchased_entitlements || !grant.period_start || !grant.period_end) return null;
  const limits = grant.purchased_entitlements;
  const num = (key: string) => Number(limits[key] ?? 0);

  const [ledgerRes, sendsRes, offcutsRes, compRes, quotesRes] = await Promise.all([
    admin.from('qcp_usage_ledger').select('resource, units')
      .eq('company_id', companyId).eq('period_start', grant.period_start).neq('state', 'refunded'),
    admin.from('company_admin_grant_usage').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('kind', 'quote_sent')
      .gte('occurred_at', grant.period_start).lt('occurred_at', grant.period_end),
    admin.from('company_admin_grant_usage').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('kind', 'offcut_generated')
      .gte('occurred_at', grant.period_start).lt('occurred_at', grant.period_end),
    admin.rpc('company_component_count', { p_company_id: companyId }),
    admin.from('quotes').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ]);
  const used = { quote: 0, scan: 0, assistant: 0 } as Record<string, number>;
  for (const e of (ledgerRes.data ?? []) as { resource: string; units: number | null }[]) {
    if (e.resource === 'quote' || e.resource === 'scan' || e.resource === 'assistant') used[e.resource] += Number(e.units ?? 0);
  }
  const componentCount = Number(compRes.data ?? 0);

  const fmtBytes = (b: number) => b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(0, Math.round(b / 1e6))} MB`;
  const rows: { label: string; hint: string; used: number; limit: number; lifetime?: boolean; bytes?: boolean }[] = [
    { label: 'Smart Assistant tasks', hint: 'voice or typed, one task each', used: used.assistant, limit: num('assistantTasks') },
    { label: 'Scan tokens', hint: 'simple scan 2 · medium+ stage 6 · re-run free', used: used.scan, limit: num('scanTokens') },
    { label: 'Quotes in workspace', hint: `${num('quotes')} at once \u2014 delete one to free a slot`, used: quotesRes.count ?? 0, limit: num('quotes') },
    { label: 'Quotes sent + links', hint: 'emails and customer links', used: sendsRes.count ?? 0, limit: num('quoteSends') },
    { label: 'Offcuts planner', hint: 'quotes using offcut plans', used: offcutsRes.count ?? 0, limit: num('offcutGenerations') },
    { label: 'Smart components', hint: 'total, does not reset', used: componentCount, limit: num('componentLimit'), lifetime: true },
    { label: 'Storage', hint: 'active files; deleting frees it once cleanup completes', used: Math.max(0, Number(storageUsedBytes ?? 0)), limit: num('storageBytes'), bytes: true },
  ];
  const reset = new Date(grant.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div data-qc-ui="v2" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Your current plan</p>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-lg font-semibold text-slate-900">Free Workspace</h3>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500">Free</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Your tier and monthly allowances{` · resets ${reset}`}
          </p>
        </div>
        <QcLinkButton href={`/${slug}/account/billing/build-setup`} variant="primary" size="lg">
          Change my plan <QcIcon name="arrow" />
        </QcLinkButton>
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
                {r.bytes ? `${fmtBytes(r.used)} / ${fmtBytes(r.limit)}` : `${r.used} / ${r.limit}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
