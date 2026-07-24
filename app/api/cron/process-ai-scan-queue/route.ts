/**
 * Cron endpoint: process AI scan queue.
 * Triggered by Vercel cron every 30 seconds.
 * Calls the scan worker to claim and process queued jobs.
 *
 * Vercel cron config (vercel.json):
 * { "path": "/api/cron/process-ai-scan-queue", "schedule": "every 30 seconds" }
 *
 * Protected by CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processScanQueue } from '@/app/lib/takeoff/scan-worker';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel hobby max

export async function POST(req: NextRequest) {
  // Auth: check CRON_SECRET (set in Vercel env)
  const authHeader = req.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processScanQueue(3);
    console.log('[cron:scan-queue]', result);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[cron:scan-queue] error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Also allow GET for Vercel cron (which sends GET by default)
export async function GET(req: NextRequest) {
  return POST(req);
}
