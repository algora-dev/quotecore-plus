import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const runtime = 'nodejs';
// Vercel Cron invocations are async fire-from-platform; force this route
// to render at request time even if Next would otherwise optimise it.
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron handler that drains `public.rate_limits` of rows older than
 * the prune window. Scheduled in `vercel.json` (see `crons` array).
 *
 * The function is gated by the `CRON_SECRET` environment variable. Vercel
 * sends `Authorization: Bearer <CRON_SECRET>` automatically when a job
 * fires, so we just compare. We deliberately bail out with 401 (not 404)
 * when the secret is missing or wrong so failed cron pings surface in the
 * Vercel logs rather than silently 404-ing.
 *
 * Why this exists: the `prune_rate_limits()` Postgres function exists but
 * pg_cron isn't installed on our Supabase tier (Pro). Vercel Cron is the
 * cheapest scheduled invocation we have. Closes Gerald audit M-01.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/prune-rate-limits] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  // `prune_rate_limits` is SECURITY DEFINER granted only to service_role
  // (Gerald H-01 closure migration). Returns the deleted-row count.
  const { data, error } = await supabase.rpc('prune_rate_limits');

  if (error) {
    console.error('[cron/prune-rate-limits] RPC error:', error.message);
    return NextResponse.json(
      { error: 'rpc_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, deleted: data ?? 0 });
}
