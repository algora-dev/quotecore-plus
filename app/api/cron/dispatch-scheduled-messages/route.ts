import { NextResponse } from 'next/server';
import { runDueScheduledMessages } from '@/app/lib/messages/scheduled';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron handler for Messages Phase 2.
 *
 * Polls `public.scheduled_messages` for rows where status='scheduled'
 * AND fire_at <= now(), re-evaluates cancel conditions, then dispatches
 * through the same sendOutboundMessage pipeline manual sends use.
 *
 * Scheduled every 30 minutes in `vercel.json`. 30 min is the most
 * cost-effective option on Vercel's free tier that still keeps
 * follow-up timing tight enough that "send 7 days after no response"
 * never drifts by more than half an hour.
 *
 * Authentication: same Bearer-token pattern as prune-rate-limits.
 * Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>`
 * to platform-fired cron invocations.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/dispatch-scheduled-messages] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDueScheduledMessages();
    console.log('[cron/dispatch-scheduled-messages] sweep result:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[cron/dispatch-scheduled-messages] sweep threw:', message);
    return NextResponse.json({ error: 'sweep_failed', message }, { status: 500 });
  }
}
