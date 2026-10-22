import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { freeToolsMcpEnabled } from '@/app/lib/free-tools/mcp-free-tools/config';
import { freeToolsMcpService } from '@/app/lib/free-tools/mcp-free-tools/runtime';
import { ScanError } from '@/app/lib/free-tools/host-roof-scan/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!freeToolsMcpEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const requestOrigin = new URL(request.url).origin;
  const source = request.headers.get('origin');
  if (source && source !== requestOrigin) return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  const allowed = await checkRateLimit(`qc-free-tools-mcp-measurements:${getClientIP(request.headers)}`, 120, 60 * 60 * 1000, {
    failClosed: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
  });
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (Number(request.headers.get('content-length') ?? 0) > 40_000) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  try {
    const body = await request.json() as { session?: unknown };
    const data = await freeToolsMcpService().loadMeasurementSession(body.session);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    const status = error instanceof ScanError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load the measurement session.' }, { status });
  }
}
