/**
 * Admin-grant hard enforcement (owner decisions 2026-10-20).
 *
 * The ONLY count-based quota is quotes: consumed at email send OR
 * acceptance-URL commit (once per quote, whichever happens first); creation
 * and drafting are never blocked. Everything else a company creates
 * (libraries, attachments, flashing drawings) carries no per-item count cap
 * - it simply consumes the combined storage allowance (owner 2026-10-20
 * correction: do not invent per-item caps).
 *
 * Allowance window = the grant's period_start..period_end. Exhausted or
 * expired -> typed error the UI turns into a Billing CTA. Legacy and
 * Stripe-metered companies pass through untouched.
 *
 * Usage rows live in company_admin_grant_usage (service-role only). The
 * UNIQUE(company_id, kind, ref_id) constraint makes counting idempotent:
 * re-sends and re-copies of the same quote never double-count, and a quote
 * first sent in one period never counts against a later period.
 */
import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { resolveBillingType } from '../company-type';
import { parsePurchasedLimits, type PurchasedLimits } from './contracts';

export type AdminGrantUsageKind = 'quote_sent';

const KIND_LABELS: Record<AdminGrantUsageKind, string> = {
  quote_sent: 'sent quotes',
};

export class AdminGrantAllowanceError extends Error {
  constructor(
    public readonly code: 'admin_grant_limit' | 'admin_grant_expired',
    message: string,
    public readonly details: { kind: AdminGrantUsageKind; used: number; limit: number; periodEnd: string },
  ) {
    super(message);
    this.name = 'AdminGrantAllowanceError';
  }
}

interface AdminGrantWindow {
  limits: PurchasedLimits;
  periodStart: string;
  periodEnd: string;
}

/** Load the admin grant's purchased limits + period. null when unreadable. */
async function loadAdminGrantWindow(companyId: string): Promise<AdminGrantWindow | null> {
  const admin = createAdminClient() as unknown as {
    from(table: string): {
      select(cols: string): { eq(col: string, val: string): { maybeSingle(): Promise<{ data: unknown; error: unknown }> } };
    };
  };
  const { data, error } = await admin
    .from('company_custom_billing')
    .select('purchased_entitlements, period_start, period_end')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { purchased_entitlements?: unknown; period_start?: unknown; period_end?: unknown };
  if (!row.purchased_entitlements || typeof row.period_start !== 'string' || typeof row.period_end !== 'string') return null;
  try {
    return {
      limits: parsePurchasedLimits(row.purchased_entitlements),
      periodStart: row.period_start,
      periodEnd: row.period_end,
    };
  } catch {
    return null;
  }
}

/**
 * Throws AdminGrantAllowanceError when the admin grant's sent-quote quota is
 * exhausted or the grant is expired. No-op for legacy and Stripe-metered
 * companies. Admin grants whose snapshot cannot be read fail closed (treated
 * as expired): a grant that cannot be verified cannot be spent.
 */
export async function assertAdminGrantAllowance(companyId: string, kind: AdminGrantUsageKind): Promise<void> {
  const resolved = await resolveBillingType(companyId);
  if (resolved.kind !== 'custom_admin_granted') return;

  const win = await loadAdminGrantWindow(companyId);
  if (!win) {
    throw new AdminGrantAllowanceError(
      'admin_grant_expired',
      'Your granted setup could not be verified. Review your setup in Billing or contact us.',
      { kind, used: 0, limit: 0, periodEnd: '' },
    );
  }

  const now = Date.now();
  if (now < Date.parse(win.periodStart) || now >= Date.parse(win.periodEnd)) {
    throw new AdminGrantAllowanceError(
      'admin_grant_expired',
      `Your granted period has ended (${new Date(win.periodEnd).toLocaleDateString('en-GB')}). Review your setup in Billing to continue.`,
      { kind, used: 0, limit: win.limits.quotes, periodEnd: win.periodEnd },
    );
  }

  const limit = win.limits.quotes;
  // Chainable read builder: eq/gte/lt compose, then head-count select.
  type UsageChain = {
    eq(col: string, val: string): UsageChain;
    gte(col: string, val: string): UsageChain;
    lt(col: string, val: string): UsageChain;
    select(cols: string, opts?: unknown): Promise<{ count: number | null; error: unknown }>;
  };
  const admin = createAdminClient() as unknown as {
    from(table: string): { select(cols: string): UsageChain };
  };
  const { count, error } = await admin
    .from('company_admin_grant_usage')
    .select('id')
    .eq('company_id', companyId)
    .eq('kind', kind)
    .gte('occurred_at', win.periodStart)
    .lt('occurred_at', win.periodEnd)
    .select('id', { count: 'exact', head: true });
  if (error) {
    throw new AdminGrantAllowanceError(
      'admin_grant_expired',
      'Your allowance could not be verified. Nothing has been sent.',
      { kind, used: 0, limit, periodEnd: win.periodEnd },
    );
  }
  const used = count ?? 0;
  if (used >= limit) {
    throw new AdminGrantAllowanceError(
      'admin_grant_limit',
      `You have used your ${KIND_LABELS[kind]} allowance for this period (${used} of ${limit}). Review your setup in Billing to continue.`,
      { kind, used, limit, periodEnd: win.periodEnd },
    );
  }
}

/**
 * Record one usage event. Idempotent via the unique constraint; never throws
 * (a ledger write failure must not fail an already-completed user action -
 * it only risks undercounting, logged for reconciliation).
 */
export async function recordAdminGrantUsage(companyId: string, kind: AdminGrantUsageKind, refId: string): Promise<void> {
  try {
    const resolved = await resolveBillingType(companyId);
    if (resolved.kind !== 'custom_admin_granted') return;
    const admin = createAdminClient() as unknown as {
      from(table: string): {
        upsert(row: Record<string, unknown>, opts: unknown): Promise<{ error: unknown }>;
      };
    };
    const { error } = await admin
      .from('company_admin_grant_usage')
      .upsert(
        { company_id: companyId, kind, ref_id: refId },
        { onConflict: 'company_id,kind,ref_id', ignoreDuplicates: true },
      );
    if (error) console.error('[admin-grant] usage record failed:', error);
  } catch (err) {
    console.error('[admin-grant] usage record threw:', err);
  }
}
