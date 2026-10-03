import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { pushConfig } from '@/app/lib/pwa/push-auth.server';
import { dispatchPush } from '@/app/lib/pwa/dispatch.server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
 const secret = process.env.CRON_SECRET, authorization = request.headers.get('authorization') ?? '';
 const expected = `Bearer ${secret ?? ''}`;
 if (!secret || Buffer.byteLength(authorization) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected)))
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
 try {
  const config = pushConfig();
  if (!config) return NextResponse.json({ enabled: false }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(await dispatchPush(config), { headers: { 'Cache-Control': 'no-store' } });
 } catch {
  // Never log endpoints, auth keys, VAPID material or business alert bodies.
  console.error('[pwa-push] Dispatch incomplete; inspect queue state and configuration.');
  return NextResponse.json({ error: 'Dispatch incomplete. Unacknowledged leases remain recoverable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
 }
}
