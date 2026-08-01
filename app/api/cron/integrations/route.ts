/**
 * Cron route for processing the integration export queue.
 *
 * Called by Vercel cron every 2 minutes. Each invocation processes
 * ONE queued export to stay within serverless timeout limits.
 *
 * Security: requires a CRON_SECRET header that matches the env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processNextExport } from '@/app/lib/integrations/execution/dispatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 55; // Stay under Vercel's 60s timeout

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const processed = await processNextExport();
    return NextResponse.json({
      ok: true,
      processed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/integrations] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
