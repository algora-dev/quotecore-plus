import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireAdmin } from '@/app/lib/supabase/server';

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

/**
 * Newest demo companies with their latest demo_sessions state (status,
 * expiry, last seen, reset count) and the placeholder visitor email.
 *
 * Shared by the admin Signups "Demo users" tab and the admin Demo page.
 * Demo companies are fictional plan_code='demo' workspaces provisioned by
 * /demo; one row per anonymous visitor session.
 */
export async function loadDemoVisitors(limit: number = 50): Promise<DemoVisitorRow[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: demoCompanies, error } = await admin
    .from('companies')
    .select('id, name, created_at')
    .eq('plan_code', 'demo')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const ids = demoCompanies.map(c => c.id);
  if (ids.length === 0) return [];

  const [sessionRes, ownerRes] = await Promise.all([
    admin.from('demo_sessions')
      .select('company_id, status, expires_at, last_seen_at, reset_count, created_at')
      .in('company_id', ids)
      .order('created_at', { ascending: false }),
    admin.from('users').select('company_id, email').in('company_id', ids).eq('role', 'owner'),
  ]);
  if (sessionRes.error) throw new Error(sessionRes.error.message);

  // Newest session per company (resets create successor sessions).
  const latestSession = new Map<string, typeof sessionRes.data[number]>();
  for (const row of sessionRes.data ?? []) {
    if (row.company_id && !latestSession.has(row.company_id)) latestSession.set(row.company_id, row);
  }
  const ownerByCompany = new Map((ownerRes.data ?? []).map(u => [u.company_id, u]));

  return demoCompanies.map(c => {
    const session = latestSession.get(c.id);
    return {
      companyId: c.id,
      companyName: c.name,
      ownerEmail: ownerByCompany.get(c.id)?.email ?? '',
      signedUpAt: c.created_at,
      sessionStatus: session?.status ?? null,
      expiresAt: session?.expires_at ?? null,
      lastSeenAt: session?.last_seen_at ?? null,
      resetCount: session?.reset_count ?? null,
    };
  });
}
