import 'server-only';
import type { NextRequest } from 'next/server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { customScope } from '../environment';
import { usageClient } from './store';
import { resolveBillingType } from '../../company-type';
import { parseScanRequest } from './scan-contract';
import { executePurchasedScan } from './scan-execution';
import { UsageError, usageError } from './contracts';
import { SCAN_QUALITY } from '@/app/components/pricing/calculator/scanTokens';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Loose admin client: qcp_usage_ledger / company_custom_billing are
 * service-role tables outside the generated types (established pattern). */
const looseAdmin = () => createAdminClient() as unknown as { from(table: string): any; rpc(fn: string, args?: unknown): Promise<unknown> };

interface FreeScanWindow {
  companyId: string;
  stripeAccountId: string;
  stripeMode: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  scanTokens: number;
}

/** Load the Free Workspace grant window for scan metering. null unless this
 *  company runs an 'admin-free-*' grant with a readable period. Mirrors
 *  loadAdminGrantWindow: best-effort period refresh first so the window is
 *  always the current month. */
async function loadFreeScanWindow(companyId: string): Promise<FreeScanWindow | null> {
  const admin = looseAdmin();
  try { await admin.rpc('qcp_admin_free_period_refresh', { p_company_id: companyId }); } catch { /* best-effort refresh */ }
  const { data } = await admin.from('company_custom_billing')
    .select('purchased_entitlements, period_start, period_end, stripe_account_id, stripe_mode, stripe_subscription_id')
    .eq('company_id', companyId).maybeSingle();
  const row = data as {
    purchased_entitlements?: Record<string, unknown>;
    period_start?: unknown; period_end?: unknown;
    stripe_account_id?: unknown; stripe_mode?: unknown; stripe_subscription_id?: unknown;
  } | null;
  if (!row || typeof row.stripe_subscription_id !== 'string' || !row.stripe_subscription_id.startsWith('admin-free-')) return null;
  if (typeof row.period_start !== 'string' || typeof row.period_end !== 'string') return null;
  return {
    companyId,
    stripeAccountId: typeof row.stripe_account_id === 'string' ? row.stripe_account_id : '',
    stripeMode: typeof row.stripe_mode === 'string' ? row.stripe_mode : 'live',
    subscriptionId: row.stripe_subscription_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    scanTokens: Number(row.purchased_entitlements?.scanTokens ?? 0),
  };
}

/** Free Workspace scan metering (owner 2026-11-04). Mirrors the metered
 *  qcp_begin_scan tariff: scan1/scan2 cost SCAN_QUALITY tokens (low 2 /
 *  medium 6 / high 12), scan3 (tail continuation) is zero-cost, identical
 *  payload re-runs are free, and the monthly cap is the grant's scanTokens.
 *  Rows land in the SAME qcp_usage_ledger the Billing card and quota walls
 *  read, so display and enforcement stay one source of truth. */
