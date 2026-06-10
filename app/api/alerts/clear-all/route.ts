import { NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * POST /api/alerts/clear-all
 *
 * "Clear alerts" from the notification bell. This is a CLEAN-UP, not a delete.
 * The bell is only a preview surface; the real home for alerts is the Message
 * Center. Clearing the bell marks the currently-visible (unread) alerts as
 * read so they drop out of the bell, while every row STAYS in the Message
 * Center. The only way to permanently remove an alert is Archive -> Delete in
 * the Message Center.
 */
export async function POST() {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    // Mark-read only. No deletes. Scoped to unread so we don't churn rows that
    // are already read.
    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('company_id', profile.company_id)
      .eq('is_read', false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
