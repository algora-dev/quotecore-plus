import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getClientIP } from '@/app/lib/security/rateLimit';

export const runtime = 'nodejs';

/**
 * GET /api/admin/signups - new app signups feed.
 *
 * Purpose: lets an external agent (and the admin panel "Signups" tab) see
 * every new company signup with the basic details needed to reach out:
 * business name, owner name, email, signup date, plan.
 *
 * Auth: a static bearer key in ADMIN_SIGNUPS_API_KEY (env). No Supabase
 * access is granted to the consumer - this route is the ONLY surface, and
 * it exposes a fixed, read-only field set.
 *
 * Query params:
 *   ?since=<ISO>   only signups created after this timestamp (agent polling)
 *   ?limit=<n>     max rows (default 25, max 100)
 *   ?offset=<n>    pagination offset
 */

interface SignupRow {
  companyId: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string;
  signedUpAt: string;
  planCode: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  adminPaused: boolean;
  suppressed: boolean;
}

export async function GET(req: NextRequest) {
  // 1. Static key check (constant-time-ish compare on both lengths).
  const expected = process.env.ADMIN_SIGNUPS_API_KEY;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!expected || provided.length !== expected.length || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Light rate limit as a second layer (key compromise containment).
  const ip = getClientIP(req.headers);
  const { checkRateLimit } = await import('@/app/lib/security/rateLimit');
  const allowed = await checkRateLimit(`admin-signups:${ip}`, 240, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const since = req.nextUrl.searchParams.get('since');
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? 25);
  const offsetRaw = Number(req.nextUrl.searchParams.get('offset') ?? 0);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 25, 1), 100);
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

  const admin = createAdminClient();

  // Companies (a signup = a company; users cascade in via company_id).
  let query = admin
    .from('companies')
    .select('id, name, created_at, admin_paused, plan_code, subscription_status, trial_started_at, trial_ends_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (since) {
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) {
      query = query.gt('created_at', sinceDate.toISOString());
    }
  }

  const { data: companies, error } = await query;
  if (error) {
    console.error('[admin/signups] companies query failed:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  // Owner profile for each company (role=owner).
  const companyIds = (companies ?? []).map(c => c.id);
  const { data: ownerRows } = companyIds.length
    ? await admin.from('users').select('company_id, email, full_name').in('company_id', companyIds).eq('role', 'owner')
    : { data: [] };
  const ownerByCompany = new Map((ownerRows ?? []).map(u => [u.company_id, u]));

  // Marketing unsubscribes - flag suppressed emails so the agent skips them.
  const ownerEmails = (ownerRows ?? []).map(u => u.email.toLowerCase()).filter(Boolean);
  const { data: suppressedRows } = ownerEmails.length
    ? await admin.from('marketing_suppressions').select('email').in('email', ownerEmails)
    : { data: [] };
  const suppressedSet = new Set((suppressedRows ?? []).map(r => (r.email as string).toLowerCase()));

  const signups: SignupRow[] = (companies ?? []).map(c => {
    const owner = ownerByCompany.get(c.id);
    return {
      companyId: c.id,
      companyName: c.name,
      ownerName: owner?.full_name ?? null,
      ownerEmail: owner?.email ?? '',
      signedUpAt: c.created_at,
      planCode: (c as { plan_code?: string | null }).plan_code ?? null,
      subscriptionStatus: (c as { subscription_status?: string | null }).subscription_status ?? null,
      trialEndsAt: (c as { trial_ends_at?: string | null }).trial_ends_at ?? null,
      adminPaused: c.admin_paused ?? false,
      suppressed: owner ? suppressedSet.has(owner.email.toLowerCase()) : false,
    };
  });

  return NextResponse.json({ signups, count: signups.length, offset, limit });
}
