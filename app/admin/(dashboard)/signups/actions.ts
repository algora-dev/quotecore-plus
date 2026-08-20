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

export type SignupsResult =
  | { ok: true; signups: SignupRow[] }
  | { ok: false; error: string };

/**
 * Recent signups for the admin "Signups" tab. Same field set as
 * /api/admin/signups (agent feed) so both surfaces tell the same story.
 */
export async function loadRecentSignups(limit: number = 50): Promise<SignupsResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: companies, error } = await admin
    .from('companies')
    .select('id, name, slug, created_at, admin_paused, plan_code, subscription_status, trial_ends_at')
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

  return { ok: true, signups };
}
