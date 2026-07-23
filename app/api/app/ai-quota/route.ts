import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const runtime = 'nodejs';

function getCurrentPeriodStart(): string {
  return new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    1,
  )).toISOString().slice(0, 10);
}

/** GET /api/app/ai-quota — returns the company's AI document parse quota status */
export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company context' }, { status: 403 });
  }

  const admin = createAdminClient();
  const periodStart = getCurrentPeriodStart();

  // Get effective plan code
  const { data: effCode } = await admin
    .rpc('company_effective_plan_code', { p_company_id: profile.company_id });
  const planCode = (effCode as string | null) ?? 'free';

  // Get plan's parse limit
  const { data: planRow } = await admin
    .from('subscription_plans')
    .select('monthly_ai_parse_limit')
    .eq('code', planCode)
    .maybeSingle();

  const limit = planRow?.monthly_ai_parse_limit ?? null;

  // Get current usage
  const { data: usageRow } = await admin
    .from('company_ai_usage')
    .select('parse_count')
    .eq('company_id', profile.company_id)
    .eq('period_start', periodStart)
    .maybeSingle();

  const used = usageRow?.parse_count ?? 0;
  const remaining = limit === null ? -1 : Math.max(0, limit - used);

  return NextResponse.json({
    limit,
    used,
    remaining,
    unlimited: limit === null,
  });
}
