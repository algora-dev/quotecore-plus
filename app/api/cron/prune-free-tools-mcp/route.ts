import { NextResponse } from 'next/server';
import { freeToolsMcpEnabled } from '@/app/lib/free-tools/mcp-free-tools/config';
import { pruneFreeToolsMcpAssets } from '@/app/lib/free-tools/mcp-free-tools/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!freeToolsMcpEnabled()) return NextResponse.json({ ok: true, skipped: 'disabled' });
  try {
    const result = await pruneFreeToolsMcpAssets();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Temporary MCP storage cleanup failed.';
    console.error('[cron/prune-free-tools-mcp]', message);
    return NextResponse.json({ error: 'cleanup_failed', message }, { status: 500 });
  }
}