async function executeFreeWorkspaceScan(req: NextRequest, win: FreeScanWindow,
  user: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  run: () => Promise<Response>): Promise<Response> {
  if (Number(req.headers.get('content-length') ?? 0) > 26*1024*1024) {
    throw new UsageError('scan_request_too_large', 'The plan image is too large.', 413);
  }
  let raw: unknown;
  try { raw = await req.clone().json(); } catch { throw new UsageError('invalid_scan_request', 'A valid scan request is required.', 400); }
  const r = parseScanRequest(raw, req.headers.get('idempotency-key'));
  const { data: quote, error: quoteError } = await user.from('quotes').select('id')
    .eq('id', r.quoteId).eq('company_id', win.companyId).maybeSingle();
  if (quoteError || !quote) throw new UsageError('quote_not_found', 'Quote not found.', 404);
  if (r.pageId) {
    const { data: page, error: pageError } = await user.from('takeoff_pages').select('id')
      .eq('id', r.pageId).eq('quote_id', r.quoteId).maybeSingle();
    if (pageError || !page) throw new UsageError('page_not_found', 'Plan page not found.', 404);
  }
  const admin = looseAdmin();
  // Identical payload already recorded → free re-run, no cap check.
  const { data: seen } = await admin.from('qcp_usage_ledger').select('id')
    .eq('company_id', win.companyId).eq('resource', 'scan').eq('payload_hash', r.payloadHash).maybeSingle();
  const units = r.stage === 'scan3' ? 0 : SCAN_QUALITY[r.quality].tokens;
  if (!seen) {
    const { data: rows } = await admin.from('qcp_usage_ledger').select('units')
      .eq('company_id', win.companyId).eq('resource', 'scan')
      .eq('period_start', win.periodStart).neq('state', 'refunded');
    const used = ((rows ?? []) as { units: number | null }[]).reduce((n, e) => n + Number(e.units ?? 0), 0);
    if (win.scanTokens > 0 && used + units > win.scanTokens) {
      throw new UsageError('free_scan_limit',
        `Scan Assist is limited to ${win.scanTokens} Scan Tokens per month on Free Workspace - this scan uses ${units} and ${used} are already used this month. Upgrade from Account > Billing & Pricing to keep scanning.`,
        403, { used, limit: win.scanTokens, units });
    }
  }
  const response = await run();
  if (response.ok && !seen) {
    // Same ledger shape the quote-creation path writes for free grants.
    // A write failure must not fail the finished scan: log for reconciliation.
    const { error } = await admin.from('qcp_usage_ledger').insert({
      company_id: win.companyId,
      stripe_account_id: win.stripeAccountId,
      stripe_mode: win.stripeMode,
      subscription_id: win.subscriptionId,
      period_start: win.periodStart,
      period_end: win.periodEnd,
      resource: 'scan',
      request_key: r.requestKey,
      payload_hash: r.payloadHash,
      units,
      state: 'consumed',
      metadata: { stage: r.stage, quality: r.quality, quoteId: r.quoteId, pageId: r.pageId },
    });
    if (error) console.error('[free-scan] usage ledger insert failed:', error);
  }
  return response;
}

/** Legacy and demo responses remain on the exact old handler. */
export async function withPurchasedScan(req: NextRequest,
  execute: (req: NextRequest, customMetered: boolean) => Promise<Response>): Promise<Response> {
  try {
    const user = await createSupabaseServerClient();
    const { data: { session } } = await user.auth.getSession();
    if (!session) return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const profile = await requireCompanyContext();
    const billingKind = (await resolveBillingType(profile.company_id)).kind;
    if (billingKind !== 'custom_metered') {
      // Free Workspace scans (owner 2026-11-04): 'admin-free-*' grants meter
      // against the grant's scanTokens in the same ledger the Billing card
      // and quota walls read. Other admin-granted comps keep the standard
      // unmetered path (2026-10-17 rule) until they get the same treatment.
      if (billingKind === 'custom_admin_granted') {
        const win = await loadFreeScanWindow(profile.company_id);
        if (win) return await executeFreeWorkspaceScan(req, win, user, () => execute(req, false));
      }
      return execute(req, false);
    }
    if (Number(req.headers.get('content-length') ?? 0) > 26*1024*1024) {
      throw new UsageError('scan_request_too_large', 'The plan image is too large.', 413);
    }
    let raw: unknown;
    try { raw = await req.clone().json(); } catch { throw new UsageError('invalid_scan_request', 'A valid scan request is required.', 400); }
    const r = parseScanRequest(raw, req.headers.get('idempotency-key'));
    const { data: quote, error: quoteError } = await user.from('quotes').select('id')
      .eq('id', r.quoteId).eq('company_id', profile.company_id).maybeSingle();
    if (quoteError || !quote) throw new UsageError('quote_not_found', 'Quote not found.', 404);
    if (r.pageId) {
      const { data: page, error: pageError } = await user.from('takeoff_pages').select('id')
        .eq('id', r.pageId).eq('quote_id', r.quoteId).maybeSingle();
      if (pageError || !page) throw new UsageError('page_not_found', 'Plan page not found.', 404);
    }
    const scope = customScope();
    return await executePurchasedScan({ companyId: profile.company_id, accountId: scope.accountId, mode: scope.mode },
      r, usageClient(), () => execute(req, true));
  } catch (error) {
    const e = usageError(error);
    return Response.json({ success: false, code: e.code, error: e.message, ...e.details },
      { status: e.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }
}
