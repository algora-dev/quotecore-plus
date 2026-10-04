import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { cleanupDemoSession } from '@/app/lib/demo/cleanup';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get('authorization') ?? ''); const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createAdminClient(), now = new Date().toISOString();
  const stale = new Date(Date.now() - 15 * 60_000).toISOString();
  const result = await db.from('demo_sessions').select('id').or(`and(status.eq.active,expires_at.lte.${now}),status.in.(expired,cleanup_pending,cleanup_failed,failed),and(status.eq.provisioning,created_at.lte.${stale}),and(status.eq.terminating,created_at.lte.${stale})`)
    .order('created_at').limit(10);
  if (result.error) return NextResponse.json({ error: 'Cleanup selection failed' }, { status: 503 });
  const counts = { deleted: 0, skipped: 0, failed: 0 };
  for (const row of result.data ?? []) counts[await cleanupDemoSession(row.id)]++;
  const retentionCutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [prunedCounters, prunedSessions] = await Promise.all([
    db.from('demo_budget_counters').delete().lt('expires_at', retentionCutoff),
    db.from('demo_sessions').delete().eq('status', 'deleted').lt('cleanup_finished_at', retentionCutoff),
  ]);
  if (prunedCounters.error || prunedSessions.error) { counts.failed++; console.warn('[demo/cleanup] Metadata retention purge needs retry'); }
  return NextResponse.json(counts, { status: counts.failed ? 207 : 200, headers: { 'Cache-Control': 'no-store' } });
}
