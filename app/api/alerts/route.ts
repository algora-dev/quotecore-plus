import { NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * GET /api/alerts
 *
 * Bell-scoped alert list for the notification bell's 30s poll.
 *
 * This endpoint exists so the bell can refresh ITS OWN state without a global
 * router.refresh(). The previous implementation called router.refresh() every
 * 30 seconds, which re-rendered the entire app and destroyed in-progress
 * client state everywhere - most visibly the quote builder, whose expanded
 * components and active step reset ~30s after page load (the long-standing
 * "builder collapse" bug, root-caused 2026-09-24).
 *
 * Mirrors the workspace layout's bell query exactly (bell preview surface:
 * not-yet-cleared rows only, newest 20).
 */
export async function GET() {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('alerts')
      .select('id, alert_type, title, message, is_read, created_at, quote_id, order_id, invoice_id')
      .eq('company_id', profile.company_id)
      .is('bell_cleared_at', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ alerts: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
