import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';

/**
 * Persist a helpful/not-helpful vote on a docs page.
 *
 * Authenticated users only for now; the table is RLS-locked so even if this
 * endpoint were ever called unauthenticated, it would no-op. The request
 * body carries the slug, vote, optional free-text reason, and a best-effort
 * app_path so we can correlate which app screen the user was viewing when
 * they hit the vote button.
 *
 * Errors are deliberately silent on the client side: vote persistence is a
 * nice-to-have telemetry signal, not a blocking action, so we never want it
 * to interrupt the user's reading flow with an error toast.
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile().catch(() => null);
    if (!profile) {
      return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as
      | { slug?: unknown; vote?: unknown; reason?: unknown; appPath?: unknown }
      | null;

    if (!body) {
      return NextResponse.json({ ok: false, reason: 'invalid-json' }, { status: 400 });
    }

    const slug = typeof body.slug === 'string' ? body.slug.slice(0, 500) : '';
    const vote = body.vote === 'up' || body.vote === 'down' ? body.vote : null;
    const reason =
      typeof body.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.slice(0, 4000)
        : null;
    const appPath = typeof body.appPath === 'string' ? body.appPath.slice(0, 500) : null;
    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

    if (!vote) {
      return NextResponse.json({ ok: false, reason: 'invalid-vote' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('docs_feedback').insert({
      slug,
      vote,
      reason,
      user_id: profile.id,
      company_id: profile.company_id,
      app_path: appPath,
      user_agent: userAgent,
    });

    if (error) {
      console.warn('[docs-feedback] insert failed:', error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[docs-feedback] handler threw:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
