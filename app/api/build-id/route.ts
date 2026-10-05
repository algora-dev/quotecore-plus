import { NextResponse } from 'next/server';

/** Current server build stamp. Clients compare their baked NEXT_PUBLIC_BUILD_ID
 * (the same VERCEL_GIT_COMMIT_SHA at build time) to detect that a newer
 * deployment exists; open PWAs then reload instead of silently running stale
 * code from before the deploy (owner 2026-09-29 mobile test regression source). */
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json(
    { buildId: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
