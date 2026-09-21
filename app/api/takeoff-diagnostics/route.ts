import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * POST /api/takeoff-diagnostics (M9, owner-run diagnostics capture).
 * Auth required. Writes the client diagnostics buffer (recent 200 events:
 * user actions, errors, failed fetches/server actions) into the
 * takeoff_diagnostics table (patch_054) with the SERVICE ROLE — clients
 * never write directly; RLS only allows members to read their own company.
 * Returns the stored row id so the owner can reference it ("diagnostics
 * sent" is enough for support to pull the payload).
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const snapshot = body as {
    events?: unknown;
    userAgent?: unknown;
    url?: unknown;
    capturedAt?: unknown;
  };
  if (!Array.isArray(snapshot.events)) {
    return NextResponse.json({ error: 'Missing diagnostics events' }, { status: 400 });
  }

  // Bounded payload: the client buffer is 200 events, but never trust input.
  const serialized = JSON.stringify(snapshot.events);
  if (serialized.length > 256_000) {
    return NextResponse.json({ error: 'Diagnostics payload too large' }, { status: 413 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('takeoff_diagnostics')
    .insert({
      company_id: profile.company_id,
      user_id: session.user.id,
      user_agent: typeof snapshot.userAgent === 'string' ? snapshot.userAgent.slice(0, 1024) : '',
      payload: {
        events: snapshot.events,
        url: typeof snapshot.url === 'string' ? snapshot.url : null,
        capturedAt: typeof snapshot.capturedAt === 'string' ? snapshot.capturedAt : null,
      },
    })
    .select('id')
    .single();

  if (error || data == null) {
    console.error('[takeoff-diagnostics] insert failed:', error);
    return NextResponse.json({ error: 'Could not store diagnostics' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
