import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { resolveBillingType } from '@/app/lib/billing/company-type';

/**
 * GET /api/quota-walls (owner spec 2026-11-03): returns the quota walls the
 * current company has ALREADY hit, so the workspace banner renders on load
 * instead of waiting for the next refused action. Mid-session refusals also
 * fire the `qc-quota-wall` client event; this endpoint covers the
 * "came back tomorrow still at the limit" case. Storage is enforced at
 * upload time and is not re-derived here.
 *
 * Loose client: company_custom_billing / qcp_usage_ledger / grant usage are
 * service-role tables outside the generated types (same pattern as the
 * FreeWorkspaceCard + admin-grant enforcement).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const looseAdmin = () => createAdminClient() as unknown as { from(table: string): any; rpc(fn: string, args?: unknown): any };

interface Wall { kind: string; used: number; limit: number }

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ walls: [] });
    const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).maybeSingle();
    const companyId = (profile as { company_id?: string } | null)?.company_id;
    if (!companyId) return NextResponse.json({ walls: [] });

    const resolved = await resolveBillingType(companyId);
    const admin = looseAdmin();
    const walls: Wall[] = [];

    const grantRes = await admin.from('company_custom_billing')
      .select('purchased_entitlements, period_start, period_end, stripe_subscription_id')
      .eq('company_id', companyId).maybeSingle();
    const grant = (grantRes?.data ?? null) as {
      purchased_entitlements?: Record<string, unknown>;
      period_start?: string; period_end?: string; stripe_subscription_id?: string;
    } | null;
    const limits = (grant?.purchased_entitlements ?? {}) as Record<string, number>;
    const periodStart = grant?.period_start;
    const periodEnd = grant?.period_end;
    const push = (kind: string, used: number, limit: number) => {
      if (limit > 0 && used >= limit) walls.push({ kind, used, limit });
    };

    const isFree = typeof grant?.stripe_subscription_id === 'string'
      && grant.stripe_subscription_id.startsWith('admin-free-');

    if (resolved.kind === 'custom_admin_granted' && isFree && periodStart && periodEnd) {
      const [ledgerRes, sendsRes, offcutsRes, compRes, quoteRes] = await Promise.all([
        admin.from('qcp_usage_ledger').select('resource, units')
          .eq('company_id', companyId).eq('period_start', periodStart).neq('state', 'refunded'),
        admin.from('company_admin_grant_usage').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('kind', 'quote_sent')
          .gte('occurred_at', periodStart).lt('occurred_at', periodEnd),
        admin.from('company_admin_grant_usage').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('kind', 'offcut_generated')
          .gte('occurred_at', periodStart).lt('occurred_at', periodEnd),
        admin.rpc('company_component_count', { p_company_id: companyId }),
        admin.from('quotes').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      ]);
      const used = { scan: 0, assistant: 0 } as Record<string, number>;
      for (const e of (ledgerRes.data ?? []) as { resource: string; units: number | null }[]) {
        if (e.resource === 'scan' || e.resource === 'assistant') used[e.resource] += Number(e.units ?? 0);
      }
      push('quotes', quoteRes.count ?? 0, Number(limits.quotes ?? 10));
      push('sends', sendsRes.count ?? 0, Number(limits.quoteSends ?? 5));
      push('scans', used.scan, Number(limits.scanTokens ?? 0));
      push('assistant', used.assistant, Number(limits.assistantTasks ?? 0));
      push('offcuts', offcutsRes.count ?? 0, Number(limits.offcutGenerations ?? 0));
      push('components', Number(compRes.data ?? 0), Number(limits.componentLimit ?? 0));
    } else if (resolved.kind === 'custom_metered') {
      // Paid capacity tiers cap components (owner 2026-11-03). Everything
      // else on paid builds is unlimited (sentinel) or add-on-metered.
      const cap = Number(limits.componentLimit ?? 0);
      if (cap > 0) {
        const compRes = await admin.rpc('company_component_count', { p_company_id: companyId });
        push('components', Number(compRes.data ?? 0), cap);
      }
    }

    return NextResponse.json({ walls });
  } catch {
    // Fail open: a broken probe must never brick the workspace shell.
    return NextResponse.json({ walls: [] });
  }
}
