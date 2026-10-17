'use server';

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export interface SignupRow {
  companyId: string;
  companyName: string;
  slug: string | null;
  ownerName: string | null;
  ownerEmail: string;
  signedUpAt: string;
  planCode: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  adminPaused: boolean;
}

export interface DemoVisitorRow {
  companyId: string;
  companyName: string;
  ownerEmail: string;
  signedUpAt: string;
  sessionStatus: string | null;
  expiresAt: string | null;
  lastSeenAt: string | null;
  resetCount: number | null;
}

export type SignupsResult =
  | { ok: true; signups: SignupRow[]; demoVisitors: DemoVisitorRow[] }
  | { ok: false; error: string };

/**
 * Admin "Signups" tab split into two feeds:
 *  - Real companies: plan_code is not 'demo' (main app users).
 *  - Demo visitors: fictional plan_code='demo' companies created by
 *    quote-core.com/demo provisioning (owner rows carry @demo.invalid
 *    placeholder emails; one row per anonymous visitor session).
 *
 * The real-signups field set mirrors /api/admin/signups (agent feed), which
 * also excludes demo companies, so both surfaces tell the same story.
 */
export async function loadRecentSignups(limit: number = 50): Promise<SignupsResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: companies, error } = await admin
    .from('companies')
    .select('id, name, slug, created_at, admin_paused, plan_code, subscription_status, trial_ends_at')
    .or('plan_code.neq.demo,plan_code.is.null')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: error.message };
  }

  const companyIds = (companies ?? []).map(c => c.id);
  const { data: ownerRows } = companyIds.length
    ? await admin.from('users').select('company_id, email, full_name').in('company_id', companyIds).eq('role', 'owner')
    : { data: [] };
  const ownerByCompany = new Map((ownerRows ?? []).map(u => [u.company_id, u]));

  const signups: SignupRow[] = (companies ?? []).map(c => {
    const owner = ownerByCompany.get(c.id);
    return {
      companyId: c.id,
      companyName: c.name,
      slug: c.slug,
      ownerName: owner?.full_name ?? null,
      ownerEmail: owner?.email ?? '',
      signedUpAt: c.created_at,
      planCode: c.plan_code ?? null,
      subscriptionStatus: c.subscription_status ?? null,
      trialEndsAt: c.trial_ends_at ?? null,
      adminPaused: c.admin_paused ?? false,
    };
  });

  const demoVisitors = await loadDemoVisitors(admin, limit);
  if (!demoVisitors.ok) return demoVisitors;

  return { ok: true, signups, demoVisitors: demoVisitors.demoVisitors };
}

/** Newest demo companies with their latest session state. Failures here
 * degrade the demo tab only, not the real signups feed. */
async function loadDemoVisitors(
  admin: ReturnType<typeof createAdminClient>,
  limit: number
): Promise<{ ok: true; demoVisitors: DemoVisitorRow[] } | { ok: false; error: string }> {
  const { data: demoCompanies, error: demoError } = await admin
    .from('companies')
    .select('id, name, created_at')
    .eq('plan_code', 'demo')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (demoError || !demoCompanies) {
    return { ok: false, error: demoError?.message ?? 'Demo query failed' };
  }

  const ids = demoCompanies.map(c => c.id);
  const { data: sessionRows } = ids.length
    ? await admin.from('demo_sessions')
      .select('company_id, status, expires_at, last_seen_at, reset_count, created_at')
      .in('company_id', ids)
      .order('created_at', { ascending: false })
    : { data: [] };
  // Newest session per company (resets create successor sessions).
  const latestSession = new Map<string, NonNullable<typeof sessionRows>[number]>();
  for (const row of sessionRows ?? []) {
    if (row.company_id && !latestSession.has(row.company_id)) latestSession.set(row.company_id, row);
  }

  const { data: demoOwnerRows } = ids.length
    ? await admin.from('users').select('company_id, email').in('company_id', ids).eq('role', 'owner')
    : { data: [] };
  const demoOwnerByCompany = new Map((demoOwnerRows ?? []).map(u => [u.company_id, u]));

  const demoVisitors: DemoVisitorRow[] = demoCompanies.map(c => ({
    companyId: c.id,
    companyName: c.name,
    ownerEmail: demoOwnerByCompany.get(c.id)?.email ?? '',
    signedUpAt: c.created_at,
    sessionStatus: latestSession.get(c.id)?.status ?? null,
    expiresAt: latestSession.get(c.id)?.expires_at ?? null,
    lastSeenAt: latestSession.get(c.id)?.last_seen_at ?? null,
    resetCount: latestSession.get(c.id)?.reset_count ?? null,
  }));

  return { ok: true, demoVisitors };
}
