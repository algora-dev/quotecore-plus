import { NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * POST /api/alerts/clear-all
 *
 * "Clear alerts" from the notification bell. The bell is a PREVIEW surface
 * only; the real home for alerts is the Message Center. Clearing the bell sets
 * `bell_cleared_at` on the alerts currently shown in the bell so they drop out
 * of the bell — and DELIBERATELY does NOT touch `is_read` or `status`. The
 * Message Center keeps its own read/unread (orange) styling and folders
 * exactly as they were. The only way to permanently remove an alert is
 * Archive -> Delete in the Message Center.
 */
export async function POST() {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    // Bell-only dismissal. Scoped to not-yet-cleared rows so we don't churn.
    const { error } = await supabase
      .from('alerts')
      .update({ bell_cleared_at: new Date().toISOString() })
      .eq('company_id', profile.company_id)
      .is('bell_cleared_at', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
