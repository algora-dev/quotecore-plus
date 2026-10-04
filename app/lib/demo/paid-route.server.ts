import 'server-only';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { isDemoCompany } from './context';
/** Applies even when an anonymous demo JWT is replayed outside the demo host.
 * Public free tools keep their existing independent admission/limits. */
export async function rejectUnapprovedDemoPaidRoute(): Promise<NextResponse | null> {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null; // The original endpoint performs its own auth.
    const profile = await client.from('users').select('company_id').eq('id', user.id).maybeSingle();
    if (profile.error) return NextResponse.json({ error: 'Workspace verification unavailable.' }, { status: 503 });
    if (profile.data && await isDemoCompany(profile.data.company_id)) return NextResponse.json({
      error: 'Use the prepared Takeoff or metered Smart Assistant in the guided demo.', code: 'demo_paid_route_blocked',
    }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
    return null;
  } catch { return NextResponse.json({ error: 'Workspace verification unavailable.' }, { status: 503 }); }
}
